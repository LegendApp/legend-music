import { useObservable } from '@legendapp/state/react';
import React, { useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Track {
    title: string;
    artist: string;
    duration: string;
    thumbnail: string;
}

interface PlayerState {
    isPlaying: boolean;
    currentTrack: Track | null;
    currentTime: string;
    isLoading: boolean;
    error: string | null;
}

const injectedJavaScript = `
(function() {
    let lastState = {};

    function extractPlayerInfo() {
        try {
            // Get current track info
            const titleElement = document.querySelector('.title.style-scope.ytmusic-player-bar');
            const artistElement = document.querySelector('.byline.style-scope.ytmusic-player-bar');
            const thumbnailElement = document.querySelector('.image.style-scope.ytmusic-player-bar img');

            // Get play/pause state
            const playButton = document.querySelector('#play-pause-button button');
            const isPlaying = playButton?.getAttribute('aria-label')?.includes('Pause') || false;

            // Get current time
            const timeElement = document.querySelector('#left-controls .time-info');
            const currentTime = timeElement?.textContent?.trim() || '0:00';

            // Get duration
            const durationElement = document.querySelector('#right-controls .time-info');
            const duration = durationElement?.textContent?.trim() || '0:00';

            const currentState = {
                isPlaying,
                currentTrack: {
                    title: titleElement?.textContent?.trim() || '',
                    artist: artistElement?.textContent?.trim() || '',
                    duration: duration,
                    thumbnail: thumbnailElement?.src || ''
                },
                currentTime,
                isLoading: false,
                error: null
            };

            // Only send update if state changed
            if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'playerState',
                    data: currentState
                }));
                lastState = currentState;
            }
        } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                data: { error: error.message }
            }));
        }
    }

    // Control functions
    window.ytMusicControls = {
        playPause: function() {
            const button = document.querySelector('#play-pause-button button');
            if (button) button.click();
        },

        next: function() {
            const button = document.querySelector('[aria-label="Next song"]');
            if (button) button.click();
        },

        previous: function() {
            const button = document.querySelector('[aria-label="Previous song"]');
            if (button) button.click();
        },

        setVolume: function(volume) {
            const slider = document.querySelector('#volume-slider input');
            if (slider) {
                slider.value = volume;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        },

        seek: function(seconds) {
            const progressBar = document.querySelector('#progress-bar input');
            if (progressBar) {
                progressBar.value = seconds;
                progressBar.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    };

    // Initial extraction
    extractPlayerInfo();

    // Set up observers for dynamic content
    const observer = new MutationObserver(function(mutations) {
        let shouldUpdate = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                shouldUpdate = true;
            }
        });
        if (shouldUpdate) {
            setTimeout(extractPlayerInfo, 100);
        }
    });

    // Observe the player bar for changes
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (playerBar) {
        observer.observe(playerBar, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-label', 'title']
        });
    }

    // Periodic updates as fallback
    setInterval(extractPlayerInfo, 1000);

    // Signal that injection is complete
    window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'injectionComplete',
        data: { success: true }
    }));
})();
`;

// Create observable player state outside component for global access
const playerState$ = useObservable<PlayerState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: '0:00',
    isLoading: true,
    error: null,
});

let webViewRef: React.MutableRefObject<WebView | null> | null = null;

const executeCommand = (command: string, ...args: any[]) => {
    const script = `window.ytMusicControls.${command}(${args.map(arg => JSON.stringify(arg)).join(', ')}); true;`;
    webViewRef?.current?.injectJavaScript(script);
};

// Expose control methods
const controls = {
    playPause: () => executeCommand('playPause'),
    next: () => executeCommand('next'),
    previous: () => executeCommand('previous'),
    setVolume: (volume: number) => executeCommand('setVolume', volume),
    seek: (seconds: number) => executeCommand('seek', seconds),
};

export function YouTubeMusicPlayer() {
    const localWebViewRef = useRef<WebView>(null);

    // Set the global ref to this instance
    React.useEffect(() => {
        webViewRef = localWebViewRef;
        return () => {
            webViewRef = null;
        };
    }, []);

    const handleMessage = (event: any) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);

            console.log({ message})

            switch (message.type) {
                case 'playerState':
                    playerState$.assign(message.data);
                    break;
                case 'error':
                    playerState$.error.set(message.data.error);
                    playerState$.isLoading.set(false);
                    break;
                case 'injectionComplete':
                    playerState$.isLoading.set(false);
                    break;
            }
        } catch (error) {
            console.error('Failed to parse WebView message:', error);
            playerState$.error.set('Failed to parse player message');
        }
    };

    return (
        <View className="flex-1">
            <WebView
                ref={localWebViewRef}
                source={{ uri: 'https://music.youtube.com' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                mixedContentMode="compatibility"
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                injectedJavaScript={injectedJavaScript}
                onMessage={handleMessage}
                onLoadStart={() => playerState$.isLoading.set(true)}
                onLoadEnd={() => {
                    // Injection will set loading to false
                }}
                onError={(error) => {
                    playerState$.error.set(`WebView error: ${error.nativeEvent.description}`);
                    playerState$.isLoading.set(false);
                }}
                userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                className="flex-1"
            />
        </View>
    );
}

// Export player state and controls for use in other components
export { playerState$, controls };