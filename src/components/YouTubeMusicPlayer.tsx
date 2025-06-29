import { batch, observable } from "@legendapp/state";
import { use$, useSelector } from "@legendapp/state/react";
import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { getPlaylistContent } from "@/systems/PlaylistContent";
import { getAllPlaylists, getPlaylist, type Playlist, playlistsData$ } from "@/systems/Playlists";
import { state$, stateSaved$ } from "@/systems/State";
import { arrayToObject } from "@/utils/arrayToObject";
import type { M3UTrack } from "@/utils/m3u";
import { parseDurationToSeconds } from "@/utils/m3u";

// Helper function to generate YouTube Music watch URLs
function generateYouTubeMusicWatchUrl(trackId: string, playlistIdForUrl: string): string {
    return `https://music.youtube.com/watch?v=${trackId}&list=${playlistIdForUrl}`;
}

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

interface PlaybackState {
    isPlaying: boolean;
    currentTrack: Track | null;
    currentTime: string;
    currentTrackIndex: number;
    isLoading: boolean;
    error: string | null;
}

interface PlaylistState {
    songs: PlaylistTrack[];
    suggestions: PlaylistTrack[];
    currentPlaylistId?: string;
}

interface PlaylistsState {
    availablePlaylists: YTMusicPlaylist[];
}

// Legacy interface for compatibility during transition
interface PlayerState extends PlaybackState, PlaylistState, PlaylistsState {}

const injectedJavaScript = `
(function() {
    // Helper functions for common operations
    function extractTextFromRenderer(renderer) {
        if (typeof renderer === 'string') {
            return renderer;
        } else if (renderer?.simpleText) {
            return renderer.simpleText;
        } else if (renderer?.runs) {
            return renderer.runs.map(r => r.text).join('');
        }
        return '';
    }

    function cleanArtistText(artist) {
        if (artist.includes('•')) {
            return artist.split('•')[0].trim();
        }
        return artist;
    }

    function isTrackPlaying(item) {
        return item.classList.contains('playing') ||
               item.getAttribute('aria-selected') === 'true' ||
               item.classList.contains('selected') ||
               item.querySelector('[class*="playing"]') !== null;
    }

    function extractPlaylistIdFromUrl(url) {
        if (url.includes('/playlist?list=')) {
            return url.split('/playlist?list=')[1].split('&')[0];
        } else if (url.includes('/library/')) {
            return url.split('/library/')[1] || 'library';
        }
        return 'NOW_PLAYING';
    }

    function navigateSidebarPlaylist(index, actionName) {
        const sidebarPlaylists = document.querySelectorAll('ytmusic-guide-entry-renderer[play-button-state="default"]');
        if (sidebarPlaylists[index]) {
            const linkEl = sidebarPlaylists[index].querySelector('tp-yt-paper-item[href]');
            if (linkEl) {
                linkEl.click();
            } else {
                sidebarPlaylists[index].click();
            }

            // Wait for page to load and then re-extract
            setTimeout(function() {
                extractCurrentPlaylistInfo(); // Sidebar navigation affects playlist
                extractAvailablePlaylistsInfo(); // May also affect available playlists
            }, 2000);

            return true;
        }
        return false;
    }

    function extractTrackFromDOMElement(item, index, targetArray) {
        const titleEl = item.querySelector('.title-column .title, .song-title, .title');
        const artistEl = item.querySelector('.secondary-flex-columns .flex-column, .byline a, .byline, .artist');
        const durationEl = item.querySelector('.fixed-column.MUSIC_RESPONSIVE_LIST_ITEM_COLUMN_DISPLAY_PRIORITY_HIGH, .duration-text, .duration');
        const thumbnailEl = item.querySelector('img');

        if (titleEl && artistEl) {
            let title = titleEl.textContent?.trim() || '';
            let artist = cleanArtistText(artistEl.textContent?.trim() || '');
            const duration = durationEl?.textContent?.trim() || '';

            if (title && artist && title !== artist) {
                const isPlaying = isTrackPlaying(item);

                return {
                    title: title,
                    artist: artist,
                    duration: duration,
                    thumbnail: thumbnailEl?.src || '',
                    index: targetArray.length,
                    isPlaying: isPlaying
                };
            }
        }
        return null;
    }

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
                                const decodedData = dataString.replace(/\\\\x([0-9A-Fa-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\"/g, '"');
                                try {
                                    const parsedData = JSON.parse(decodedData);
                                    guideData = parsedData;
                                    break;
                                } catch {}
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Extract playlists from guideData if found
            if (guideData) {
                const results = [];

                function findGuideEntryRenderers(obj, path = '', visitedIds = new Set()) {
                    if (!obj || typeof obj !== 'object') return [];


                    // Check if current object is a guideEntryRenderer
                    if (obj.guideEntryRenderer) {
                        const renderer = obj.guideEntryRenderer;

                        // Extract playlist information
                        if (renderer.navigationEndpoint?.browseEndpoint?.browseId && renderer.formattedTitle) {
                            const browseId = renderer.navigationEndpoint.browseEndpoint.browseId;

                            if (!browseId || !browseId.startsWith('VL')) {
                                return [];
                            }

                            // Skip if we've already processed this browseId
                            if (visitedIds.has(browseId)) {
                                return [];
                            }
                            visitedIds.add(browseId);

                            let title = '';

                            // Extract title from various possible structures
                            title = extractTextFromRenderer(renderer.formattedTitle);

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
                                const subtitleText = extractTextFromRenderer(renderer.formattedSubtitle);

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
                                    creator: creator,
                                    index: results.length,
                                    type: 'ytm'
                                });
                            }
                        }
                    }

                    // Recursively search through all properties
                    for (const key in obj) {
                        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                            findGuideEntryRenderers(obj[key], path + '.' + key, visitedIds);
                        }
                    }
                }

                findGuideEntryRenderers(guideData);
                playlists.push(...results);
                }


            // Strategy 4: Add "Now Playing" at the top
            playlists.unshift({
                id: 'NOW_PLAYING',
                name: 'Now Playing',
                thumbnail: '',
                count: 0,
                creator: ''
            });

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
            let songs = [];
            let suggestions = [];
            let currentTrackIndex = -1;

            // Determine current playlist context
            const url = window.location.href;
            const detectedPlaylist = extractPlaylistIdFromUrl(url);

            console.log('Current URL:', url);
            console.log('Detected playlist from URL:', detectedPlaylist);
            console.log('Current playlist selection:', currentPlaylistSelection);

            // Strategy 1: Try to extract songs from script data first (more reliable)
            try {
                const scriptTags = document.querySelectorAll('script');
                let songsFromScript = [];

                for (const script of scriptTags) {
                    const scriptContent = script.textContent || script.innerHTML;

                    // Look for browse data containing playlist information
                    if (scriptContent.includes('initialData.push') && scriptContent.includes('browse')) {
                        try {
                            const pushMatches = scriptContent.matchAll(/initialData\\.push\\(\\{path:\\s*'([^']+)',\\s*params:\\s*JSON\\.parse\\('([^']+)'\\),\\s*data:\\s*'([^']+)'\\}\\);/g);
                            const pushMatchesArr = [...pushMatches];

                            for (const match of pushMatchesArr) {
                                const path = match[1];
                                const dataString = match[3];

                                // Look for browse data (playlist content)
                                if (path.includes('browse')) {
                                    // Decode the escaped JSON string
                                    const decodedData = dataString.replace(/\\\\x([0-9A-Fa-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\"/g, '"');
                                    try {
                                        const parsedData = JSON.parse(decodedData);
                                        console.log('Found browse data in initialData', parsedData);

                                        // Extract songs from the parsed data
                                        const extractedSongs = extractSongsFromBrowseData(parsedData);
                                        if (extractedSongs.length > 0) {
                                            songsFromScript = extractedSongs;
                                            console.log('Extracted', extractedSongs.length, 'songs from script data');
                                            break;
                                        }
                                    } catch (e) {
                                        console.log('Failed to parse browse data:', e);
                                        continue;
                                    }
                                }
                            }

                            if (songsFromScript.length > 0) {
                                break;
                            }
                        } catch (e) {
                                continue;
                        }
                    }
                }

                if (songsFromScript.length > 0) {
                    songs = songsFromScript;
                    console.log('Using songs from script data:', songs.length);
                }
            } catch (error) {
                console.log('Error extracting songs from script data:', error);
            }

            // Helper function to extract tracks from a shelf
            function extractTracksFromShelf(shelf, targetArray, arrayName) {
                if (!shelf) return;

                const tracks = shelf.querySelectorAll('ytmusic-responsive-list-item-renderer');
                console.log('Found ' + arrayName + ' tracks:', tracks.length);

                tracks.forEach((item, index) => {
                    const track = extractTrackFromDOMElement(item, index, targetArray);
                    if (track) {
                        track.fromShelf = arrayName;
                        targetArray.push(track);

                        if (track.isPlaying) {
                            currentTrackIndex = targetArray.length - 1;
                        }
                    }
                });
            }

            // Strategy 2: Fallback to DOM extraction if script extraction failed or for "Now Playing"
            if (songs.length === 0) {
                // If we're viewing "Now Playing" or in a general context, use queue items
                if (currentPlaylistSelection === 'NOW_PLAYING' ||
                    (detectedPlaylist === 'NOW_PLAYING' && currentPlaylistSelection === 'NOW_PLAYING')) {
                    const allQueueItems = document.querySelectorAll('ytmusic-player-queue-item');
                    const queueItems = Array.from(allQueueItems).filter(item => !item.closest('#counterpart-renderer'));
                    if (queueItems.length > 0) {
                        console.log('Using NOW PLAYING queue items:', queueItems.length);

                        queueItems.forEach((item, index) => {
                            const track = extractTrackFromDOMElement(item, index, songs);
                            if (track) {
                                track.index = index; // Override for queue items
                                track.fromShelf = true;
                                songs.push(track);

                                if (track.isPlaying) {
                                    currentTrackIndex = songs.length - 1;
                                }
                            }
                        });
                    }
                } else {
                    // For specific playlists, separate songs from suggestions
                    console.log('Looking for playlist tracks and suggestions...');

                    // Extract tracks from main playlist content
                    const playlistShelf = document.querySelector('ytmusic-playlist-shelf-renderer');
                    extractTracksFromShelf(playlistShelf, songs, 'main playlist');

                }
            }

            // Extract tracks from suggestions shelf
            const suggestionsShelf = document.querySelector('ytmusic-shelf-renderer');
            extractTracksFromShelf(suggestionsShelf, suggestions, 'suggestions');

            console.log('Extracted playlist - Songs:', songs.length, 'Suggestions:', suggestions.length);
            return { songs, suggestions, currentTrackIndex };
        } catch (error) {
            console.error('Error extracting playlist:', error);
            return { songs: [], suggestions: [], currentTrackIndex: -1 };
        }
    }

    // Helper function to extract songs from browse data (script data)
    function extractSongsFromBrowseData(data) {
        const songs = [];

        try {
            // Navigate to the specific path where playlist songs are located
            const playlistContents = data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents;

            if (!playlistContents || !Array.isArray(playlistContents)) {
                console.log('No playlist contents found in expected structure');
                return [];
            }

            // Find the musicPlaylistShelfRenderer
            let playlistShelf = null;
            for (const section of playlistContents) {
                if (section.musicPlaylistShelfRenderer) {
                    playlistShelf = section.musicPlaylistShelfRenderer;
                    break;
                }
            }

            if (!playlistShelf || !playlistShelf.contents || !Array.isArray(playlistShelf.contents)) {
                console.log('No music playlist shelf found');
                return [];
            }

            // Process each song item
            for (let i = 0; i < playlistShelf.contents.length; i++) {
                const item = playlistShelf.contents[i];
                if (!item.musicResponsiveListItemRenderer) continue;

                const renderer = item.musicResponsiveListItemRenderer;

                // Extract song information
                let title = '';
                let artist = '';
                let duration = '';
                let thumbnail = '';
                let videoId = '';

                // Extract title and videoId from flexColumns[0]
                if (renderer.flexColumns && renderer.flexColumns.length > 0) {
                    const titleColumn = renderer.flexColumns[0];
                    if (titleColumn.musicResponsiveListItemFlexColumnRenderer?.text?.runs && titleColumn.musicResponsiveListItemFlexColumnRenderer.text.runs.length > 0) {
                        title = titleColumn.musicResponsiveListItemFlexColumnRenderer.text.runs[0].text || '';
                        // Extract videoId from navigation endpoint
                        const navEndpoint = titleColumn.musicResponsiveListItemFlexColumnRenderer.text.runs[0].navigationEndpoint;
                        if (navEndpoint?.watchEndpoint?.videoId) {
                            videoId = navEndpoint.watchEndpoint.videoId;
                        }
                    }

                    // Extract artist from flexColumns[1]
                    if (renderer.flexColumns.length > 1) {
                        const artistColumn = renderer.flexColumns[1];
                        if (artistColumn.musicResponsiveListItemFlexColumnRenderer?.text?.runs && artistColumn.musicResponsiveListItemFlexColumnRenderer.text.runs.length > 0) {
                            artist = artistColumn.musicResponsiveListItemFlexColumnRenderer.text.runs[0].text || '';
                        }
                    }
                }

                // Extract duration from fixedColumns[0]
                if (renderer.fixedColumns && renderer.fixedColumns.length > 0) {
                    const durationColumn = renderer.fixedColumns[0];
                    if (durationColumn.musicResponsiveListItemFixedColumnRenderer?.text?.runs && durationColumn.musicResponsiveListItemFixedColumnRenderer.text.runs.length > 0) {
                        duration = durationColumn.musicResponsiveListItemFixedColumnRenderer.text.runs[0].text || '';
                    }
                }

                // Extract thumbnail (prefer 120x120 version)
                if (renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails && renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails.length > 0) {
                    const thumbnails = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;
                    // Look for 120x120 version specifically
                    const thumbnail120 = thumbnails.find(thumb => thumb.width === 120 && thumb.height === 120);

                    if (thumbnail120) {
                        thumbnail = thumbnail120.url;
                    } else if (thumbnails.length > 0) {
                        // Fallback to highest quality if 120x120 not found
                        thumbnail = thumbnails[thumbnails.length - 1].url;
                    }
                }

                // Only add if we have essential data
                if (title && artist && videoId) {
                    songs.push({
                        id: videoId,
                        title: title,
                        artist: artist,
                        duration: duration,
                        thumbnail: thumbnail,
                        index: songs.length,
                        isPlaying: false // We'll determine this later
                    });
                }
            }

            console.log('Extracted', songs.length, 'songs from browse data');
            return songs;
        } catch (error) {
            console.error('Error extracting songs from browse data:', error);
            return [];
        }
    }

    // Split state extraction into separate functions for different update patterns
    let lastPlaybackState = {};
    let lastPlaylistState = {};
    let lastPlaylistsState = {};

    function extractPlaybackInfo() {
        try {

            // Try multiple selectors for title and artist
            let titleElement = document.querySelector('.title.style-scope.ytmusic-player-bar');
            if (!titleElement) {
                titleElement = document.querySelector('ytmusic-player-bar .title');
            }
            if (!titleElement) {
                titleElement = document.querySelector('[class*="title"][class*="player"]');
            }
            if (!titleElement) {
                titleElement = document.querySelector('#player .title, .player-bar .title');
            }

            let artistElement = document.querySelector('.byline.style-scope.ytmusic-player-bar');
            if (!artistElement) {
                artistElement = document.querySelector('ytmusic-player-bar .byline');
            }
            if (!artistElement) {
                artistElement = document.querySelector('[class*="byline"][class*="player"]');
            }
            if (!artistElement) {
                artistElement = document.querySelector('#player .byline, .player-bar .byline');
            }



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

            // Get play/pause state with multiple selectors - focus on main player only
            let playButton = document.querySelector('#play-pause-button button');
            if (!playButton) {
                // More specific selectors that target the main player bar only
                playButton = document.querySelector('ytmusic-player-bar #play-pause-button');
            }
            if (!playButton) {
                playButton = document.querySelector('ytmusic-player-bar [aria-label*="play"], ytmusic-player-bar [aria-label*="pause"]');
            }
            if (!playButton) {
                playButton = document.querySelector('ytmusic-player-bar [role="button"][aria-label*="play"], ytmusic-player-bar [role="button"][aria-label*="pause"]');
            }
            if (!playButton) {
                playButton = document.querySelector('.play-pause-button, [class*="play-pause"]');
            }

            let isPlaying = false;
            if (playButton) {
                const ariaLabel = playButton.getAttribute('aria-label') || '';
                const title = playButton.getAttribute('title') || '';
                isPlaying = ariaLabel.toLowerCase().includes('pause') || title.toLowerCase().includes('pause');
            }


            // Get current time with multiple selectors
            let timeElement = document.querySelector('#left-controls .time-info');
            if (!timeElement) {
                timeElement = document.querySelector('.time-info[class*="left"], [class*="current-time"]');
            }
            if (!timeElement) {
                timeElement = document.querySelector('ytmusic-player-bar .time');
            }
            const currentTime = timeElement?.textContent?.trim() || '0:00';

            // Get duration with multiple selectors
            let durationElement = document.querySelector('#right-controls .time-info');
            if (!durationElement) {
                durationElement = document.querySelector('.time-info[class*="right"], [class*="total-time"], [class*="duration"]');
            }
            if (!durationElement) {
                durationElement = document.querySelector('ytmusic-player-bar .duration');
            }
            const duration = durationElement?.textContent?.trim() || '0:00';


            // Get the best quality thumbnail URL
            let thumbnailUrl = '';
            if (thumbnailElement?.src) {
                thumbnailUrl = thumbnailElement.src;
                // Try to get higher quality version
                if (thumbnailUrl.includes('=w')) {
                    thumbnailUrl = thumbnailUrl.replace(/=w\\d+-h\\d+/, '=w500-h500');
                }
            }

            const playbackState = {
                isPlaying,
                currentTrack: {
                    title: titleElement?.textContent?.trim() || '',
                    artist: artistElement?.textContent?.trim() || '',
                    duration: duration,
                    thumbnail: thumbnailUrl
                },
                currentTime,
                currentTrackIndex: -1, // Will be set by playlist extraction
                isLoading: false,
                error: null
            };

            // Only send update if playback state changed
            if (JSON.stringify(playbackState) !== JSON.stringify(lastPlaybackState)) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'playbackState',
                    data: playbackState
                }));
                lastPlaybackState = playbackState;
            } else {
            }
        } catch (error) {
            console.error('Error in extractPlaybackInfo:', error);
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                data: { error: error.message }
            }));
        }
    }

    function extractCurrentPlaylistInfo() {
        try {
            // Get playlist info
            const { songs, suggestions, currentTrackIndex } = extractPlaylistInfo();

            const playlistState = {
                songs,
                suggestions,
                currentTrackIndex,
                currentPlaylistId: extractPlaylistIdFromUrl(window.location.href)
            };

            // Only send update if playlist state changed
            if (JSON.stringify(playlistState) !== JSON.stringify(lastPlaylistState)) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'playlistState',
                    data: playlistState
                }));
                lastPlaylistState = playlistState;
            }
        } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                data: { error: error.message }
            }));
        }
    }

    function extractAvailablePlaylistsInfo() {
        try {
            // Get available playlists (only update occasionally to avoid performance issues)
            const availablePlaylists = extractAvailablePlaylists();

            const playlistsState = {
                availablePlaylists
            };

            // Only send update if playlists state changed
            if (JSON.stringify(playlistsState) !== JSON.stringify(lastPlaylistsState)) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'playlistsState',
                    data: playlistsState
                }));
                lastPlaylistsState = playlistsState;
            }
        } catch (error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                data: { error: error.message }
            }));
        }
    }

    // Legacy function for compatibility
    function extractPlayerInfo() {
        extractPlaybackInfo();
        extractCurrentPlaylistInfo();
        // Note: Available playlists will be extracted less frequently
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

            // Determine current context to use the same strategy as extraction
            const url = window.location.href;
            const detectedPlaylist = extractPlaylistIdFromUrl(url);

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
                }
            }

            // Click the item at the specified index
            if (items[index]) {

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
                        playButton.click();
                        return true;
                    } else {
                        items[index].click();
                        return true;
                    }
                }
            }

            return false;
        },

        setCurrentPlaylist: function(playlistId) {
            currentPlaylistSelection = playlistId;
        },

        navigateToPlaylistByIndex: function(index) {
            try {
                return navigateSidebarPlaylist(index, 'sidebar navigation');
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
                    return true;
                }

                // Strategy 1: Handle sidebar_ prefixed IDs by clicking at specific index
                if (playlistId.startsWith('sidebar_')) {
                    const index = parseInt(playlistId.split('sidebar_')[1]);
                    return navigateSidebarPlaylist(index, 'sidebar playlist navigation');
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
                        extractCurrentPlaylistInfo(); // Navigation affects playlist
                    }, 2000);

                    return true;
                }

                // Strategy 2: Try to find and click the playlist in the sidebar
                const sidebarPlaylists = document.querySelectorAll('ytmusic-guide-entry-renderer[play-button-state="default"]');

                for (let i = 0; i < sidebarPlaylists.length; i++) {
                    const element = sidebarPlaylists[i];
                    const linkEl = element.querySelector('tp-yt-paper-item[href]');
                    const href = linkEl?.getAttribute('href') || '';


                    if (href.includes('playlist?list=' + playlistId) ||
                        href.includes(playlistId) ||
                        (playlistId === 'library' && href.includes('library/'))) {
                        console.log('Found matching sidebar playlist, clicking...');
                        linkEl?.click();
                        return true;
                    }
                }

                // Strategy 3: Try to find and click in the main grid
                const gridPlaylists = document.querySelectorAll('ytmusic-two-row-item-renderer a[href*="playlist?list="]');

                for (let i = 0; i < gridPlaylists.length; i++) {
                    const element = gridPlaylists[i];
                    const href = element.getAttribute('href') || '';


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
            const newPlaylistId = extractPlaylistIdFromUrl(window.location.href);
            if (newPlaylistId !== 'NOW_PLAYING') {
                currentPlaylistSelection = newPlaylistId;
                console.log('Auto-updated current playlist selection to:', newPlaylistId);
            }

            // Re-extract playlist info after a short delay
            setTimeout(extractCurrentPlaylistInfo, 1000);
        }
    };

    // Check for URL changes periodically
    setInterval(checkUrlChange, 500);

    // Initial extraction
    extractPlaybackInfo();
    extractCurrentPlaylistInfo();
    extractAvailablePlaylistsInfo();

    // Function to set up observers once elements are available
    function setupObservers() {
        // 1. Playback Observer - watches player controls and track info
        const playbackObserver = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' ||
                    (mutation.type === 'attributes' &&
                     ['aria-label', 'title', 'class'].includes(mutation.attributeName))) {
                    shouldUpdate = true;
                }
            });
            if (shouldUpdate) {
                setTimeout(extractPlaybackInfo, 50);
            }
        });

        // Observe player bar for playback state changes
        const playerBar = document.querySelector('ytmusic-player-bar');
        if (playerBar) {
            playbackObserver.observe(playerBar, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['aria-label', 'title', 'class']
            });
        }

        // Also observe play/pause button specifically
        const playButton = document.querySelector('#play-pause-button');
        if (playButton) {
            playbackObserver.observe(playButton, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['aria-label', 'title', 'class']
            });
        }

        // 2. Playlist Observer - watches current playlist content
        const playlistObserver = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    shouldUpdate = true;
                }
            });
            if (shouldUpdate) {
                setTimeout(extractCurrentPlaylistInfo, 100);
            }
        });

        // Observe main content area for playlist changes
        const mainContent = document.querySelector('#main-panel, [role="main"], ytmusic-browse-response');
        if (mainContent) {
            playlistObserver.observe(mainContent, {
                childList: true,
                subtree: true
            });
        }

        // 3. Sidebar Observer - watches available playlists in sidebar
        const sidebarObserver = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    shouldUpdate = true;
                }
            });
            if (shouldUpdate) {
                setTimeout(extractAvailablePlaylistsInfo, 200);
            }
        });

        // Observe sidebar for available playlists changes
        const sidebar = document.querySelector('ytmusic-guide-renderer, #guide-content');
        if (sidebar) {
            sidebarObserver.observe(sidebar, {
                childList: true,
                subtree: true
            });
        }
    }

    // Set up observers immediately and retry if elements not found
    setupObservers();

    // Retry observer setup after page loads more content
    setTimeout(setupObservers, 2000);
    setTimeout(setupObservers, 5000);

    // General DOM observer to catch new elements being added
    const generalObserver = new MutationObserver(function(mutations) {
        let shouldRetrySetup = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if important elements were added
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (node.nodeType === 1) { // Element node
                        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
                        if (tagName.includes('ytmusic') ||
                            node.id === 'main-panel' ||
                            node.querySelector && (
                                node.querySelector('ytmusic-player-bar') ||
                                node.querySelector('ytmusic-guide-renderer')
                            )) {
                            shouldRetrySetup = true;
                            break;
                        }
                    }
                }
            }
        });
        if (shouldRetrySetup) {
            setTimeout(setupObservers, 500);
        }
    });

    // Observe the entire document for new YouTube Music elements
    generalObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Temporary increased frequency polling for debugging
    setInterval(extractPlaybackInfo, 1000);       // Back to more frequent for debugging
    setInterval(extractCurrentPlaylistInfo, 3000);   // Back to more frequent for debugging
    setInterval(extractAvailablePlaylistsInfo, 10000); // Keep this less frequent

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

// Create separate observable states for different update patterns
const playbackState$ = observable<PlaybackState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: "0:00",
    currentTrackIndex: -1,
    isLoading: true,
    error: null,
});

const playlistState$ = observable<PlaylistState>({
    songs: [],
    suggestions: [],
    currentPlaylistId: undefined,
});

const playlistsState$ = observable<PlaylistsState>({
    availablePlaylists: loadCachedYTMPlaylists(),
});

// Legacy combined state removed - components now use specific states directly

let webViewRef: React.MutableRefObject<WebView | null> | null = null;

const executeCommand = (command: string, ...args: any[]) => {
    const script = `window.ytMusicControls.${command}(${args.map((arg) => JSON.stringify(arg)).join(", ")}); true;`;
    webViewRef?.current?.injectJavaScript(script);
};

// Function to sync YouTube Music playlists with our persistent storage
const syncYouTubeMusicPlaylists = (ytmPlaylists: YTMusicPlaylist[]) => {
    try {
        batch(() => {
            playlistsData$.playlistsYtm.set(arrayToObject(ytmPlaylists, "id"));
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

    const playlistIdForUrl = playlistId.replace(/^VL/, "");

    try {
        // Convert YouTube Music songs to M3U format
        const m3uSongs: M3UTrack[] = songs.map((track) => ({
            duration: parseDurationToSeconds(track.duration), // Parse MM:SS format to seconds
            title: track.title,
            artist: track.artist,
            filePath: generateYouTubeMusicWatchUrl(track.id || "", playlistIdForUrl),
            logo: track.thumbnail, // Include thumbnail as logo
        }));

        // Convert YouTube Music suggestions to M3U format
        const m3uSuggestions: M3UTrack[] = suggestions.map((track) => ({
            duration: parseDurationToSeconds(track.duration), // Parse MM:SS format to seconds
            title: track.title,
            artist: track.artist,
            filePath: generateYouTubeMusicWatchUrl(track.id || "", playlistIdForUrl),
            logo: track.thumbnail, // Include thumbnail as logo
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
};

export function YouTubeMusicPlayer() {
    const localWebViewRef = useRef<WebView>(null);

    const uri = useSelector(() => {
        const playlistId = stateSaved$.playlist.get();
        const playlistType = stateSaved$.playlistType.get();
        const songId = state$.songId.get();

        console.log("songId", songId);

        if (playlistType === "ytm" && playlistId) {
            const playlistIdForUrl = playlistId.replace(/^VL/, "");

            // If we have a songId, use the watch URL format
            if (songId) {
                return generateYouTubeMusicWatchUrl(songId, playlistIdForUrl);
            }

            // Otherwise, use the playlist URL
            return `https://music.youtube.com/playlist?list=${playlistIdForUrl}`;
        }

        return "https://music.youtube.com/";
    });

    // Set the global ref to this instance
    React.useEffect(() => {
        webViewRef = localWebViewRef;
        return () => {
            webViewRef = null;
        };
    }, []);

    // Log cached playlists on component mount
    useEffect(() => {
        const cachedPlaylists = playlistsState$.availablePlaylists.get();
        if (cachedPlaylists.length > 0) {
            console.log(`Loaded ${cachedPlaylists.length} persisted YouTube Music playlists on startup`);
        }
    }, []);

    const handleMessage = (event: any) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);

            switch (message.type) {
                case "playbackState": {
                    playbackState$.assign(message.data);
                    break;
                }
                case "playlistState": {
                    playlistState$.assign(message.data);

                    // Update playlist content (M3U format) when tracks are received
                    if (message.data.songs && Array.isArray(message.data.songs)) {
                        updatePlaylistContent(
                            stateSaved$.playlist.get(),
                            message.data.songs,
                            message.data.suggestions || [],
                        );
                    }
                    break;
                }
                case "playlistsState": {
                    playlistsState$.assign(message.data);

                    // Sync YouTube Music playlists when they're updated
                    if (message.data.availablePlaylists && Array.isArray(message.data.availablePlaylists)) {
                        syncYouTubeMusicPlaylists(message.data.availablePlaylists);
                    }
                    break;
                }
                case "error":
                    playbackState$.error.set(message.data.error);
                    playbackState$.isLoading.set(false);
                    break;
                case "injectionComplete":
                    playbackState$.isLoading.set(false);
                    break;
            }
        } catch (error) {
            console.error("Failed to parse WebView message:", error);
            playbackState$.error.set("Failed to parse player message");
        }
    };

    return (
        <View className="flex-1">
            <WebView
                ref={localWebViewRef}
                source={{ uri }}
                javaScriptEnabled={true}
                webviewDebuggingEnabled
                domStorageEnabled={true}
                startInLoadingState={true}
                mixedContentMode="compatibility"
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                injectedJavaScript={injectedJavaScript}
                onMessage={handleMessage}
                onLoadStart={() => playbackState$.isLoading.set(true)}
                onLoadEnd={() => {
                    // Injection will set loading to false
                }}
                onError={(error) => {
                    playbackState$.error.set(`WebView error: ${error.nativeEvent.description}`);
                    playbackState$.isLoading.set(false);
                }}
                userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
                className="flex-1"
            />
        </View>
    );
}

// Export player state and controls for use in other components
export { controls, playbackState$, playlistState$, playlistsState$ };
export type { PlayerState, PlaybackState, PlaylistState, PlaylistsState, PlaylistTrack, Track, YTMusicPlaylist };
