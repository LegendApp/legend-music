import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { SPOTIFY_DEVICE_NAME } from "./constants";

type WebMessage =
    | { type: "ready"; payload: { deviceId: string } }
    | { type: "not_ready"; payload: { deviceId?: string } }
    | { type: "state"; payload: unknown }
    | { type: "error"; payload: { kind: string; message?: string } }
    | { type: "token-request"; payload?: undefined };

export interface SpotifyWebPlayerEvents {
    onReady?: (deviceId: string) => void;
    onNotReady?: (deviceId?: string) => void;
    onState?: (state: unknown) => void;
    onError?: (kind: string, message?: string) => void;
    onTokenRequest?: () => Promise<string | null> | string | null;
}

export interface SpotifyWebPlayerHandle {
    activate: () => void;
    connect: () => void;
    pause: () => void;
    resume: () => void;
    seek: (positionMs: number) => void;
    setVolume: (volume: number) => void;
    sendToken: (token: string | null) => void;
}

interface Props extends SpotifyWebPlayerEvents {
    accessToken?: string | null;
}

const playerHtml = `
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <script src="https://sdk.scdn.co/spotify-player.js"></script>
</head>
<body>
<script>
    const send = (type, payload) => {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
        }
    };

    let pendingTokenResolvers = [];
    let currentToken = null;
    let player = null;
    let pollTimer = null;
    const STATE_POLL_INTERVAL_MS = 5000;

    function setToken(token) {
        currentToken = token;
        const resolvers = pendingTokenResolvers.slice();
        pendingTokenResolvers = [];
        resolvers.forEach((resolver) => {
            try {
                resolver(token);
            } catch (error) {
                console.error(error);
            }
        });
    }

    function requestToken() {
        send("token-request", {});
    }

    function getToken(cb) {
        if (currentToken) {
            cb(currentToken);
            return;
        }
        pendingTokenResolvers.push(cb);
        requestToken();
    }

    function connectPlayer() {
        if (!player) {
            return;
        }
        player.connect();
    }

    function startStatePolling() {
        if (pollTimer || !player || !player.getCurrentState) {
            return;
        }

        pollTimer = setInterval(() => {
            if (!player || !player.getCurrentState) {
                return;
            }
            player
                .getCurrentState()
                .then((state) => {
                    if (state) {
                        send("state", state);
                    }
                })
                .catch(() => {});
        }, STATE_POLL_INTERVAL_MS);
    }

    function handleMessage(event) {
        let data = event.data;
        try {
            data = JSON.parse(event.data);
        } catch (_) {
            return;
        }

        const { type, payload } = data || {};
        switch (type) {
            case "token":
                setToken(payload && payload.token ? payload.token : null);
                break;
            case "activate":
                player && player.activateElement && player.activateElement();
                break;
            case "connect":
                connectPlayer();
                break;
            case "pause":
                player && player.pause && player.pause();
                break;
            case "resume":
                player && player.resume && player.resume();
                break;
            case "seek":
                if (player && player.seek && typeof payload?.positionMs === "number") {
                    player.seek(payload.positionMs);
                }
                break;
            case "set-volume":
                if (player && player.setVolume && typeof payload?.volume === "number") {
                    player.setVolume(Math.max(0, Math.min(1, payload.volume)));
                }
                break;
            default:
                break;
        }
    }

    window.addEventListener("message", handleMessage);
    document.addEventListener("message", handleMessage);

    window.onSpotifyWebPlaybackSDKReady = () => {
        player = new Spotify.Player({
            name: "${SPOTIFY_DEVICE_NAME}",
            getOAuthToken: (cb) => getToken(cb),
            volume: 0.8,
        });

        player.addListener("ready", ({ device_id }) => send("ready", { deviceId: device_id }));
        player.addListener("not_ready", ({ device_id }) => send("not_ready", { deviceId: device_id }));
        player.addListener("player_state_changed", (state) => send("state", state));
        player.addListener("initialization_error", ({ message }) => send("error", { kind: "init", message }));
        player.addListener("authentication_error", ({ message }) => send("error", { kind: "auth", message }));
        player.addListener("account_error", ({ message }) => send("error", { kind: "account", message }));
        player.addListener("playback_error", ({ message }) => send("error", { kind: "playback", message }));

        connectPlayer();
        startStatePolling();
    };
</script>
</body>
</html>
`;

export const SpotifyWebPlayerHost = forwardRef<SpotifyWebPlayerHandle, Props>(function SpotifyWebPlayerHost(
    { accessToken, onReady, onNotReady, onState, onError, onTokenRequest },
    ref,
) {
    const webviewRef = useRef<WebView>(null);

    const sendCommand = useCallback((type: string, payload?: unknown) => {
        webviewRef.current?.postMessage(JSON.stringify({ type, payload }));
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            activate: () => sendCommand("activate"),
            connect: () => sendCommand("connect"),
            pause: () => sendCommand("pause"),
            resume: () => sendCommand("resume"),
            seek: (positionMs: number) => sendCommand("seek", { positionMs }),
            setVolume: (volume: number) => sendCommand("set-volume", { volume }),
            sendToken: (token: string | null) => sendCommand("token", { token }),
        }),
        [sendCommand],
    );

    useEffect(() => {
        if (accessToken) {
            sendCommand("token", { token: accessToken });
        }
    }, [accessToken, sendCommand]);

    const handleMessage = useCallback(
        async (event: WebViewMessageEvent) => {
            let data: WebMessage | null = null;
            try {
                data = JSON.parse(event.nativeEvent.data) as WebMessage;
            } catch (error) {
                console.warn("Spotify webview message parse failed", error);
            }
            if (!data) {
                return;
            }

            if (__DEV__) {
                if (
                    data.type === "ready" ||
                    data.type === "not_ready" ||
                    data.type === "error" ||
                    data.type === "token-request" ||
                    data.type === "state"
                ) {
                    console.log("[SpotifyWebPlayerHost] message", { type: data.type, payload: data.payload });
                }
            }

            switch (data.type) {
                case "ready":
                    onReady?.(data.payload.deviceId);
                    break;
                case "not_ready":
                    onNotReady?.(data.payload?.deviceId);
                    break;
                case "state":
                    onState?.(data.payload);
                    break;
                case "error":
                    onError?.(data.payload.kind, data.payload.message);
                    break;
                case "token-request":
                    if (!onTokenRequest) {
                        return;
                    }
                    try {
                        const token = await onTokenRequest();
                        if (token) {
                            sendCommand("token", { token });
                        }
                    } catch (error) {
                        onError?.("token", error instanceof Error ? error.message : String(error));
                    }
                    break;
                default:
                    break;
            }
        },
        [onReady, onNotReady, onState, onError, onTokenRequest, sendCommand],
    );

    const html = useMemo(() => playerHtml, []);

    return (
        <View pointerEvents="none" style={{ width: 0, height: 0, opacity: 0 }}>
            <WebView
                ref={webviewRef}
                originWhitelist={["*"]}
                source={{ html }}
                onMessage={handleMessage}
                hideKeyboardAccessoryView
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                webviewDebuggingEnabled
            />
        </View>
    );
});
