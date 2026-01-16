import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import type { YoutubeMusicPlaybackState } from "@/providers/youtubeMusic/playerState";

type WebMessage =
    | { type: "ready"; payload?: undefined }
    | { type: "state"; payload: YoutubeMusicPlaybackState }
    | { type: "error"; payload: { message: string } };

export interface YoutubeMusicWebPlayerEvents {
    onReady?: () => void;
    onState?: (state: YoutubeMusicPlaybackState) => void;
    onError?: (message: string) => void;
}

export interface YoutubeMusicWebPlayerHandle {
    load: (url: string) => void;
    play: () => void;
    pause: () => void;
    seek: (positionSeconds: number) => void;
    setVolume: (volume: number) => void;
    requestState: () => void;
}

type Props = YoutubeMusicWebPlayerEvents & {
    initialUrl?: string;
};

const injectedJavaScript = `
(function () {
    const send = (type, payload) => {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
        }
    };

    const STATE_POLL_INTERVAL_MS = 1000;
    let currentVideo = null;
    let pollTimer = null;

    const safeNumber = (value) => (typeof value === "number" && !Number.isNaN(value) ? value : undefined);

    const emitState = (extra) => {
        const payload = Object.assign({}, extra);
        if (!currentVideo) {
            payload.isLoading = true;
            send("state", payload);
            return;
        }
        payload.isPlaying = !currentVideo.paused;
        payload.positionSeconds = safeNumber(currentVideo.currentTime);
        payload.durationSeconds = safeNumber(currentVideo.duration);
        payload.isLoading = currentVideo.readyState < 2;
        send("state", payload);
    };

    const detachVideoListeners = (video) => {
        if (!video) {
            return;
        }
        video.removeEventListener("play", handlePlaybackEvent);
        video.removeEventListener("pause", handlePlaybackEvent);
        video.removeEventListener("timeupdate", handlePlaybackEvent);
        video.removeEventListener("loadedmetadata", handlePlaybackEvent);
        video.removeEventListener("ended", handleEndedEvent);
        video.removeEventListener("error", handleErrorEvent);
    };

    const handlePlaybackEvent = () => {
        emitState();
    };

    const handleEndedEvent = () => {
        emitState({ didComplete: true });
    };

    const handleErrorEvent = () => {
        send("error", { message: "YouTube Music playback error" });
    };

    const attachVideoListeners = (video) => {
        if (!video) {
            return;
        }
        video.addEventListener("play", handlePlaybackEvent);
        video.addEventListener("pause", handlePlaybackEvent);
        video.addEventListener("timeupdate", handlePlaybackEvent);
        video.addEventListener("loadedmetadata", handlePlaybackEvent);
        video.addEventListener("ended", handleEndedEvent);
        video.addEventListener("error", handleErrorEvent);
    };

    const updateVideoRef = () => {
        const nextVideo = document.querySelector("video");
        if (nextVideo && nextVideo !== currentVideo) {
            detachVideoListeners(currentVideo);
            currentVideo = nextVideo;
            attachVideoListeners(currentVideo);
            emitState();
        }
    };

    const startPolling = () => {
        if (pollTimer) {
            return;
        }
        pollTimer = setInterval(() => {
            updateVideoRef();
            emitState();
        }, STATE_POLL_INTERVAL_MS);
    };

    const handleCommand = (message) => {
        if (!message || typeof message !== "object") {
            return;
        }
        const type = message.type;
        const payload = message.payload || {};
        switch (type) {
            case "load":
                if (payload.url) {
                    window.location.href = payload.url;
                }
                break;
            case "play":
                if (currentVideo && currentVideo.play) {
                    currentVideo.play().catch(() => {});
                }
                break;
            case "pause":
                if (currentVideo && currentVideo.pause) {
                    currentVideo.pause();
                }
                break;
            case "seek":
                if (currentVideo && typeof payload.positionSeconds === "number") {
                    currentVideo.currentTime = Math.max(0, payload.positionSeconds);
                }
                break;
            case "set-volume":
                if (currentVideo && typeof payload.volume === "number") {
                    currentVideo.volume = Math.max(0, Math.min(1, payload.volume));
                }
                break;
            case "request-state":
                emitState();
                break;
            default:
                break;
        }
    };

    const handleMessage = (event) => {
        let data = event && event.data ? event.data : null;
        if (!data) {
            return;
        }
        try {
            data = JSON.parse(data);
        } catch (_) {
            return;
        }
        handleCommand(data);
    };

    window.addEventListener("message", handleMessage);
    document.addEventListener("message", handleMessage);

    startPolling();
    send("ready");
})();
true;
`;

export const YoutubeMusicWebPlayerHost = forwardRef<YoutubeMusicWebPlayerHandle, Props>(function YoutubeMusicWebPlayerHost(
    { initialUrl = "https://music.youtube.com", onReady, onState, onError },
    ref,
) {
    const webviewRef = useRef<WebView>(null);

    const sendCommand = useCallback((type: string, payload?: unknown) => {
        webviewRef.current?.postMessage(JSON.stringify({ type, payload }));
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            load: (url: string) => sendCommand("load", { url }),
            play: () => sendCommand("play"),
            pause: () => sendCommand("pause"),
            seek: (positionSeconds: number) => sendCommand("seek", { positionSeconds }),
            setVolume: (volume: number) => sendCommand("set-volume", { volume }),
            requestState: () => sendCommand("request-state"),
        }),
        [sendCommand],
    );

    const handleMessage = useCallback(
        (event: WebViewMessageEvent) => {
            let data: WebMessage | null = null;
            try {
                data = JSON.parse(event.nativeEvent.data) as WebMessage;
            } catch (error) {
                console.warn("YouTube Music webview message parse failed", error);
            }
            if (!data) {
                return;
            }

            if (__DEV__) {
                if (data.type === "ready" || data.type === "state" || data.type === "error") {
                    console.log("[YoutubeMusicWebPlayerHost] message", { type: data.type, payload: data.payload });
                }
            }

            switch (data.type) {
                case "ready":
                    onReady?.();
                    break;
                case "state":
                    onState?.(data.payload);
                    break;
                case "error":
                    onError?.(data.payload.message);
                    break;
                default:
                    break;
            }
        },
        [onError, onReady, onState],
    );

    const injected = useMemo(() => injectedJavaScript, []);

    return (
        <View pointerEvents="none" style={{ width: 0, height: 0, opacity: 0 }}>
            <WebView
                ref={webviewRef}
                originWhitelist={["*"]}
                source={{ uri: initialUrl }}
                onMessage={handleMessage}
                injectedJavaScript={injected}
                hideKeyboardAccessoryView
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                webviewDebuggingEnabled
            />
        </View>
    );
});
