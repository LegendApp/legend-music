import { use$, useObservable } from "@legendapp/state/react";
import { useEffect } from "react";
import { Text, View } from "react-native";

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
		<View className="mx-6 mt-4">
			<Select
				items={availablePlaylists}
				selected$={selectedPlaylist$}
				placeholder="Local Files"
				onSelectItem={handlePlaylistSelect}
				getItemKey={(playlist) => playlist.id}
				renderItem={(playlist) => (
					<View className="flex-row items-center w-80">
						<Text className="text-white text-base font-medium flex-1">
							{playlist.title}
						</Text>
					</View>
				)}
				renderItemText={(playlist) => playlist.title}
				className="rounded-2xl"
				unstyled={true}
				showCaret={true}
				caretPosition="right"
				triggerClassName="px-6 hover:bg-white/10 rounded-xl h-8"
				caretClassName="text-white/70 hover:text-white"
			/>
		</View>
	);
}
