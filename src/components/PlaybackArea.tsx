import { use$ } from "@legendapp/state/react";
import { Image, Text, TouchableOpacity, View } from "react-native";

import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { controls, playerState$ } from "@/components/YouTubeMusicPlayer";
import { localMusicState$ } from "@/systems/LocalMusicState";

export function PlaybackArea() {
	const playerState = use$(playerState$);
	const localMusicState = use$(localMusicState$);
	const localPlayerState = use$(localPlayerState$);

	// Determine if we're using local files or YouTube Music
	const isLocalFilesSelected = localMusicState.isLocalFilesSelected;
	
	// Use appropriate state based on current selection
	const currentTrack = isLocalFilesSelected ? localPlayerState.currentTrack : playerState.currentTrack;
	const isLoading = isLocalFilesSelected ? localPlayerState.isLoading : playerState.isLoading;
	const isPlaying = isLocalFilesSelected ? localPlayerState.isPlaying : playerState.isPlaying;
	const currentTime = isLocalFilesSelected ? 
		formatTime(localPlayerState.currentTime) : 
		playerState.currentTime;
	const currentTimeSeconds = isLocalFilesSelected ? localPlayerState.currentTime : 0;
	const duration = isLocalFilesSelected ? localPlayerState.duration : 0;
	const formattedDuration = isLocalFilesSelected ? formatTime(duration) : "";
	
	// Format time for local playback
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	return (
		<View className="mx-6 mt-8">
			<View className="flex-row items-center">
				{/* Album Art */}
				<View className="size-16 bg-orange-300 rounded-xl items-center justify-center mr-4">
					{currentTrack?.thumbnail ? (
						<Image
							source={{ uri: currentTrack.thumbnail }}
							className="w-full h-full rounded-xl"
							resizeMode="cover"
						/>
					) : (
						<Text className="text-white text-lg">♪</Text>
					)}
				</View>

				{/* Song Info */}
				<View className="flex-1 flex-col">
					<Text className="text-white text-lg font-semibold" numberOfLines={1}>
						{currentTrack?.title || (isLoading ? "Loading..." : "No track")}
					</Text>
					<Text className="text-white/70 text-base" numberOfLines={1}>
						{currentTrack?.artist || ""}
					</Text>
					{currentTrack && (
						<Text className="text-white/50 text-sm mt-1">
							{currentTime}
						</Text>
					)}
				</View>

				{/* Playback Controls */}
				<View className="flex-row items-center gap-x-1 ml-4">
					<TouchableOpacity
						className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"
						onPress={isLocalFilesSelected ? localAudioControls.playPrevious : controls.previous}
						disabled={isLoading}
					>
						<Text className="text-white text-sm">⏮</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-8 h-8 bg-white/30 rounded-full items-center justify-center"
						onPress={isLocalFilesSelected ? localAudioControls.togglePlayPause : controls.playPause}
						disabled={isLoading}
					>
						<Text className="text-white text-base">
							{isLoading ? "..." : isPlaying ? "⏸" : "▶"}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"
						onPress={isLocalFilesSelected ? localAudioControls.playNext : controls.next}
						disabled={isLoading}
					>
						<Text className="text-white text-sm">⏭</Text>
					</TouchableOpacity>
				</View>
			</View>
			
			{/* Progress Slider - always visible */}
			<View className="mt-4">
				<CustomSlider
					style={{ height: 40 }}
					minimumValue={0}
					maximumValue={duration || 100}
					value={currentTimeSeconds}
					onSlidingComplete={(value) => {
						if (isLocalFilesSelected) {
							localAudioControls.seek(value);
						}
					}}
					minimumTrackTintColor="#ffffff"
					maximumTrackTintColor="#ffffff40"
					disabled={!isLocalFilesSelected || !currentTrack}
				/>
				<View className="flex-row justify-between mt-1">
					<Text className="text-white/60 text-sm">{currentTime || "0:00"}</Text>
					<Text className="text-white/60 text-sm">{formattedDuration || "0:00"}</Text>
				</View>
			</View>
		</View>
	);
}
