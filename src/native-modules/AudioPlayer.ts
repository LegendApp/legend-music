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

export interface AudioPlayerEvents {
    onLoadSuccess: (data: { duration: number }) => void;
    onLoadError: (data: { error: string }) => void;
    onPlaybackStateChanged: (data: { isPlaying: boolean }) => void;
    onProgress: (data: { currentTime: number; duration: number }) => void;
    onCompletion: () => void;
}

type AudioPlayerType = {
    loadTrack: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    play: () => Promise<{ success: boolean; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
    seek: (seconds: number) => Promise<{ success: boolean; error?: string }>;
    setVolume: (volume: number) => Promise<{ success: boolean; error?: string }>;
    getCurrentState: () => Promise<AudioPlayerState>;
};

const audioPlayerEmitter = new NativeEventEmitter(AudioPlayer);

export const useAudioPlayer = (): AudioPlayerType & {
    addListener: <T extends keyof AudioPlayerEvents>(
        eventType: T,
        listener: AudioPlayerEvents[T],
    ) => { remove: () => void };
} => {
    return {
        loadTrack: (filePath: string) => AudioPlayer.loadTrack(filePath),
        play: () => AudioPlayer.play(),
        pause: () => AudioPlayer.pause(),
        stop: () => AudioPlayer.stop(),
        seek: (seconds: number) => AudioPlayer.seek(seconds),
        setVolume: (volume: number) => AudioPlayer.setVolume(volume),
        getCurrentState: () => AudioPlayer.getCurrentState(),
        addListener: <T extends keyof AudioPlayerEvents>(eventType: T, listener: AudioPlayerEvents[T]) => {
            const subscription = audioPlayerEmitter.addListener(eventType, listener);
            return {
                remove: () => subscription.remove(),
            };
        },
    };
};

export default AudioPlayer as AudioPlayerType;
