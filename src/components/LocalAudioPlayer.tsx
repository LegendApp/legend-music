import { observable } from "@legendapp/state";
import { useEffect } from "react";
import { View } from "react-native";
import { useAudioPlayer } from "@/native-modules/AudioPlayer";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { perfCount, perfDelta, perfLog } from "@/utils/perfLogger";

export interface LocalPlayerState {
    isPlaying: boolean;
    currentTrack: LocalTrack | null;
    currentTime: number;
    duration: number;
    volume: number;
    isLoading: boolean;
    error: string | null;
    currentIndex: number;
}

// Create observable player state for local music
export const localPlayerState$ = observable<LocalPlayerState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    volume: 0.5,
    isLoading: true,
    error: null,
    currentIndex: -1,
});

let currentPlaylist: LocalTrack[] = [];
let audioPlayer: ReturnType<typeof useAudioPlayer> | null = null;

// Expose control methods for local audio
export const localAudioControls = {
    loadTrack: async (filePath: string, title: string, artist: string) => {
        perfLog("LocalAudioControls.loadTrack", { filePath, title, artist });
        if (__DEV__) {
            console.log("Loading track:", filePath, title, artist);
        }
        const track = {
            id: filePath,
            filePath,
            title,
            artist,
            duration: "0:00",

            fileName: title,
        };
        localPlayerState$.currentTrack.set(track);
        localPlayerState$.isLoading.set(true);
        localPlayerState$.error.set(null);

        if (audioPlayer) {
            try {
                const result = await audioPlayer.loadTrack(filePath);
                if (result.success) {
                    perfLog("LocalAudioControls.loadTrack.success", { filePath });
                    if (__DEV__) {
                        console.log("Track loaded successfully");
                    }
                    localAudioControls.play();
                } else {
                    perfLog("LocalAudioControls.loadTrack.error", result.error ?? "unknown");
                    localPlayerState$.error.set(result.error || "Failed to load track");
                    localPlayerState$.isLoading.set(false);
                }
            } catch (error) {
                console.error("Error loading track:", error);
                localPlayerState$.error.set(error instanceof Error ? error.message : "Unknown error");
                localPlayerState$.isLoading.set(false);
            }
        }
    },

    loadPlaylist: (playlist: LocalTrack[], startIndex = 0) => {
        perfLog("LocalAudioControls.loadPlaylist", { length: playlist.length, startIndex });
        console.log("Loading playlist:", playlist.length, "tracks, starting at index:", startIndex);
        currentPlaylist = playlist;
        localPlayerState$.currentIndex.set(startIndex);

        if (playlist.length > 0 && startIndex < playlist.length) {
            const track = playlist[startIndex];
            localAudioControls.loadTrack(track.filePath, track.title, track.artist);
        }
    },

    play: async () => {
        perfLog("LocalAudioControls.play");
        if (audioPlayer) {
            try {
                await audioPlayer.play();
            } catch (error) {
                console.error("Error playing:", error);
                localPlayerState$.error.set(error instanceof Error ? error.message : "Play failed");
            }
        }
    },

    pause: async () => {
        perfLog("LocalAudioControls.pause");
        if (audioPlayer) {
            try {
                await audioPlayer.pause();
            } catch (error) {
                console.error("Error pausing:", error);
            }
        }
    },

    togglePlayPause: async () => {
        perfLog("LocalAudioControls.togglePlayPause", { isPlaying: localPlayerState$.isPlaying.get() });
        const isPlaying = localPlayerState$.isPlaying.get();
        if (isPlaying) {
            await localAudioControls.pause();
        } else {
            await localAudioControls.play();
        }
    },

    playPrevious: () => {
        perfLog("LocalAudioControls.playPrevious", {
            currentIndex: localPlayerState$.currentIndex.get(),
            playlistLength: currentPlaylist.length,
        });
        const currentIndex = localPlayerState$.currentIndex.get();
        if (currentPlaylist.length > 0 && currentIndex > 0) {
            const newIndex = currentIndex - 1;
            localPlayerState$.currentIndex.set(newIndex);
            const track = currentPlaylist[newIndex];
            localAudioControls.loadTrack(track.filePath, track.title, track.artist);
            // Auto-play will be handled by the load success event
        }
    },

    playNext: () => {
        perfLog("LocalAudioControls.playNext", {
            currentIndex: localPlayerState$.currentIndex.get(),
            playlistLength: currentPlaylist.length,
        });
        const currentIndex = localPlayerState$.currentIndex.get();
        if (currentPlaylist.length > 0 && currentIndex < currentPlaylist.length - 1) {
            const newIndex = currentIndex + 1;
            localPlayerState$.currentIndex.set(newIndex);
            const track = currentPlaylist[newIndex];
            localAudioControls.loadTrack(track.filePath, track.title, track.artist);
            // Auto-play will be handled by the load success event
        }
    },

    playTrackAtIndex: (index: number) => {
        perfLog("LocalAudioControls.playTrackAtIndex", { index, playlistLength: currentPlaylist.length });
        if (currentPlaylist.length > 0 && index >= 0 && index < currentPlaylist.length) {
            localPlayerState$.currentIndex.set(index);
            const track = currentPlaylist[index];
            localAudioControls.loadTrack(track.filePath, track.title, track.artist);
            if (__DEV__) {
                console.log("Playing track:", track.title);
            }
            // Auto-play after loading
            setTimeout(() => localAudioControls.play(), 100);
        }
    },

    setVolume: async (volume: number) => {
        perfLog("LocalAudioControls.setVolume", { volume });
        const clampedVolume = Math.max(0, Math.min(1, volume));
        localPlayerState$.volume.set(clampedVolume);
        if (audioPlayer) {
            try {
                await audioPlayer.setVolume(clampedVolume);
            } catch (error) {
                console.error("Error setting volume:", error);
            }
        }
    },

    seek: async (seconds: number) => {
        perfLog("LocalAudioControls.seek", { seconds });
        if (audioPlayer) {
            try {
                await audioPlayer.seek(seconds);
            } catch (error) {
                console.error("Error seeking:", error);
            }
        }
    },

    getCurrentState: () => {
        return localPlayerState$.get();
    },
};

export function LocalAudioPlayer() {
    const player = useAudioPlayer();
    perfCount("LocalAudioPlayer.render");

    // Set global reference
    useEffect(() => {
        perfLog("LocalAudioPlayer.useEffect[player]", { hasPlayer: !!player });
        audioPlayer = player;
        return () => {
            perfLog("LocalAudioPlayer.cleanup[player]");
            audioPlayer = null;
        };
    }, [player]);

    // Set up event listeners
    useEffect(() => {
        const listeners = [
            player.addListener("onLoadSuccess", (data) => {
                perfCount("LocalAudioPlayer.onLoadSuccess");
                const delta = perfDelta("LocalAudioPlayer.onLoadSuccess");
                perfLog("LocalAudioPlayer.onLoadSuccess", { delta, data });
                if (__DEV__) {
                    console.log("Audio loaded successfully:", data);
                }
                localPlayerState$.duration.set(data.duration);
                localPlayerState$.isLoading.set(false);
                localPlayerState$.error.set(null);
            }),

            player.addListener("onLoadError", (data) => {
                perfCount("LocalAudioPlayer.onLoadError");
                const delta = perfDelta("LocalAudioPlayer.onLoadError");
                perfLog("LocalAudioPlayer.onLoadError", { delta, data });
                console.error("Audio load error:", data.error);
                localPlayerState$.error.set(data.error);
                localPlayerState$.isLoading.set(false);
                localPlayerState$.isPlaying.set(false);
            }),

            player.addListener("onPlaybackStateChanged", (data) => {
                perfCount("LocalAudioPlayer.onPlaybackStateChanged");
                const delta = perfDelta("LocalAudioPlayer.onPlaybackStateChanged");
                perfLog("LocalAudioPlayer.onPlaybackStateChanged", { delta, data });
                if (__DEV__) {
                    console.log("Playback state changed:", data.isPlaying);
                }
                localPlayerState$.isPlaying.set(data.isPlaying);
            }),

            player.addListener("onProgress", (data) => {
                perfCount("LocalAudioPlayer.onProgress");
                const delta = perfDelta("LocalAudioPlayer.onProgress");
                perfLog("LocalAudioPlayer.onProgress", { delta, current: data.currentTime, duration: data.duration });
                localPlayerState$.currentTime.set(data.currentTime);
                if (data.duration !== localPlayerState$.duration.peek()) {
                    localPlayerState$.duration.set(data.duration);
                }
            }),

            player.addListener("onCompletion", () => {
                perfCount("LocalAudioPlayer.onCompletion");
                const delta = perfDelta("LocalAudioPlayer.onCompletion");
                perfLog("LocalAudioPlayer.onCompletion", { delta });
                if (__DEV__) {
                    console.log("Track completed, playing next if available");
                }
                localPlayerState$.isPlaying.set(false);
                localAudioControls.playNext();
            }),
        ];

        return () => {
            listeners.forEach((listener) => listener.remove());
        };
    }, [player]);

    return <View className="w-0 h-0 opacity-0 absolute" />;
}
