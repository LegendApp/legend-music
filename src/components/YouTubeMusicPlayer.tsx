import { batch, observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { getPlaylistContent } from "@/systems/PlaylistContent";
import {
    addPlaylist,
    getAllPlaylists,
    getPlaylist,
    type Playlist,
    removePlaylist,
    updatePlaylist,
} from "@/systems/Playlists";
import { stateSaved$ } from "@/systems/State";
import type { M3UTrack } from "@/utils/m3u";
import { parseDurationToSeconds } from "@/utils/m3u";

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

interface YTMusicPlaylist extends Playlist {
    thumbnail?: string;
    creator?: string;
}

interface PlayerState {
    isPlaying: boolean;
    currentTrack: Track | null;
    currentTime: string;
    isLoading: boolean;
    error: string | null;
    playlist: PlaylistTrack[];
    songs?: PlaylistTrack[];
    suggestions?: PlaylistTrack[];
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

            // Strategy 1: Extract playlists from script tags containing JSON data
            const scriptTags = document.querySelectorAll('script');
            let guideData = null;

            for (const script of scriptTags) {
                const scriptContent = script.textContent || script.innerHTML;

                // Look for the initialData structure that YouTube Music actually uses
                if (scriptContent.includes('const initialData') && scriptContent.includes('guideEntryRenderer')) {
                    try {
                        // Extract the initialData.push calls and find guide data
                        const pushMatches = scriptContent.matchAll(/initialData\\.push\\(\\{path:\\s*'([^']+)',\\s*params:\\s*JSON\\.parse\\('([^']+)'\\),\\s*data:\\s*'([^']+)'\\}\\);/g);
                        const pushMatchesArr = pushMatches?.toArray() || [];

                        for (const match of pushMatchesArr) {
                            const path = match[1];
                            const dataString = match[3];

                            // Look for guide data (sidebar navigation)
                            if (path.includes('guide')) {
                                // Decode the escaped JSON string
                                const decodedData = dataString.replace(/\\\\x([0-9A-Fa-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
                                try {
                                    const parsedData = JSON.parse(decodedData);
                                    guideData = parsedData;
                                    console.log('Found guide data in initialData', parsedData);
                                    break;
                                } catch {}
                            }
                        }
                    } catch (e) {
                        console.log('Failed to parse initialData from script tag:', e);
                        continue;
                    }
                }
            }

            debugger;

            // Extract playlists from guideData if found
            if (guideData) {
                console.log('Processing guide data for playlists...');

                function findGuideEntryRenderers(obj, path = '', visitedIds = new Set()) {
                    if (!obj || typeof obj !== 'object') return [];

                    const results = [];

                    // Check if current object is a guideEntryRenderer
                    if (obj.guideEntryRenderer) {
                        const renderer = obj.guideEntryRenderer;

                        // Extract playlist information
                        if (renderer.navigationEndpoint?.browseEndpoint?.browseId && renderer.formattedTitle) {
                            const browseId = renderer.navigationEndpoint.browseEndpoint.browseId;

                            // Skip if we've already processed this browseId
                            if (visitedIds.has(browseId)) {
                                return [];
                            }
                            visitedIds.add(browseId);

                            let title = '';

                            // Extract title from various possible structures
                            if (typeof renderer.formattedTitle === 'string') {
                                title = renderer.formattedTitle;
                            } else if (renderer.formattedTitle?.simpleText) {
                                title = renderer.formattedTitle.simpleText;
                            } else if (renderer.formattedTitle?.runs) {
                                title = renderer.formattedTitle.runs.map(r => r.text).join('');
                            }

                            // Extract thumbnail if available
                            let thumbnail = '';
                            if (renderer.icon?.iconType || renderer.thumbnail?.thumbnails) {
                                const thumbnails = renderer.thumbnail?.thumbnails;
                                if (thumbnails && thumbnails.length > 0) {
                                    thumbnail = thumbnails[thumbnails.length - 1].url; // Get highest quality
                                }
                            }

                            // Determine playlist type and extract count if available
                            let count = 0;
                            let creator = '';

                            if (renderer.formattedSubtitle) {
                                let subtitleText = '';
                                if (typeof renderer.formattedSubtitle === 'string') {
                                    subtitleText = renderer.formattedSubtitle;
                                } else if (renderer.formattedSubtitle?.simpleText) {
                                    subtitleText = renderer.formattedSubtitle.simpleText;
                                } else if (renderer.formattedSubtitle?.runs) {
                                    subtitleText = renderer.formattedSubtitle.runs.map(r => r.text).join('');
                                }

                                // Extract count from subtitle
                                const countMatch = subtitleText.match(/(\\d+)\\s+(songs?|tracks?)/i);
                                if (countMatch) {
                                    count = parseInt(countMatch[1]) || 0;
                                }

                                // Extract creator (everything before count usually)
                                creator = subtitleText.replace(/\\s*•\\s*\\d+\\s+(songs?|tracks?).*$/i, '').trim();
                            }

                            if (title && browseId) {
                                results.push({
                                    id: browseId,
                                    name: title,
                                    thumbnail: thumbnail,
                                    count: count,
                                    creator: creator
                                });
                            }
                        }
                    }

                    // Recursively search through all properties
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                            results.push(...findGuideEntryRenderers(obj[key], path + '.' + key, visitedIds));
                        }
                    }

                    return results;
                }

                const foundPlaylists = findGuideEntryRenderers(guideData);
                playlists.push(...foundPlaylists);
                console.log('Found', foundPlaylists.length, 'playlists from guide data');
            }


            // Strategy 4: Add "Now Playing" at the top
            playlists.unshift({
                id: 'NOW_PLAYING',
                name: 'Now Playing',
                thumbnail: '',
                count: 0,
                creator: ''
            });

            console.log('Final playlist count:', playlists.length);
            console.log('Playlists found:', playlists.map(p => ({ id: p.id, name: p.name })));
            return playlists;
        } catch (error) {
            console.error('Error extracting playlists:', error);
            return [{
                id: 'NOW_PLAYING',
                name: 'Now Playing',
                thumbnail: '',
                count: 0,
                creator: ''
            }];
        }
    }

    // Track current playlist selection
    let currentPlaylistSelection = 'NOW_PLAYING'; // Default to "Now Playing"

    function extractPlaylistInfo() {
        try {
            const songs = [];
            const suggestions = [];
            let currentTrackIndex = -1;

            // Determine current playlist context
            const url = window.location.href;
            let detectedPlaylist = 'NOW_PLAYING';

            if (url.includes('/playlist?list=')) {
                detectedPlaylist = url.split('/playlist?list=')[1].split('&')[0];
            } else if (url.includes('/library/')) {
                detectedPlaylist = url.split('/library/')[1] || 'library';
            }

            console.log('Current URL:', url);
            console.log('Detected playlist from URL:', detectedPlaylist);
            console.log('Current playlist selection:', currentPlaylistSelection);

            // If we're viewing "Now Playing" or in a general context, use queue items
            if (currentPlaylistSelection === 'NOW_PLAYING' ||
                (detectedPlaylist === 'NOW_PLAYING' && currentPlaylistSelection === 'NOW_PLAYING')) {
                const allQueueItems = document.querySelectorAll('ytmusic-player-queue-item');
                const queueItems = Array.from(allQueueItems).filter(item => !item.closest('#counterpart-renderer'));
                if (queueItems.length > 0) {
                    console.log('Using NOW PLAYING queue items:', queueItems.length);

                    queueItems.forEach((item, index) => {
                        const titleEl = item.querySelector('.song-title, .title');
                        const artistEl = item.querySelector('.byline a, .byline, .artist');
                        const durationEl = item.querySelector('.duration-text, .duration');
                        const thumbnailEl = item.querySelector('img');

                        if (titleEl && artistEl) {
                            let title = titleEl.textContent?.trim() || '';
                            let artist = artistEl.textContent?.trim() || '';
                            const duration = durationEl?.textContent?.trim() || '';

                            // Clean up artist text
                            if (artist.includes('•')) {
                                artist = artist.split('•')[0].trim();
                            }

                            if (title && artist && title !== artist) {
                                const isPlaying = item.classList.contains('playing') ||
                                                item.getAttribute('aria-selected') === 'true' ||
                                                item.classList.contains('selected') ||
                                                item.querySelector('[class*="playing"]') !== null;

                                const track = {
                                    title: title,
                                    artist: artist,
                                    duration: duration,
                                    thumbnail: thumbnailEl?.src || '',
                                    index: index,
                                    isPlaying: isPlaying
                                };

                                // For queue items, all are considered songs
                                songs.push(track);

                                if (isPlaying) {
                                    currentTrackIndex = songs.length - 1;
                                }
                            }
                        }
                    });
                }
            } else {
                // For specific playlists, separate songs from suggestions
                console.log('Looking for playlist tracks and suggestions...');

                // Helper function to extract tracks from a shelf
                function extractTracksFromShelf(shelf, targetArray, arrayName) {
                    if (!shelf) return;

                    const tracks = shelf.querySelectorAll('ytmusic-responsive-list-item-renderer');
                    console.log('Found ' + arrayName + ' tracks:', tracks.length);

                    tracks.forEach((item, index) => {
                        const titleEl = item.querySelector('.title-column .title');
                        const artistEl = item.querySelector('.secondary-flex-columns .flex-column');
                        const durationEl = item.querySelector('.fixed-column.MUSIC_RESPONSIVE_LIST_ITEM_COLUMN_DISPLAY_PRIORITY_HIGH');
                        const thumbnailEl = item.querySelector('img');

                        if (titleEl && artistEl) {
                            let title = titleEl.textContent?.trim() || '';
                            let artist = artistEl.textContent?.trim() || '';
                            const duration = durationEl?.textContent?.trim() || '';

                            // Clean up artist text
                            if (artist.includes('•')) {
                                artist = artist.split('•')[0].trim();
                            }

                            if (title && artist && title !== artist) {
                                const isPlaying = item.classList.contains('playing') ||
                                                item.getAttribute('aria-selected') === 'true' ||
                                                item.classList.contains('selected') ||
                                                item.querySelector('[class*="playing"]') !== null;

                                const track = {
                                    title: title,
                                    artist: artist,
                                    duration: duration,
                                    thumbnail: thumbnailEl?.src || '',
                                    index: targetArray.length, // Use target array length for proper indexing
                                    isPlaying: isPlaying
                                };

                                targetArray.push(track);

                                if (isPlaying) {
                                    currentTrackIndex = targetArray.length - 1;
                                }
                            }
                        }
                    });
                }

                // Extract tracks from main playlist content
                const playlistShelf = document.querySelector('ytmusic-playlist-shelf-renderer');
                extractTracksFromShelf(playlistShelf, songs, 'main playlist');

                // Extract tracks from suggestions shelf
                const suggestionsShelf = document.querySelector('ytmusic-shelf-renderer');
                extractTracksFromShelf(suggestionsShelf, suggestions, 'suggestions');
            }

            console.log('Extracted playlist - Songs:', songs.length, 'Suggestions:', suggestions.length);
            return { songs, suggestions, currentTrackIndex };
        } catch (error) {
            console.error('Error extracting playlist:', error);
            return { songs: [], suggestions: [], currentTrackIndex: -1 };
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
            const { songs, suggestions, currentTrackIndex } = extractPlaylistInfo();

            // Get available playlists (only update occasionally to avoid performance issues)
            const availablePlaylists = extractAvailablePlaylists();

            // Get the best quality thumbnail URL
            let thumbnailUrl = '';
            if (thumbnailElement?.src) {
                thumbnailUrl = thumbnailElement.src;
                // Try to get higher quality version
                if (thumbnailUrl.includes('=w')) {
                    thumbnailUrl = thumbnailUrl.replace(/=w\\d+-h\\d+/, '=w500-h500');
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
                songs,
                suggestions,
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

            // Determine current context to use the same strategy as extraction
            const url = window.location.href;
            let detectedPlaylist = 'NOW_PLAYING';

            if (url.includes('/playlist?list=')) {
                detectedPlaylist = url.split('/playlist?list=')[1].split('&')[0];
            } else if (url.includes('/library/')) {
                detectedPlaylist = url.split('/library/')[1] || 'library';
            }

            // Use the same logic as extractPlaylistInfo to find the right items
            let items = [];
            let strategy = '';

            // If we're in "Now Playing" context, use queue items
            if (currentPlaylistSelection === 'NOW_PLAYING' ||
                (detectedPlaylist === 'NOW_PLAYING' && currentPlaylistSelection === 'NOW_PLAYING')) {
                const allQueueItems = document.querySelectorAll('ytmusic-player-queue-item');
                const queueItems = Array.from(allQueueItems).filter(item => !item.closest('#counterpart-renderer'));
                if (queueItems.length > 0) {
                    items = queueItems;
                    strategy = 'now-playing-queue';
                    console.log('Using queue items for playback:', items.length);
                }
            } else {
                // If we're viewing a specific playlist, use the same selectors as extraction
                let playlistPageItems = document.querySelectorAll('ytmusic-playlist-shelf-renderer ytmusic-responsive-list-item-renderer');
                if (playlistPageItems.length === 0) {
                    playlistPageItems = document.querySelectorAll('ytmusic-shelf-renderer ytmusic-responsive-list-item-renderer');
                }
                if (playlistPageItems.length === 0) {
                    playlistPageItems = document.querySelectorAll('ytmusic-responsive-list-item-renderer');
                }

                if (playlistPageItems.length > 0) {
                    // Filter to get the same items as extraction (must match exactly)
                    const filteredItems = Array.from(playlistPageItems).filter(item => {
                        const titleEl = item.querySelector('.title-column .title');
                        const artistEl = item.querySelector('.secondary-flex-columns .flex-column');
                        const hasValidContent = titleEl && artistEl &&
                                              titleEl.textContent?.trim() &&
                                              artistEl.textContent?.trim();

                        const isTrackItem = !item.closest('ytmusic-header-renderer') &&
                                          !item.closest('ytmusic-nav-bar');

                        return hasValidContent && isTrackItem;
                    });

                    items = filteredItems;
                    strategy = 'playlist-tracks';
                    console.log('Using playlist items for playback:', items.length);
                }
            }

            // Click the item at the specified index
            if (items[index]) {
                console.log('Clicking item at index', index, 'using strategy:', strategy);

                if (strategy === 'now-playing-queue') {
                    // For queue items, look for play button
                    const playButton = items[index].querySelector('ytmusic-play-button-renderer');
                    if (playButton) {
                        playButton.click();
                        return true;
                    }
                } else {
                    // For playlist items, look for play button or click the item
                    const playButton = items[index].querySelector('[aria-label*="Play"], [title*="Play"], ytmusic-play-button-renderer');
                    if (playButton) {
                        console.log('Found play button, clicking...');
                        playButton.click();
                        return true;
                    } else {
                        console.log('No play button found, clicking item directly...');
                        items[index].click();
                        return true;
                    }
                }
            }

            console.log('Could not find track at index:', index, 'items available:', items.length);
            return false;
        },

        setCurrentPlaylist: function(playlistId) {
            console.log('Setting current playlist to:', playlistId);
            currentPlaylistSelection = playlistId;
        },

        navigateToPlaylistByIndex: function(index) {
            console.log('Navigating to playlist by index:', index);

            try {
                const sidebarPlaylists = document.querySelectorAll('ytmusic-guide-entry-renderer[play-button-state="default"]');
                if (sidebarPlaylists[index]) {
                    const linkEl = sidebarPlaylists[index].querySelector('tp-yt-paper-item[href]');
                    if (linkEl) {
                        console.log('Found sidebar element at index', index, 'clicking...');
                        linkEl.click();

                        // Wait for page to load and then re-extract
                        setTimeout(function() {
                            console.log('Re-extracting after sidebar navigation...');
                            extractPlayerInfo();
                        }, 2000);

                        return true;
                    } else {
                        console.log('No clickable link found in sidebar element at index', index);
                        // Fallback: click the entire element
                        sidebarPlaylists[index].click();

                        // Wait for page to load and then re-extract
                        setTimeout(function() {
                            console.log('Re-extracting after sidebar fallback navigation...');
                            extractPlayerInfo();
                        }, 2000);

                        return true;
                    }
                } else {
                    console.log('No sidebar playlist found at index:', index);
                    return false;
                }
            } catch (error) {
                console.error('Error navigating to playlist by index:', error);
                return false;
            }
        },

        navigateToPlaylist: function(playlistId) {
            console.log('Navigating to playlist:', playlistId);

            try {
                // Update current playlist selection
                currentPlaylistSelection = playlistId;

                // Strategy 0: Handle "Now Playing" - don't navigate, just update selection
                if (playlistId === 'NOW_PLAYING') {
                    console.log('Switched to Now Playing view');
                    return true;
                }

                // Strategy 1: Handle sidebar_ prefixed IDs by clicking at specific index
                if (playlistId.startsWith('sidebar_')) {
                    const index = parseInt(playlistId.split('sidebar_')[1]);
                    console.log('Clicking sidebar playlist at index:', index);

                    const sidebarPlaylists = document.querySelectorAll('ytmusic-guide-entry-renderer[play-button-state="default"]');
                    if (sidebarPlaylists[index]) {
                        const linkEl = sidebarPlaylists[index].querySelector('tp-yt-paper-item[href]');
                        if (linkEl) {
                            console.log('Found sidebar element at index', index, 'clicking...');
                            linkEl.click();

                            // Wait for page to load and then re-extract
                            setTimeout(function() {
                                console.log('Re-extracting after sidebar navigation...');
                                extractPlayerInfo();
                            }, 2000);

                            return true;
                        } else {
                            console.log('No clickable link found in sidebar element at index', index);
                            // Fallback: click the entire element
                            sidebarPlaylists[index].click();

                            // Wait for page to load and then re-extract
                            setTimeout(function() {
                                console.log('Re-extracting after sidebar fallback navigation...');
                                extractPlayerInfo();
                            }, 2000);

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

                    // Wait for page to load and then re-extract
                    setTimeout(function() {
                        console.log('Re-extracting after navigation...');
                        extractPlayerInfo();
                    }, 2000);

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

    // Track URL changes to detect playlist navigation
    let lastUrl = window.location.href;
    const checkUrlChange = function() {
        if (window.location.href !== lastUrl) {
            console.log('URL changed from', lastUrl, 'to', window.location.href);
            lastUrl = window.location.href;

            // Update current playlist selection based on URL
            if (window.location.href.includes('/playlist?list=')) {
                const playlistId = window.location.href.split('/playlist?list=')[1].split('&')[0];
                currentPlaylistSelection = playlistId;
                console.log('Auto-updated current playlist selection to:', playlistId);
            } else if (window.location.href.includes('/library/')) {
                const libraryId = window.location.href.split('/library/')[1] || 'library';
                currentPlaylistSelection = libraryId;
                console.log('Auto-updated current playlist selection to:', libraryId);
            }

            // Re-extract playlist info after a short delay
            setTimeout(extractPlayerInfo, 1000);
        }
    };

    // Check for URL changes periodically
    setInterval(checkUrlChange, 500);

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

// Load cached playlists synchronously
const loadCachedYTMPlaylists = (): YTMusicPlaylist[] => {
    try {
        const allPlaylists = getAllPlaylists();
        const ytmPlaylists = allPlaylists.filter((p) => p.type === "ytm");

        return ytmPlaylists;
    } catch (error) {
        console.warn("Failed to load cached playlists on startup:", error);
        return [];
    }
};

// Create observable player state outside component for global access
const playerState$ = observable<PlayerState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: "0:00",
    isLoading: true,
    error: null,
    playlist: [],
    currentTrackIndex: -1,
    availablePlaylists: loadCachedYTMPlaylists(),
    currentPlaylistId: undefined,
});

let webViewRef: React.MutableRefObject<WebView | null> | null = null;

const executeCommand = (command: string, ...args: any[]) => {
    const script = `window.ytMusicControls.${command}(${args.map((arg) => JSON.stringify(arg)).join(", ")}); true;`;
    webViewRef?.current?.injectJavaScript(script);
};

// Function to sync YouTube Music playlists with our persistent storage
const syncYouTubeMusicPlaylists = (ytmPlaylists: YTMusicPlaylist[]) => {
    try {
        batch(() => {
            let i = 0;
            for (const ytmPlaylist of ytmPlaylists) {
                const existingPlaylist = getPlaylist(ytmPlaylist.id);

                if (existingPlaylist) {
                    // Update existing playlist with latest info
                    updatePlaylist(ytmPlaylist.id, {
                        name: ytmPlaylist.name,
                        count: ytmPlaylist.count || 0,
                        index: ytmPlaylist.index, // Update the sidebar index
                        // Don't update path for YTM playlists as they're web-based
                    });
                } else {
                    // Add new YouTube Music playlist
                    addPlaylist({
                        ...ytmPlaylist,
                        // TODO: Could the path be the actual url for playing the playlist?
                        path: "",
                        type: "ytm",
                        order: i,
                        index: ytmPlaylist.index, // Store the sidebar index
                    });
                }
                i++;
            }
        });

        console.log(`Synced ${ytmPlaylists.length} YouTube Music playlists`);
    } catch (error) {
        console.error("Failed to sync YouTube Music playlists:", error);
    }
};

// Function to update playlist content (M3U format) when tracks are received
const updatePlaylistContent = (
    playlistId: string | undefined,
    songs: PlaylistTrack[],
    suggestions: PlaylistTrack[] = [],
) => {
    if (!playlistId || (songs.length === 0 && suggestions.length === 0)) {
        return;
    }

    try {
        // Convert YouTube Music songs to M3U format
        const m3uSongs: M3UTrack[] = songs.map((track) => ({
            duration: parseDurationToSeconds(track.duration), // Parse MM:SS format to seconds
            title: track.title,
            artist: track.artist,
            filePath: track.id ? `ytm://${track.id}` : `ytm://search/${encodeURIComponent(track.title)}`,
        }));

        // Convert YouTube Music suggestions to M3U format
        const m3uSuggestions: M3UTrack[] = suggestions.map((track) => ({
            duration: parseDurationToSeconds(track.duration), // Parse MM:SS format to seconds
            title: track.title,
            artist: track.artist,
            filePath: track.id ? `ytm://${track.id}` : `ytm://search/${encodeURIComponent(track.title)}`,
        }));

        // Get the playlist content observable and update it
        const playlistContent$ = getPlaylistContent(playlistId);
        playlistContent$.set({
            songs: m3uSongs,
            suggestions: m3uSuggestions,
        });

        console.log(
            `Updated playlist content for ${playlistId} with ${m3uSongs.length} songs and ${m3uSuggestions.length} suggestions`,
        );
    } catch (error) {
        console.error(`Failed to update playlist content for ${playlistId}:`, error);
    }
};

// Expose control methods
const controls = {
    playPause: () => executeCommand("playPause"),
    next: () => executeCommand("next"),
    previous: () => executeCommand("previous"),
    setVolume: (volume: number) => executeCommand("setVolume", volume),
    seek: (seconds: number) => executeCommand("seek", seconds),
    playTrackAtIndex: (index: number) => executeCommand("playTrackAtIndex", index),
    navigateToPlaylist: (playlistId: string) => {
        // Look up the playlist to get its index if it's a YTM playlist
        const playlist = getPlaylist(playlistId);
        if (playlist?.type === "ytm" && playlist.index !== undefined) {
            executeCommand("navigateToPlaylistByIndex", playlist.index);
        } else {
            executeCommand("navigateToPlaylist", playlistId);
        }
    },
    setCurrentPlaylist: (playlistId: string) => executeCommand("setCurrentPlaylist", playlistId),
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

    // Log cached playlists on component mount
    useEffect(() => {
        const cachedPlaylists = playerState$.availablePlaylists.get();
        if (cachedPlaylists.length > 0) {
            console.log(`Loaded ${cachedPlaylists.length} persisted YouTube Music playlists on startup`);
        }
    }, []);

    const handleMessage = (event: any) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);

            console.log({ message });

            switch (message.type) {
                case "playerState": {
                    const newState = message.data;
                    playerState$.assign(newState);

                    // Sync YouTube Music playlists when they're updated
                    if (newState.availablePlaylists && Array.isArray(newState.availablePlaylists)) {
                        syncYouTubeMusicPlaylists(newState.availablePlaylists);
                    }

                    // Update playlist content (M3U format) when tracks are received
                    if (newState.songs && Array.isArray(newState.songs)) {
                        updatePlaylistContent(stateSaved$.playlist.get(), newState.songs, newState.suggestions || []);
                    }
                    break;
                }
                case "error":
                    playerState$.error.set(message.data.error);
                    playerState$.isLoading.set(false);
                    break;
                case "injectionComplete":
                    playerState$.isLoading.set(false);
                    break;
                case "updatePlaylistId": {
                    const { oldId, newId } = message.data;
                    console.log("Updating playlist ID from", oldId, "to", newId);

                    // Find the playlist with the temporary ID and update it
                    const playlist = getPlaylist(oldId);
                    if (playlist) {
                        // Remove the old playlist entry
                        removePlaylist(oldId);

                        // Add the playlist with the new ID, preserving all other data
                        addPlaylist({
                            ...playlist,
                            id: newId,
                        });

                        console.log("Successfully updated playlist ID");
                    }
                    break;
                }
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
                    playerState$.error.set(`WebView error: ${error.nativeEvent.description}`);
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
