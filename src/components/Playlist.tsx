import { LegendList } from "@legendapp/list";
import { use$, useSelector } from "@legendapp/state/react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { controls, playbackState$, playlistState$, playlistsState$ } from "@/components/YouTubeMusicPlayer";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { getPlaylistContent } from "@/systems/PlaylistContent";
import { playlistsData$ } from "@/systems/Playlists";
import { settings$ } from "@/systems/Settings";
import { state$, stateSaved$ } from "@/systems/State";
import { cn } from "@/utils/cn";
import { formatSecondsToMmSs } from "@/utils/m3u";

interface PlaylistTrack {
    id: string;
    title: string;
    artist: string;
    duration: string;
    thumbnail: string;
    index: number;
    isPlaying?: boolean;
    isSeparator?: boolean;
    fromSuggestions?: boolean;
}

interface TrackItemProps {
    track: PlaylistTrack;
    index: number;
    // currentTrackIndex: number;
    // clickedTrackIndex: number | null;
    onTrackClick: (index: number) => void;
}

const TrackItem = ({ track, index, onTrackClick }: TrackItemProps) => {
    const localMusicState = use$(localMusicState$);
    const playbackState = use$(playbackState$);
    const localPlayerState = use$(localPlayerState$);
    
    const isPlaying = useSelector(() => {
        // For local files, check local player state
        if (localMusicState.isLocalFilesSelected) {
            const currentTrack = localPlayerState$.currentTrack.get();
            return currentTrack === track || currentTrack?.id === track.id;
        }
        
        // For YouTube Music tracks, check if title and artist match
        const currentTrack = playbackState$.currentTrack.get();
        if (currentTrack && track.title && track.artist) {
            return currentTrack.title === track.title && currentTrack.artist === track.artist;
        }
        
        return false;
    });

    const playlistStyle = use$(settings$.general.playlistStyle);

    // Handle separator items
    if (track.isSeparator) {
        return (
            <View className="flex-row items-center px-4 py-4 mt-6 mb-2">
                <View className="flex-1 h-px bg-white/15" />
                <Text className="text-white/90 text-xs font-semibold tracking-wider uppercase mx-4 bg-white/5 px-3 py-1.5 rounded-full border border-white/15">
                    {track.title.replace(/^— (.+) —$/, "$1")}
                </Text>
                <View className="flex-1 h-px bg-white/15" />
            </View>
        );
    }

    // Compact mode: single line format "${number}. ${artist} - ${song}"
    if (playlistStyle === "compact") {
        return (
            <Button
                className={cn(
                    "flex-row items-center px-3 py-1",
                    // Playing state styling
                    isPlaying ? "bg-blue-500/20 border-blue-400/30" : "",
                    "hover:bg-white/10 active:bg-white/15 border border-transparent hover:border-white/10",
                    // Suggestions styling
                    track.fromSuggestions ? "opacity-75" : "",
                )}
                onPress={() => onTrackClick(index)}
            >
                <View className="min-w-7">
                    <Text className="tabular-nums text-text-tertiary text-sm">
                        {track.index >= 0 ? `${track.index + 1}.  ` : ""}
                    </Text>
                </View>
                <Text
                    className={cn(
                        "flex-1 tabular-nums min-w-32 text-sm",
                        track.fromSuggestions ? "text-white/70" : "text-text-primary",
                    )}
                    numberOfLines={1}
                >
                    <Text className="text-text-primary font-medium">{track.artist}</Text>
                    <Text className="text-text-secondary text-sm"> - {track.title}</Text>
                </Text>

                <Text className={cn("text-xs ml-4", track.fromSuggestions ? "text-white/40" : "text-text-tertiary")}>
                    {track.duration}
                </Text>
            </Button>
        );
    }

    // Comfortable mode: current existing layout
    return (
        <Button
            className={cn(
                "flex-row items-center px-3 py-1",
                // Playing state styling
                isPlaying ? "bg-blue-500/20 border-blue-400/30" : "",
                "hover:bg-white/10 active:bg-white/15 border border-transparent hover:border-white/10",
                // Suggestions styling
                track.fromSuggestions ? "opacity-75" : "",
            )}
            onPress={() => onTrackClick(index)}
        >
            <Text className={cn("text-base w-8", track.fromSuggestions ? "text-white/40" : "text-white/60")}>
                {track.index >= 0 ? track.index + 1 : ""}
            </Text>

            {track.thumbnail ? (
                <Image source={{ uri: track.thumbnail }} className="size-9 rounded-lg" resizeMode="cover" />
            ) : (
                <View className="w-12 h-12 bg-white/20 rounded-lg items-center justify-center">
                    <Text className="text-white text-xs">♪</Text>
                </View>
            )}

            <View className="flex-1 ml-4 mr-8">
                <Text
                    className={cn("text-sm font-medium", track.fromSuggestions ? "text-white/70" : "text-white")}
                    numberOfLines={1}
                >
                    {track.title}
                </Text>
                <Text
                    className={cn("text-sm", track.fromSuggestions ? "text-white/40" : "text-white/50")}
                    numberOfLines={1}
                >
                    {track.artist}
                </Text>
            </View>

            <Text className={cn("text-base", track.fromSuggestions ? "text-white/40" : "text-white/60")}>
                {track.duration}
            </Text>
        </Button>
    );
};

type PlaylistTrackWithSuggestions = PlaylistTrack & {
    fromSuggestions?: true;
    isSeparator?: boolean;
};

export function Playlist() {
    const playbackState = use$(playbackState$);
    const playlistState = use$(playlistState$);
    const playlistsState = use$(playlistsState$);
    const localMusicState = use$(localMusicState$);
    const localPlayerState = use$(localPlayerState$);
    const playlistsData = use$(playlistsData$);
    const stateSaved = use$(stateSaved$);
    // const clickedTrackIndex$ = useObservable<number | null>(null);
    // const clickedTrackIndex = use$(clickedTrackIndex$);

    // Determine which playlist to show
    const isLocalFilesSelected = localMusicState.isLocalFilesSelected;

    // Get cached playlist content for the currently selected playlist
    const selectedPlaylistId = stateSaved.playlist;
    const selectedPlaylist = selectedPlaylistId ? playlistsData.playlistsYtm[selectedPlaylistId] : null;
    const cachedPlaylistContent$ = selectedPlaylist ? getPlaylistContent(selectedPlaylist.id) : null;
    const cachedPlaylistContent = use$(cachedPlaylistContent$);

    const playlist: PlaylistTrackWithSuggestions[] = isLocalFilesSelected
        ? localMusicState.tracks.map((track, index) => ({
              id: track.id,
              title: track.title,
              artist: track.artist,
              duration: track.duration,
              thumbnail: track.thumbnail || "",
              index,
              isPlaying: index === localPlayerState.currentIndex && localPlayerState.isPlaying,
          }))
        : (() => {
              // Use live data from YouTube Music if available, otherwise fall back to cached data
              let songs: PlaylistTrackWithSuggestions[] = [];
              let suggestions: PlaylistTrackWithSuggestions[] = [];

              if (playlistState.songs.length > 0) {
                  // Use live data
                  songs = playlistState.songs;
                  suggestions = playlistState.suggestions.map((track, index) => ({
                      ...track,
                      index: playlistState.songs.length + index,
                      fromSuggestions: true,
                  }));
              } else if (cachedPlaylistContent?.songs || cachedPlaylistContent?.suggestions) {
                  // Transform cached M3U data to PlaylistTrack format
                  songs = (cachedPlaylistContent.songs || []).map((track, index) => ({
                      id: track.id,
                      title: track.title,
                      artist: track.artist || "",
                      duration: formatSecondsToMmSs(track.duration),
                      thumbnail: track.logo || "",
                      index,
                      isPlaying: false,
                  }));

                  suggestions = (cachedPlaylistContent.suggestions || []).map((track, index) => ({
                      id: track.id,
                      title: track.title,
                      artist: track.artist || "",
                      duration: formatSecondsToMmSs(track.duration),
                      thumbnail: track.logo || "",
                      index: songs.length + index,
                      isPlaying: false,
                      fromSuggestions: true,
                  }));
              }

              return [
                  ...songs,
                  ...(suggestions.length > 0
                      ? [
                            // Add a separator item
                            {
                                id: "separator",
                                title: "— Suggestions —",
                                artist: "",
                                duration: "",
                                thumbnail: "",
                                index: -1,
                                isPlaying: false,
                                isSeparator: true,
                            },
                            ...suggestions,
                        ]
                      : []),
              ];
          })();

    const handleTrackClick = (index: number) => {
        const track = playlist[index];

        // Don't allow clicking on separator items
        if (track?.isSeparator) {
            return;
        }

        // clickedTrackIndex$.set(index);

        if (isLocalFilesSelected) {
            // Handle local file playback
            console.log("Playing local file at index:", index);
            const tracks = localMusicState.tracks;
            const localTrack = tracks[index];

            if (localTrack) {
                console.log("Playing:", localTrack.title, "by", localTrack.artist);
                // Load the entire playlist and start playing at the selected index
                localAudioControls.loadPlaylist(tracks, index);
            }
        } else {
            // Handle YouTube Music playback - use playTrackAtIndex for proper track selection
            if (track?.fromSuggestions || !track?.id) {
                // For suggestions, use playTrackAtIndex to play them
                console.log("Playing suggestion at index:", index, "track:", track.title);
                controls.playTrackAtIndex(index);
            } else {
                // For regular playlist tracks, set the songId and start playing
                if (track?.id) {
                    state$.songId.set(track.id);
                    playbackState$.pendingPlay.set(true);
                    console.log(
                        "Set songId:",
                        track.id,
                        "for track:",
                        track.title,
                        "and will start playback when page loads",
                    );
                } else {
                    console.warn("Track missing ID, cannot set songId:", track);
                }
            }
        }

        // Clear the clicked state after a short delay
        // setTimeout(() => {
        //     clickedTrackIndex$.set(null);
        // }, 1000);
    };

    // Check if we have playlists available to show
    const hasAvailablePlaylists = isLocalFilesSelected
        ? localMusicState.tracks.length > 0
        : playlistsState.availablePlaylists.length > 0;

    return (
        <View className="flex-1">
            {playlist.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-white/60 text-base">
                        {isLocalFilesSelected
                            ? localMusicState.isScanning
                                ? `Scanning... ${localMusicState.scanProgress}/${localMusicState.scanTotal}`
                                : localMusicState.error
                                  ? "Error scanning local files"
                                  : "No local MP3 files found"
                            : !hasAvailablePlaylists && playbackState.isLoading
                              ? "Loading playlist..."
                              : hasAvailablePlaylists
                                ? "Select a playlist to view tracks"
                                : "No playlist available"}
                    </Text>
                    <Text className="text-white/40 text-sm mt-2">
                        {isLocalFilesSelected
                            ? "Add MP3 files to /Users/jay/Downloads/mp3"
                            : hasAvailablePlaylists
                              ? "Choose a playlist from the dropdown above"
                              : "Navigate to YouTube Music and play a song"}
                    </Text>
                </View>
            ) : (
                <LegendList
                    data={playlist}
                    keyExtractor={(item, index) => `track-${index}`}
                    contentContainerStyle={styles.container}
                    recycleItems
                    renderItem={({ item: track, index }) => (
                        <TrackItem key={index} track={track} index={index} onTrackClick={handleTrackClick} />
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 4,
    },
});
