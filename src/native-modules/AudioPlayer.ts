import { NativeEventEmitter, NativeModules } from "react-native";

const { AudioPlayer } = NativeModules;

if (!AudioPlayer) {
    throw new Error("AudioPlayer native module is not available");
}

export interface AudioPlayerState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
}

export type RemoteCommand = "play" | "pause" | "toggle" | "next" | "previous";

export interface NowPlayingInfoPayload {
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    elapsedTime?: number;
    playbackRate?: number;
    artwork?: string;
    isPlaying?: boolean;
}

/**
 * Visualizer configuration mirrored on the native FFT pipeline.
 *
 * The native tap targets a 16 ms cadence (≈60 Hz). When the FFT processing time exceeds its 4 ms CPU
 * budget repeatedly, it will expand the throttle window through 24 ms, 33 ms, and 50 ms before finally
 * halving the bin count. Providing a larger `throttleMs` opts into a slower base cadence; set `0` to
 * disable throttling and allow the adaptive backoff to re-enable it if necessary.
 */
export interface VisualizerConfig {
    enabled: boolean;
    fftSize?: number;
    binCount?: number;
    smoothing?: number;
    throttleMs?: number;
}

export interface VisualizerFrame {
    /**
     * Root-mean-square amplitude for the frame (0-1).
     */
    rms: number;
    /**
     * High-resolution monotonic timestamp from native (seconds).
     */
    timestamp: number;
    /**
     * Base64-encoded payload containing successive 32-bit float bin magnitudes in little-endian order.
     * Present when `format === "f32-le"` and preferred for bandwidth-sensitive consumers.
     */
    payload?: string;
    /**
     * Payload format identifier. Currently `"f32-le"` for float32 values encoded with little-endian byte order.
     */
    format?: "f32-le";
    /**
     * Number of bytes for each sample in the payload (defaults to 4 for float32).
     */
    stride?: number;
    /**
     * Number of bins encoded in the payload.
     */
    binCount?: number;
    /**
     * Payload schema version. Starts at `1` for the base64 float32 format.
     */
    version?: number;
    /**
     * Legacy fallback array of normalized bin magnitudes. Only populated for older native builds.
     */
    bins?: number[];
}

export interface AudioPlayerEvents {
    onLoadSuccess: (data: { duration: number }) => void;
    onLoadError: (data: { error: string }) => void;
    onPlaybackStateChanged: (data: { isPlaying: boolean }) => void;
    onProgress: (data: { currentTime: number; duration: number }) => void;
    onCompletion: () => void;
    onRemoteCommand: (data: { command: RemoteCommand }) => void;
    onVisualizerFrame: (data: VisualizerFrame) => void;
}

type AudioPlayerType = {
    loadTrack: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    play: () => Promise<{ success: boolean; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
    seek: (seconds: number) => Promise<{ success: boolean; error?: string }>;
    setVolume: (volume: number) => Promise<{ success: boolean; error?: string }>;
    getCurrentState: () => Promise<AudioPlayerState>;
    getTrackInfo: (filePath: string) => Promise<{ durationSeconds: number; sampleRate: number; frameCount: number }>;
    updateNowPlayingInfo: (payload: NowPlayingInfoPayload) => void;
    clearNowPlayingInfo: () => void;
    configureVisualizer: (config: VisualizerConfig) => Promise<{ success: boolean }>;
    installVisualizerBindings: () => Promise<{ installed: boolean }>;
};

const audioPlayerEmitter = new NativeEventEmitter(AudioPlayer);

const audioPlayerApi: AudioPlayerType & {
    addListener: <T extends keyof AudioPlayerEvents>(
        eventType: T,
        listener: AudioPlayerEvents[T],
    ) => { remove: () => void };
} = {
    loadTrack: (filePath: string) => AudioPlayer.loadTrack(filePath),
    play: () => AudioPlayer.play(),
    pause: () => AudioPlayer.pause(),
    stop: () => AudioPlayer.stop(),
    seek: (seconds: number) => AudioPlayer.seek(seconds),
    setVolume: (volume: number) => AudioPlayer.setVolume(volume),
    getCurrentState: () => AudioPlayer.getCurrentState(),
    getTrackInfo: (filePath: string) => AudioPlayer.getTrackInfo(filePath),
    updateNowPlayingInfo: (payload: NowPlayingInfoPayload) => AudioPlayer.updateNowPlayingInfo(payload),
    clearNowPlayingInfo: () => AudioPlayer.clearNowPlayingInfo(),
    configureVisualizer: (config: VisualizerConfig) => AudioPlayer.configureVisualizer(config),
    installVisualizerBindings: () => AudioPlayer.installVisualizerBindings(),
    addListener: <T extends keyof AudioPlayerEvents>(eventType: T, listener: AudioPlayerEvents[T]) => {
        const subscription = audioPlayerEmitter.addListener(eventType, listener);
        return {
            remove: () => subscription.remove(),
        };
    },
};

export const useAudioPlayer = (): typeof audioPlayerApi => audioPlayerApi;

export default AudioPlayer as AudioPlayerType;
