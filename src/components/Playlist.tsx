import { use$, useObservable } from "@legendapp/state/react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { controls, playerState$ } from "@/components/YouTubeMusicPlayer";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { cn } from "@/utils/cn";

export function Playlist() {
	const playerState = use$(playerState$);
	const localMusicState = use$(localMusicState$);
	const localPlayerState = use$(localPlayerState$);
	const clickedTrackIndex$ = useObservable<number | null>(null);
	const clickedTrackIndex = use$(clickedTrackIndex$);
	
	// Determine which playlist to show
	const isLocalFilesSelected = localMusicState.isLocalFilesSelected;
	const playlist = isLocalFilesSelected 
		? localMusicState.tracks.map((track, index) => ({
			title: track.title,
			artist: track.artist,
			duration: track.duration,
			thumbnail: track.thumbnail || "",
			index,
			isPlaying: index === localPlayerState.currentIndex && localPlayerState.isPlaying
		}))
		: playerState.playlist;
	
	const currentTrackIndex = isLocalFilesSelected ? localPlayerState.currentIndex : playerState.currentTrackIndex;

	const handleTrackClick = (index: number) => {
		clickedTrackIndex$.set(index);
		
		if (isLocalFilesSelected) {
			// Handle local file playback
			console.log("Playing local file at index:", index);
			const tracks = localMusicState.tracks;
			const track = tracks[index];
			
			if (track) {
				console.log("Playing:", track.title, "by", track.artist);
				// Load the entire playlist and start playing at the selected index
				localAudioControls.loadPlaylist(tracks, index);
			}
		} else {
			// Handle YouTube Music playback
			controls.playTrackAtIndex(index);
		}

		// Clear the clicked state after a short delay
		setTimeout(() => {
			clickedTrackIndex$.set(null);
		}, 1000);
	};

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
							: playerState.isLoading
								? "Loading playlist..."
								: "No playlist available"}
					</Text>
					<Text className="text-white/40 text-sm mt-2">
						{isLocalFilesSelected
							? "Add MP3 files to /Users/jay/Downloads/mp3"
							: "Navigate to YouTube Music and play a song"}
					</Text>
				</View>
			) : (
				<ScrollView showsVerticalScrollIndicator={false}>
					{playlist.map((track, index) => (
						<TouchableOpacity
							key={index}
							className={cn(
								"flex-row items-center px-4 py-2",
								index === currentTrackIndex
									? "bg-white/10"
									: clickedTrackIndex === index
										? "bg-orange-500/20"
										: "",
							)}
							onPress={() => handleTrackClick(index)}
						>
							<Text className="text-white/60 text-base w-8">{index + 1}</Text>

							{track.thumbnail ? (
								<Image
									source={{ uri: track.thumbnail }}
									className="size-9 rounded-lg"
									resizeMode="cover"
								/>
							) : (
								<View className="w-12 h-12 bg-white/20 rounded-lg ml-4 items-center justify-center">
									<Text className="text-white text-xs">♪</Text>
								</View>
							)}

							<View className="flex-1 ml-4 mr-8">
								<Text
									className="text-white text-sm font-medium"
									numberOfLines={1}
								>
									{track.title}
								</Text>
								<Text className="text-white/50 text-sm" numberOfLines={1}>
									{track.artist}
								</Text>
							</View>

							<Text className="text-white/60 text-base">{track.duration}</Text>
						</TouchableOpacity>
					))}
				</ScrollView>
			)}
		</View>
	);
}
