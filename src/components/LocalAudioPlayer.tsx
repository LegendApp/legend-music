import { observable } from "@legendapp/state";
import { useEffect } from "react";
import { View } from "react-native";
import { useAudioPlayer } from "@/native-modules/AudioPlayer";
import type { LocalTrack } from "@/systems/LocalMusicState";

interface LocalPlayerState {
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
const localPlayerState$ = observable<LocalPlayerState>({
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
const localAudioControls = {
    loadTrack: async (filePath: string, title: string, artist: string) => {
        console.log("Loading track:", filePath, title, artist);
        const track = {
            filePath,
            title,
            artist,
            duration: "0:00",
            id: `local_${Date.now()}`,
            fileName: title,
        };
        localPlayerState$.currentTrack.set(track);
        localPlayerState$.isLoading.set(true);
        localPlayerState$.error.set(null);

        if (audioPlayer) {
            try {
                const result = await audioPlayer.loadTrack(filePath);
                if (result.success) {
                    console.log("sucess");
                    localAudioControls.play();
                } else {
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
        console.log("Loading playlist:", playlist.length, "tracks, starting at index:", startIndex);
        currentPlaylist = playlist;
        localPlayerState$.currentIndex.set(startIndex);

        if (playlist.length > 0 && startIndex < playlist.length) {
            const track = playlist[startIndex];
            localAudioControls.loadTrack(track.filePath, track.title, track.artist);
        }
    },

    play: async () => {
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
        if (audioPlayer) {
            try {
                await audioPlayer.pause();
            } catch (error) {
                console.error("Error pausing:", error);
            }
        }
    },

    togglePlayPause: async () => {
        const isPlaying = localPlayerState$.isPlaying.get();
        if (isPlaying) {
            await localAudioControls.pause();
        } else {
            await localAudioControls.play();
        }
    },

    playPrevious: () => {
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
        if (currentPlaylist.length > 0 && index >= 0 && index < currentPlaylist.length) {
            localPlayerState$.currentIndex.set(index);
            const track = currentPlaylist[index];
            localAudioControls.loadTrack(track.filePath, track.title, track.artist);
            console.log("Playing track:", track.title);
            // Auto-play after loading
            setTimeout(() => localAudioControls.play(), 100);
        }
    },

    setVolume: async (volume: number) => {
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

    // Set global reference
    useEffect(() => {
        audioPlayer = player;
        return () => {
            audioPlayer = null;
        };
    }, [player]);

    // Set up event listeners
    useEffect(() => {
        const listeners = [
            player.addListener("onLoadSuccess", (data) => {
                console.log("Audio loaded successfully:", data);
                localPlayerState$.duration.set(data.duration);
                localPlayerState$.isLoading.set(false);
                localPlayerState$.error.set(null);
            }),

            player.addListener("onLoadError", (data) => {
                console.error("Audio load error:", data.error);
                localPlayerState$.error.set(data.error);
                localPlayerState$.isLoading.set(false);
                localPlayerState$.isPlaying.set(false);
            }),

            player.addListener("onPlaybackStateChanged", (data) => {
                console.log("Playback state changed:", data.isPlaying);
                localPlayerState$.isPlaying.set(data.isPlaying);
            }),

            player.addListener("onProgress", (data) => {
                localPlayerState$.currentTime.set(data.currentTime);
                localPlayerState$.duration.set(data.duration);
            }),

            player.addListener("onCompletion", () => {
                console.log("Track completed, playing next if available");
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

// Export player state and controls for use in other components
export { localAudioControls, localPlayerState$ };
export type { LocalPlayerState };
