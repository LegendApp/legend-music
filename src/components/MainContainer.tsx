import "@/../global.css";
import { View } from "react-native";

import { LocalAudioPlayer } from "@/components/LocalAudioPlayer";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { YouTubeMusicPlayer } from "@/components/YouTubeMusicPlayer";

const ShowYTM = false;

export function MainContainer() {
	return (
		<View className="flex-1 flex-row items-stretch">
			<View className="flex-1">
				<PlaybackArea />
				<PlaylistSelector />
				<Playlist />
			</View>
			<View className={ShowYTM ? "flex-1" : "absolute -z-10 inset-0 hidden"}>
				<YouTubeMusicPlayer />
			</View>
			<LocalAudioPlayer />
		</View>
	);
}
