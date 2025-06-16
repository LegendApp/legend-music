import { useObservable } from "@legendapp/state/react";
import { useState } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";

type VideoPlayerProps = {
    src: string;
    width?: number | string;
    height?: number | string;
    autoPlay?: boolean;
    controls?: boolean;
    loop?: boolean;
    muted?: boolean;
    maintainAspectRatio?: boolean;
};

export const VideoPlayer = ({
    src,
    width = "100%",
    height = 300,
    autoPlay = false,
    controls = true,
    loop = false,
    muted = false,
    maintainAspectRatio = true,
}: VideoPlayerProps) => {
    const isLoading$ = useObservable(true);
    const [videoHeight, setVideoHeight] = useState(typeof height === "number" ? height : 300);
    const [aspectRatio, setAspectRatio] = useState(16 / 9);

    // JavaScript to inject - this will handle video load and send dimensions to React Native
    const injectedJavaScript = `
    function setupVideo() {
      const video = document.querySelector('video');
      if (!video) {
        setTimeout(setupVideo, 100);
        return;
      }

      // Send message when metadata is loaded (dimensions are available)
      video.addEventListener('loadedmetadata', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'dimensions',
          width: this.videoWidth,
          height: this.videoHeight,
          naturalWidth: this.videoWidth,
          naturalHeight: this.videoHeight
        }));
      });

      // Also listen for video playing to confirm dimensions
      video.addEventListener('playing', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'dimensions',
          width: this.videoWidth,
          height: this.videoHeight,
          naturalWidth: this.videoWidth,
          naturalHeight: this.videoHeight
        }));
      });
    }

    // Start setup once DOM is loaded
    document.addEventListener('DOMContentLoaded', setupVideo);
    // Also try immediately in case DOM is already loaded
    setupVideo();
    true; // Note: this is needed for injectedJavaScript to work
  `;

    // Handle messages from the WebView
    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "dimensions") {
                // Calculate new height based on aspect ratio if maintainAspectRatio is true
                if (maintainAspectRatio && data.width && data.height) {
                    const newAspectRatio = data.width / data.height;
                    setAspectRatio(newAspectRatio);

                    // If width is a number, adjust height based on aspect ratio
                    if (typeof width === "number") {
                        setVideoHeight(width / newAspectRatio);
                    }
                }
            }
        } catch (e) {
            console.error("Error parsing message from WebView:", e);
        }
    };

    // Build the HTML content with the video tag
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
          }
          video {
            max-width: 100%;
            max-height: 100%;
          }
        </style>
      </head>
      <body>
        <video
          ${autoPlay ? "autoplay" : ""}
          ${controls ? "controls" : ""}
          ${loop ? "loop" : ""}
          ${muted ? "muted" : ""}
          width="100%"
          height="100%"
        >
          <source src="${src}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </body>
    </html>
  `;

    // Calculate final dimensions
    const finalHeight = maintainAspectRatio ? (typeof width === "number" ? width / aspectRatio : videoHeight) : height;

    return (
        <View className="overflow-hidden rounded-md" style={{ width, height: finalHeight } as any}>
            <WebView
                source={{ html }}
                originWhitelist={["*"]}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
                allowsFullscreenVideo={true}
                onLoadEnd={() => isLoading$.set(false)}
                className="bg-transparent"
                injectedJavaScript={injectedJavaScript}
                onMessage={handleMessage}
            />
        </View>
    );
};
