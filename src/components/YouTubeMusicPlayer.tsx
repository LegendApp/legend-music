import { useObservable } from "@legendapp/state/react";
import React, { useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

interface Track {
	title: string;
	artist: string;
	duration: string;
	thumbnail: string;
	id?: string;
}

interface PlaylistTrack extends Track {
	isPlaying?: boolean;
	index: number;
}

interface YTMusicPlaylist {
	id: string;
	title: string;
	thumbnail?: string;
	trackCount?: number;
	creator?: string;
}

interface PlayerState {
	isPlaying: boolean;
	currentTrack: Track | null;
	currentTime: string;
	isLoading: boolean;
	error: string | null;
	playlist: PlaylistTrack[];
	currentTrackIndex: number;
	availablePlaylists: YTMusicPlaylist[];
	currentPlaylistId?: string;
}

const injectedJavaScript = `
(function() {
    let lastState = {};

    function extractAvailablePlaylists() {
        try {
            const playlists = [];

            // Strategy 1: Extract playlists from sidebar guide entries
            const sidebarPlaylists = document.querySelectorAll('ytmusic-guide-entry-renderer[play-button-state="default"]');

            sidebarPlaylists.forEach((element, index) => {
                const titleEl = element.querySelector('.title-column .title-group .title');
                const creatorEl = element.querySelector('.title-column .subtitle-group .subtitle');
                const thumbnailEl = element.querySelector('img');
                const linkEl = element.querySelector('tp-yt-paper-item[href]');

                if (titleEl) {
                    const title = titleEl.textContent?.trim() || '';
                    const creator = creatorEl?.textContent?.trim() || '';
                    const href = linkEl?.getAttribute('href') || '';

                    // Extract playlist ID from href (e.g., "playlist?list=PLnWuRxn_At6...")
                    let playlistId = 'sidebar_' + index;
                    if (href.includes('playlist?list=')) {
                        playlistId = href.split('playlist?list=')[1].split('&')[0];
                    } else if (href.includes('library/')) {
                        playlistId = href.split('library/')[1] || 'library';
                    }

                    if (title && title !== 'Home' && title !== 'Explore' && title !== 'Library') {
                        playlists.push({
                            id: playlistId,
                            title: title,
                            thumbnail: thumbnailEl?.src || '',
                            trackCount: 0,
                            creator: creator
                        });
                    }
                }
            });

            // Strategy 2: Extract playlists from main library grid
            const gridPlaylists = document.querySelectorAll('ytmusic-two-row-item-renderer');

            gridPlaylists.forEach((element, index) => {
                const titleEl = element.querySelector('.title-group .title a, .title-group .title');
                const thumbnailEl = element.querySelector('ytmusic-thumbnail-renderer img');
                const subtitleEl = element.querySelector('.substring-group .subtitle');
                const linkEl = element.querySelector('a[href*="playlist?list="]');

                if (titleEl) {
                    const title = titleEl.textContent?.trim() || '';
                    const subtitle = subtitleEl?.textContent?.trim() || '';

                    // Extract playlist ID from href
                    let playlistId = 'grid_' + index;
                    if (linkEl) {
                        const href = linkEl.getAttribute('href') || '';
                        if (href.includes('playlist?list=')) {
                            playlistId = href.split('playlist?list=')[1].split('&')[0];
                        }
                    }

                    // Extract track count from subtitle (e.g., "Playlist • Creator • 25 songs")
                    let trackCount = 0;
                    const trackMatch = subtitle.match(/(\d+)\s+(songs?|tracks?)/i);
                    if (trackMatch) {
                        trackCount = parseInt(trackMatch[1]) || 0;
                    }

                    // Extract creator from subtitle
                    let creator = '';
                    const creatorEl = subtitleEl?.querySelector('a[href*="channel/"]');
                    if (creatorEl) {
                        creator = creatorEl.textContent?.trim() || '';
                    }

                    if (title) {
                        playlists.push({
                            id: playlistId,
                            title: title,
                            thumbnail: thumbnailEl?.src || '',
                            trackCount: trackCount,
                            creator: creator
                        });
                    }
                }
            });

            // Strategy 3: Add Liked Music if not found
            const hasLikedMusic = playlists.some(p => p.id === 'LM' || p.title.toLowerCase().includes('liked'));
            if (!hasLikedMusic) {
                playlists.unshift({
                    id: 'LM',
                    title: 'Liked Music',
                    thumbnail: 'https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-music-@576.png',
                    trackCount: 0,
                    creator: ''
                });
            }

            // Remove duplicates based on ID
            const uniquePlaylists = playlists.filter((playlist, index, self) =>
                index === self.findIndex(p => p.id === playlist.id)
            );

            console.log('Found playlists:', uniquePlaylists.length, uniquePlaylists.map(p => p.title));
            return uniquePlaylists;
        } catch (error) {
            console.error('Error extracting playlists:', error);
            return [
                { id: 'LM', title: 'Liked Music', thumbnail: '', trackCount: 0, creator: '' },
                { id: 'history', title: 'History', thumbnail: '', trackCount: 0, creator: '' }
            ];
        }
    }

    function extractPlaylistInfo() {
        try {
            const playlist = [];
            let currentTrackIndex = -1;

            // Try strategies in order, use only the first one that returns results
            let items = [];
            let strategy = '';

            // Strategy 1: Try to get queue items (most reliable for current playlist)
            const allQueueItems = document.querySelectorAll('ytmusic-player-queue-item');
            const queueItems = Array.from(allQueueItems).filter(item => !item.closest('#counterpart-renderer'));
            if (queueItems.length > 0) {
                items = Array.from(queueItems);
                strategy = 'queue';
                console.log('Using ONLY queue items:', items.length);
            } else {
                // Strategy 2: Try to find playlist page items (when viewing a specific playlist)
                const playlistPageItems = document.querySelectorAll('ytmusic-playlist-shelf-renderer ytmusic-responsive-list-item-renderer');
                if (playlistPageItems.length > 0) {
                    items = Array.from(playlistPageItems);
                    strategy = 'playlist-page';
                    console.log('Using ONLY playlist page items:', items.length);
                } else {
                    // Strategy 3: Try to find Up Next section
                    const upNextItems = document.querySelectorAll('ytmusic-player-queue ytmusic-responsive-list-item-renderer');
                    if (upNextItems.length > 0) {
                        items = Array.from(upNextItems);
                        strategy = 'up-next';
                        console.log('Using ONLY up next items:', items.length);
                    } else {
                        // Strategy 4: Try general responsive list items (but be more selective)
                        const generalItems = document.querySelectorAll('ytmusic-shelf-renderer ytmusic-responsive-list-item-renderer');
                        if (generalItems.length > 0) {
                            items = Array.from(generalItems).slice(0, 20); // Limit to avoid too many items
                            strategy = 'general-shelf';
                            console.log('Using ONLY general shelf items:', items.length);
                        }
                    }
                }
            }

            // Process ALL items from the single selected source
            items.forEach((item, index) => {
                let titleEl, artistEl, durationEl;

                if (strategy === 'queue') {
                    // More specific selectors for queue items
                    titleEl = item.querySelector('.song-title, .title');
                    artistEl = item.querySelector('.byline a, .byline, .artist');
                    durationEl = item.querySelector('.duration-text, .duration');
                } else {
                    // General selectors for other strategies
                    titleEl = item.querySelector('.title-group .title a, .title-group .title, .title');
                    artistEl = item.querySelector('.subtitle-group .subtitle a, .byline a, .byline, .subtitle');
                    durationEl = item.querySelector('.duration, [class*="duration"], .time');
                }

                const thumbnailEl = item.querySelector('img');

                if (titleEl && artistEl) {
                    let title = titleEl.textContent?.trim() || '';
                    let artist = artistEl.textContent?.trim() || '';
                    const duration = durationEl?.textContent?.trim() || '';

                    // Clean up artist text (remove extra info like "• Album • Year")
                    if (artist.includes('•')) {
                        artist = artist.split('•')[0].trim();
                    }

                    // Only add if not empty and title != artist
                    if (title && artist && title !== artist) {
                        const isPlaying = item.classList.contains('playing') ||
                                        item.getAttribute('aria-selected') === 'true' ||
                                        item.classList.contains('selected') ||
                                        item.querySelector('[class*="playing"]') !== null;

                        playlist.push({
                            title: title,
                            artist: artist,
                            duration: duration,
                            thumbnail: thumbnailEl?.src || '',
                            index: index, // Use original index from the source
                            isPlaying: isPlaying
                        });

                        if (isPlaying) {
                            currentTrackIndex = playlist.length - 1;
                        }
                    }
                }
            });

            console.log('Final playlist (' + strategy + '):', playlist.length, 'items from single source');
            return { playlist, currentTrackIndex };
        } catch (error) {
            console.error('Error extracting playlist:', error);
            return { playlist: [], currentTrackIndex: -1 };
        }
    }

    function extractPlayerInfo() {
        try {
            // Get current track info
            const titleElement = document.querySelector('.title.style-scope.ytmusic-player-bar');
            const artistElement = document.querySelector('.byline.style-scope.ytmusic-player-bar');

            // Try multiple selectors for the current playing track image
            let thumbnailElement = document.querySelector('.thumbnail.style-scope.ytmusic-player img');
            if (!thumbnailElement) {
                // Alternative selectors for the player bar image
                thumbnailElement = document.querySelector('.image.style-scope.ytmusic-player-bar img');
            }
            if (!thumbnailElement) {
                thumbnailElement = document.querySelector('ytmusic-player-bar img');
            }
            if (!thumbnailElement) {
                thumbnailElement = document.querySelector('#player-bar img');
            }
            if (!thumbnailElement) {
                thumbnailElement = document.querySelector('.player-bar img');
            }
            if (!thumbnailElement) {
                // Try the mini player image
                thumbnailElement = document.querySelector('.mini-player img');
            }
            if (!thumbnailElement) {
                // Try any image in the player area
                thumbnailElement = document.querySelector('[class*="player"] img, [id*="player"] img');
            }

            // Get play/pause state
            const playButton = document.querySelector('#play-pause-button button');
            const isPlaying = playButton?.getAttribute('aria-label')?.includes('Pause') || false;

            // Get current time
            const timeElement = document.querySelector('#left-controls .time-info');
            const currentTime = timeElement?.textContent?.trim() || '0:00';

            // Get duration
            const durationElement = document.querySelector('#right-controls .time-info');
            const duration = durationElement?.textContent?.trim() || '0:00';

            // Get playlist info
            const { playlist, currentTrackIndex } = extractPlaylistInfo();

            // Get available playlists (only update occasionally to avoid performance issues)
            const availablePlaylists = extractAvailablePlaylists();

            // Get the best quality thumbnail URL
            let thumbnailUrl = '';
            if (thumbnailElement?.src) {
                thumbnailUrl = thumbnailElement.src;
                // Try to get higher quality version
                if (thumbnailUrl.includes('=w')) {
                    thumbnailUrl = thumbnailUrl.replace(/=w\d+-h\d+/, '=w500-h500');
                }
            }

            const currentState = {
                isPlaying,
                currentTrack: {
                    title: titleElement?.textContent?.trim() || '',
                    artist: artistElement?.textContent?.trim() || '',
                    duration: duration,
                    thumbnail: thumbnailUrl
                },
                currentTime,
                playlist,
                currentTrackIndex,
                availablePlaylists,
                currentPlaylistId: undefined, // Will be detected from current page
                isLoading: false,
                error: null
            };

            // Only send update if state changed
            if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'playerState',
                    data: currentState
                }));
                lastState = currentState;
            }
        } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                data: { error: error.message }
            }));
        }
    }

    // Control functions
    window.ytMusicControls = {
        playPause: function() {
            const button = document.querySelector('#play-pause-button button');
            if (button) {
                button.click();
                return true;
            }
            return false;
        },

        next: function() {
            const button = document.querySelector('.next-button button[aria-label="Next"]');
            if (button) {
                button.click();
                return true;
            }
            return false;
        },

        previous: function() {
            const button = document.querySelector('.previous-button button[aria-label="Previous"]');
            if (button) {
                button.click();
                return true;
            }
            return false;
        },

        setVolume: function(volume) {
            const slider = document.querySelector('#volume-slider input');
            if (slider) {
                slider.value = volume;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        },

        seek: function(seconds) {
            const progressBar = document.querySelector('#progress-bar input');
            if (progressBar) {
                progressBar.value = seconds;
                progressBar.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        },

        playTrackAtIndex: function(index) {
            console.log('Attempting to play track at index:', index);

            // Strategy 1: Try queue items first (most reliable)
            const queueItems = document.querySelectorAll('ytmusic-player-queue-item ytmusic-play-button-renderer');
            if (queueItems[index]) {
                console.log('Clicking queue item at index:', index);
                queueItems[index].click();
                return true;
            }

            // Strategy 2: Try up next items
            const upNextItems = document.querySelectorAll('ytmusic-player-queue ytmusic-responsive-list-item-renderer');
            if (upNextItems[index]) {
                console.log('Clicking up next item at index:', index);
                upNextItems[index].click();
                return true;
            }

            // Strategy 3: Try playlist page items
            const playlistItems = document.querySelectorAll('ytmusic-responsive-list-item-renderer');
            if (playlistItems[index]) {
                console.log('Clicking playlist item at index:', index);
                // Look for play button within the item
                const playButton = playlistItems[index].querySelector('[aria-label*="Play"], [title*="Play"], .play-button, [class*="play"]');
                if (playButton) {
                    playButton.click();
                    return true;
                } else {
                    // Fall back to clicking the item itself
                    playlistItems[index].click();
                    return true;
                }
            }

            // Strategy 4: Try to find any clickable music items
            const musicItems = document.querySelectorAll('[class*="music"], [class*="song"], [class*="track"]');
            if (musicItems[index]) {
                console.log('Clicking music item at index:', index);
                musicItems[index].click();
                return true;
            }

            // Strategy 5: Try to click any row-like items that might be tracks
            const rowItems = document.querySelectorAll('ytmusic-shelf-renderer ytmusic-responsive-list-item-renderer, [role="row"], .song-row, .track-row');
            if (rowItems[index]) {
                console.log('Clicking row item at index:', index);
                const playButton = rowItems[index].querySelector('[aria-label*="Play"], [title*="Play"]');
                if (playButton) {
                    playButton.click();
                } else {
                    rowItems[index].click();
                }
                return true;
            }

            console.log('Could not find track at index:', index);
            return false;
        },

        navigateToPlaylist: function(playlistId) {
            console.log('Navigating to playlist:', playlistId);

            try {
                // Strategy 0: Handle sidebar_ prefixed IDs by clicking at specific index
                if (playlistId.startsWith('sidebar_')) {
                    const index = parseInt(playlistId.split('sidebar_')[1]);
                    console.log('Clicking sidebar playlist at index:', index);

                    const sidebarPlaylists = document.querySelectorAll('ytmusic-guide-entry-renderer[play-button-state="default"]');
                    if (sidebarPlaylists[index]) {
                        const linkEl = sidebarPlaylists[index].querySelector('tp-yt-paper-item[href]');
                        if (linkEl) {
                            console.log('Found sidebar element at index', index, 'clicking...');
                            linkEl.click();
                            return true;
                        } else {
                            console.log('No clickable link found in sidebar element at index', index);
                            // Fallback: click the entire element
                            sidebarPlaylists[index].click();
                            return true;
                        }
                    } else {
                        console.log('No sidebar playlist found at index:', index);
                        return false;
                    }
                }

                // Strategy 1: Direct navigation using playlist ID if it looks like a real YouTube playlist ID
                if (playlistId.startsWith('PL') || playlistId === 'LM') {
                    const url = playlistId === 'LM' ?
                        '/library/liked_music' :
                        '/playlist?list=' + playlistId;
                    console.log('Direct navigation to:', url);

                    // Try multiple navigation methods
                    try {
                        window.location.assign(url);
                    } catch (e) {
                        console.log('location.assign failed, trying href:', e);
                        window.location.href = url;
                    }
                    return true;
                }

                // Strategy 2: Try to find and click the playlist in the sidebar
                console.log('Searching sidebar playlists...');
                const sidebarPlaylists = document.querySelectorAll('ytmusic-guide-entry-renderer[play-button-state="default"]');
                console.log('Found sidebar playlist elements:', sidebarPlaylists.length);

                for (let i = 0; i < sidebarPlaylists.length; i++) {
                    const element = sidebarPlaylists[i];
                    const linkEl = element.querySelector('tp-yt-paper-item[href]');
                    const href = linkEl?.getAttribute('href') || '';

                    console.log('Checking sidebar element', i, 'href:', href);

                    if (href.includes('playlist?list=' + playlistId) ||
                        href.includes(playlistId) ||
                        (playlistId === 'library' && href.includes('library/'))) {
                        console.log('Found matching sidebar playlist, clicking...');
                        linkEl?.click();
                        return true;
                    }
                }

                // Strategy 3: Try to find and click in the main grid
                console.log('Searching grid playlists...');
                const gridPlaylists = document.querySelectorAll('ytmusic-two-row-item-renderer a[href*="playlist?list="]');
                console.log('Found grid playlist elements:', gridPlaylists.length);

                for (let i = 0; i < gridPlaylists.length; i++) {
                    const element = gridPlaylists[i];
                    const href = element.getAttribute('href') || '';

                    console.log('Checking grid element', i, 'href:', href);

                    if (href.includes('playlist?list=' + playlistId)) {
                        console.log('Found matching grid playlist, clicking...');
                        element.click();
                        return true;
                    }
                }

                // Strategy 4: Navigate to common special playlists
                if (playlistId === 'LM' || playlistId.toLowerCase().includes('liked')) {
                    console.log('Navigating to liked music...');
                    try {
                        window.location.assign('/library/liked_music');
                    } catch (e) {
                        window.location.href = '/library/liked_music';
                    }
                    return true;
                } else if (playlistId.toLowerCase().includes('history')) {
                    console.log('Navigating to history...');
                    try {
                        window.location.assign('/library/history');
                    } catch (e) {
                        window.location.href = '/library/history';
                    }
                    return true;
                } else if (playlistId.toLowerCase().includes('queue')) {
                    console.log('Trying to open queue...');
                    const queueButton = document.querySelector('[aria-label*="Queue"], [title*="Queue"], #player-queue-button');
                    if (queueButton) {
                        queueButton.click();
                        return true;
                    }
                }

                // Strategy 5: Last resort - try to navigate to any playlist with matching ID parts
                console.log('Last resort: trying partial ID match navigation...');
                if (playlistId.length > 3) {
                    const url = '/playlist?list=' + playlistId;
                    console.log('Attempting navigation to:', url);
                    try {
                        window.location.assign(url);
                    } catch (e) {
                        window.location.href = url;
                    }
                    return true;
                }

                console.log('Could not navigate to playlist:', playlistId);
                return false;
            } catch (error) {
                console.error('Error in navigateToPlaylist:', error);
                return false;
            }
        }
    };

    // Initial extraction
    extractPlayerInfo();

    // Set up observers for dynamic content
    const observer = new MutationObserver(function(mutations) {
        let shouldUpdate = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                shouldUpdate = true;
            }
        });
        if (shouldUpdate) {
            setTimeout(extractPlayerInfo, 100);
        }
    });

    // Observe the player bar for changes
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (playerBar) {
        observer.observe(playerBar, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-label', 'title']
        });
    }

    // Periodic updates as fallback
    setInterval(extractPlayerInfo, 1000);

    // Signal that injection is complete
    window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'injectionComplete',
        data: { success: true }
    }));
})();
`;

// Create observable player state outside component for global access
const playerState$ = useObservable<PlayerState>({
	isPlaying: false,
	currentTrack: null,
	currentTime: "0:00",
	isLoading: true,
	error: null,
	playlist: [],
	currentTrackIndex: -1,
	availablePlaylists: [],
	currentPlaylistId: undefined,
});

let webViewRef: React.MutableRefObject<WebView | null> | null = null;

const executeCommand = (command: string, ...args: any[]) => {
	const script = `window.ytMusicControls.${command}(${args.map((arg) => JSON.stringify(arg)).join(", ")}); true;`;
	webViewRef?.current?.injectJavaScript(script);
};

// Expose control methods
const controls = {
	playPause: () => executeCommand("playPause"),
	next: () => executeCommand("next"),
	previous: () => executeCommand("previous"),
	setVolume: (volume: number) => executeCommand("setVolume", volume),
	seek: (seconds: number) => executeCommand("seek", seconds),
	playTrackAtIndex: (index: number) =>
		executeCommand("playTrackAtIndex", index),
	navigateToPlaylist: (playlistId: string) =>
		executeCommand("navigateToPlaylist", playlistId),
};

export function YouTubeMusicPlayer() {
	const localWebViewRef = useRef<WebView>(null);

	// Set the global ref to this instance
	React.useEffect(() => {
		webViewRef = localWebViewRef;
		return () => {
			webViewRef = null;
		};
	}, []);

	const handleMessage = (event: any) => {
		try {
			const message = JSON.parse(event.nativeEvent.data);

			console.log({ message });

			switch (message.type) {
				case "playerState":
					playerState$.assign(message.data);
					break;
				case "error":
					playerState$.error.set(message.data.error);
					playerState$.isLoading.set(false);
					break;
				case "injectionComplete":
					playerState$.isLoading.set(false);
					break;
			}
		} catch (error) {
			console.error("Failed to parse WebView message:", error);
			playerState$.error.set("Failed to parse player message");
		}
	};

	return (
		<View className="flex-1">
			<WebView
				ref={localWebViewRef}
				source={{ uri: "https://music.youtube.com" }}
				javaScriptEnabled={true}
				webviewDebuggingEnabled
				domStorageEnabled={true}
				startInLoadingState={true}
				mixedContentMode="compatibility"
				allowsInlineMediaPlayback={true}
				mediaPlaybackRequiresUserAction={false}
				injectedJavaScript={injectedJavaScript}
				onMessage={handleMessage}
				onLoadStart={() => playerState$.isLoading.set(true)}
				onLoadEnd={() => {
					// Injection will set loading to false
				}}
				onError={(error) => {
					playerState$.error.set(
						`WebView error: ${error.nativeEvent.description}`,
					);
					playerState$.isLoading.set(false);
				}}
				userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) LegendMusic/1.0 Gecko/20100101 Firefox/123.0"
				className="flex-1"
			/>
		</View>
	);
}

// Export player state and controls for use in other components
export { playerState$, controls };
export type { Track, PlaylistTrack, PlayerState, YTMusicPlaylist };
