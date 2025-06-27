import { use$, useObservable } from "@legendapp/state/react";
import { useEffect } from "react";
import { Text, View } from "react-native";

import { Playlist } from "@/components/Playlist";
import { Select } from "@/components/Select";
import {
	controls,
	playerState$,
	type YTMusicPlaylist,
} from "@/components/YouTubeMusicPlayer";
import {
	localMusicState$,
	setCurrentPlaylist,
} from "@/systems/LocalMusicState";

export function PlaylistSelector() {
	const playerState = use$(playerState$);
	const localMusicState = use$(localMusicState$);

	// Create local files playlist
	const localFilesPlaylist: YTMusicPlaylist = {
		id: "LOCAL_FILES",
		title: "Local Files",
		thumbnail: "",
		trackCount: localMusicState.tracks.length,
		creator: "Local Library",
	};

	// Combine YouTube Music playlists with local files
	const availablePlaylists = [
		localFilesPlaylist,
		...playerState.availablePlaylists,
	];

	// Find currently selected playlist based on currentPlaylistId
	const currentPlaylistId = localMusicState.currentPlaylistId;
	const selectedPlaylist = availablePlaylists.find(
		(playlist) => playlist.id === currentPlaylistId,
	);

	const selectedPlaylist$ = useObservable<YTMusicPlaylist>(
		selectedPlaylist || undefined,
	);

	// Keep selectedPlaylist$ in sync with currentPlaylistId changes
	useEffect(() => {
		selectedPlaylist$.set(selectedPlaylist || undefined);
	}, [selectedPlaylist]);

	const handlePlaylistSelect = (playlist: YTMusicPlaylist) => {
		console.log("Navigating to playlist:", playlist.id);
		selectedPlaylist$.set(playlist);
		setCurrentPlaylist(playlist.id);

		if (playlist.id === "LOCAL_FILES") {
			// Handle local files selection
			console.log("Selected local files playlist");
		} else {
			// Handle YouTube Music playlists
			controls.navigateToPlaylist(playlist.id);
		}
	};

	return (
		<View className="mx-6 mb-3 bg-white/5 rounded-lg border border-white/10 flex-1">
			{/* Title bar area for playlist */}
			<View className="px-4 py-3 border-b border-white/10">
				<Select
					items={availablePlaylists}
					selected$={selectedPlaylist$}
					placeholder="Local Files"
					onSelectItem={handlePlaylistSelect}
					getItemKey={(playlist) => playlist.id}
					renderItem={(playlist, mode) => {
						if (mode === "preview") {
							return (
								<Text className="text-white/90 group-hover:text-white text-base font-semibold">
									{playlist.title}
								</Text>
							);
						}
						return (
							<View className="flex-row items-center w-80">
								<Text className="text-white text-base font-medium flex-1">
									{playlist.title}
								</Text>
							</View>
						);
					}}
					unstyled={true}
					showCaret={true}
					caretPosition="right"
					triggerClassName="hover:bg-white/10 rounded-md h-8 px-2"
					caretClassName="text-white/70 hover:text-white"
				/>
			</View>
			
			{/* Playlist content */}
			<View className="flex-1 px-2 pb-2">
				<Playlist />
			</View>
		</View>
	);
}
