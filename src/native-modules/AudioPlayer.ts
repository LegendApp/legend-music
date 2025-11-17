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

export interface VisualizerConfig {
    enabled: boolean;
    fftSize?: number;
    binCount?: number;
    smoothing?: number;
    throttleMs?: number;
}

export interface VisualizerFrame {
    rms: number;
    bins: number[];
    timestamp: number;
}

export interface MediaTags {
    title?: string;
    artist?: string;
    album?: string;
    durationSeconds?: number;
    artworkUri?: string;
    artworkKey?: string;
}

export interface MediaTagWritePayload {
    title?: string | null;
    artist?: string | null;
    album?: string | null;
    artworkBase64?: string | null;
    artworkMime?: string | null;
}

export interface NativeScannedTrack {
    rootIndex: number;
    relativePath: string;
    fileName: string;
    title?: string;
    artist?: string;
    album?: string;
    durationSeconds?: number;
    artworkUri?: string;
    artworkKey?: string;
}

export interface MediaScanBatchEvent {
    tracks: NativeScannedTrack[];
    rootIndex: number;
    completedRoots?: number;
    totalRoots?: number;
}

export interface MediaScanProgressEvent {
    rootIndex: number;
    completedRoots: number;
    totalRoots: number;
}

export interface MediaScanResult {
    totalTracks: number;
    totalRoots: number;
    errors?: string[];
}

export interface MediaScanOptions {
    batchSize?: number;
    includeHidden?: boolean;
}

export interface AudioPlayerEvents {
    onLoadSuccess: (data: { duration: number }) => void;
    onLoadError: (data: { error: string }) => void;
    onPlaybackStateChanged: (data: { isPlaying: boolean }) => void;
    onProgress: (data: { currentTime: number; duration: number }) => void;
    onCompletion: () => void;
    onRemoteCommand: (data: { command: RemoteCommand }) => void;
    onVisualizerFrame: (data: VisualizerFrame) => void;
    onMediaScanBatch: (data: MediaScanBatchEvent) => void;
    onMediaScanProgress: (data: MediaScanProgressEvent) => void;
    onMediaScanComplete: (data: MediaScanResult) => void;
}

type AudioPlayerNativeType = {
    loadTrack: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    play: () => Promise<{ success: boolean; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
    seek: (seconds: number) => Promise<{ success: boolean; error?: string }>;
    setVolume: (volume: number) => Promise<{ success: boolean; error?: string }>;
    getCurrentState: () => Promise<AudioPlayerState>;
    getMediaTags: (filePath: string, cacheDir: string) => Promise<MediaTags>;
    writeMediaTags: (filePath: string, payload: MediaTagWritePayload) => Promise<{ success: boolean }>;
    scanMediaLibrary: (paths: string[], cacheDir: string, options?: MediaScanOptions) => Promise<MediaScanResult>;
    updateNowPlayingInfo: (payload: NowPlayingInfoPayload) => void;
    clearNowPlayingInfo: () => void;
    configureVisualizer: (config: VisualizerConfig) => Promise<{ success: boolean }>;
};

const audioPlayerEmitter = new NativeEventEmitter(AudioPlayer);

const audioPlayerApi: AudioPlayerNativeType & {
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
    getMediaTags: (filePath: string, cacheDir: string) => AudioPlayer.getMediaTags(filePath, cacheDir),
    writeMediaTags: (filePath: string, payload: MediaTagWritePayload) => AudioPlayer.writeMediaTags(filePath, payload),
    scanMediaLibrary: (paths: string[], cacheDir: string, options?: MediaScanOptions) =>
        AudioPlayer.scanMediaLibrary(paths, cacheDir, options ?? {}),
    updateNowPlayingInfo: (payload: NowPlayingInfoPayload) => AudioPlayer.updateNowPlayingInfo(payload),
    clearNowPlayingInfo: () => AudioPlayer.clearNowPlayingInfo(),
    configureVisualizer: (config: VisualizerConfig) => AudioPlayer.configureVisualizer(config),
    addListener: <T extends keyof AudioPlayerEvents>(eventType: T, listener: AudioPlayerEvents[T]) => {
        const subscription = audioPlayerEmitter.addListener(eventType, listener);
        return {
            remove: () => subscription.remove(),
        };
    },
};

export const useAudioPlayer = (): typeof audioPlayerApi => audioPlayerApi;

export const audioPlayerNative: AudioPlayerNativeType = AudioPlayer as AudioPlayerNativeType;

export default audioPlayerApi;
