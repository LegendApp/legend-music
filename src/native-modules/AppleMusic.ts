import { NativeEventEmitter, NativeModules } from "react-native";

const { AppleMusic } = NativeModules;

if (!AppleMusic) {
    throw new Error("AppleMusic native module is not available");
}

export interface AppleMusicUserProfile {
    id?: string;
    name?: string;
    subscription?: string | null;
    storefront?: string | null;
}

export interface AppleMusicAuthorizationResult {
    userToken: string | null;
    userTokenExpiresAt?: number | null;
    storefront?: string | null;
    user?: AppleMusicUserProfile | null;
}

export interface AppleMusicPlaybackState {
    trackId?: string | null;
    isPlaying?: boolean;
    isLoading?: boolean;
    positionSeconds?: number;
    durationSeconds?: number;
    artworkUrl?: string | null;
    didComplete?: boolean;
    error?: string | null;
}

export interface AppleMusicEvents {
    onPlaybackState: (data: AppleMusicPlaybackState) => void;
    onPlaybackError: (data: { error: string }) => void;
}

type AppleMusicNativeType = {
    getDeveloperToken: () => Promise<string>;
    authorize: (params: { developerToken: string }) => Promise<AppleMusicAuthorizationResult>;
    unauthorize: () => Promise<void>;
    configure: (params: { developerToken: string; userToken?: string | null }) => Promise<{ success: boolean }>;
    loadTrack: (params: { trackId: string; startPositionSeconds?: number }) => Promise<{ success: boolean }>;
    play: () => Promise<{ success: boolean }>;
    pause: () => Promise<{ success: boolean }>;
    seek: (positionSeconds: number) => Promise<{ success: boolean }>;
    setVolume: (volume: number) => Promise<{ success: boolean }>;
    getPlaybackState: () => Promise<AppleMusicPlaybackState>;
};

const appleMusicEmitter = new NativeEventEmitter(AppleMusic);

const appleMusicApi: AppleMusicNativeType & {
    addListener: <T extends keyof AppleMusicEvents>(
        eventType: T,
        listener: AppleMusicEvents[T],
    ) => { remove: () => void };
} = {
    getDeveloperToken: () => AppleMusic.getDeveloperToken(),
    authorize: (params) => AppleMusic.authorize(params),
    unauthorize: () => AppleMusic.unauthorize(),
    configure: (params) => AppleMusic.configure(params),
    loadTrack: (params) => AppleMusic.loadTrack(params),
    play: () => AppleMusic.play(),
    pause: () => AppleMusic.pause(),
    seek: (positionSeconds) => AppleMusic.seek(positionSeconds),
    setVolume: (volume) => AppleMusic.setVolume(volume),
    getPlaybackState: () => AppleMusic.getPlaybackState(),
    addListener: <T extends keyof AppleMusicEvents>(eventType: T, listener: AppleMusicEvents[T]) => {
        const subscription = appleMusicEmitter.addListener(eventType, listener);
        return {
            remove: () => subscription.remove(),
        };
    },
};

export const useAppleMusicNative = (): typeof appleMusicApi => appleMusicApi;

export const appleMusicNative = appleMusicApi;

export default appleMusicApi;
