# Media Library Implementation Plan

## Overview
Implement a horizontal split layout with media library below the main player. Library toggles open/closed with smooth animation and provides comprehensive music browsing capabilities.

## UI Layout & Structure

### Window Sizing
- **Default (library closed)**: ~500x350px
- **Expanded (library open)**: ~500x600px
- **Smooth height animation** when toggling (250ms ease-in-out)
- **Remember state** between app launches

### Layout Components
```
MainWindow
├── PlayerSection (fixed height ~200px)
│   ├── NowPlayingBar
│   ├── QueueView
│   └── PlayerControls
├── LibraryToggleButton
└── LibrarySection (animated height 0px ↔ ~250px)
    ├── LibraryHeader (with close button)
    └── LibraryContent (horizontal split)
        ├── LibraryTree (30% width)
        └── TrackList (70% width)
```

## Component Architecture

### 1. Core Components

#### `MediaLibrary.tsx`
- Container component for entire library section
- Handles open/close state and animation
- Manages keyboard shortcuts (Cmd+L)

#### `LibraryTree.tsx`
- Left pane with hierarchical navigation
- Tree view: Artists → Albums, Playlists, All Songs
- Search functionality
- Expandable/collapsible nodes

#### `TrackList.tsx`
- Right pane showing tracks for selected item
- Columns: Title, Duration, Artist, Album
- Add to queue buttons/double-click
- Drag & drop support to queue

#### `QueueView.tsx` (enhance existing)
- Current playing queue
- Drag & drop target from library
- Reorder capability

### 2. Data Models

#### Library Structure
```typescript
interface LibraryItem {
  id: string
  type: 'artist' | 'album' | 'playlist' | 'track'
  name: string
  children?: LibraryItem[]
  trackCount?: number
  duration?: number
}

interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  filePath: string
  albumArt?: string
  metadata: AudioMetadata
}
```

## State Management (Legend State)

### Library State (`src/systems/LibraryState.ts`)
```typescript
// Library UI state
export const libraryUI$ = observable({
  isOpen: false,
  selectedItem: null as LibraryItem | null,
  searchQuery: '',
  expandedNodes: [] as string[],
})

// Library data
export const library$ = observable({
  artists: [] as LibraryItem[],
  albums: [] as LibraryItem[],
  playlists: [] as LibraryItem[],
  tracks: [] as Track[],
  isScanning: false,
  lastScanTime: null as Date | null,
})
```

### Integration with Existing State
- Extend `src/systems/State.ts` for queue management
- Add library shortcuts to settings
- Integrate with existing player controls

## Library Scanning & Metadata

### File System Integration
```typescript
// src/library/LibraryScanner.ts
class LibraryScanner {
  async scanMusicFolders(folders: string[]): Promise<Track[]>
  async extractMetadata(filePath: string): Promise<AudioMetadata>
  async generateLibraryTree(tracks: Track[]): Promise<LibraryItem[]>
  watchForChanges(folders: string[]): void
}
```

### Supported Formats
- **Audio**: MP3, M4A, AAC, FLAC, WAV
- **Playlists**: .m3u, .m3u8 files
- **Metadata**: ID3 tags, album art extraction

### Storage & Persistence
- Use existing `ExpoFSPersistPlugin` pattern
- Cache metadata to avoid re-scanning
- Store library tree structure
- Track file modification times for incremental updates

## Playlist Support

### .m3u Integration
```typescript
// src/library/PlaylistManager.ts
class PlaylistManager {
  async importM3UFile(filePath: string): Promise<LibraryItem>
  async exportPlaylist(playlist: LibraryItem, format: 'm3u'): Promise<void>
  async createPlaylist(name: string, tracks: Track[]): Promise<LibraryItem>
}
```

### Playlist Features
- Import existing .m3u/.m3u8 files
- Create custom playlists within app
- Edit playlist contents (add/remove/reorder)
- Export playlists to .m3u format

## Implementation Phases

### Phase 1: Basic Layout & UI
1. **Create base components**
   - `MediaLibrary.tsx` with toggle functionality
   - Basic layout structure with placeholder content
   - Smooth open/close animation

2. **Window management**
   - Dynamic height adjustment
   - State persistence
   - Keyboard shortcut (Cmd+L)

### Phase 2: Library Tree & Navigation
1. **LibraryTree component**
   - Hierarchical tree view (Artists/Albums/Playlists)
   - Expand/collapse functionality
   - Selection handling

2. **Basic data structure**
   - Mock library data for development
   - Selection state management
   - Tree navigation logic

### Phase 3: Track List & Integration
1. **TrackList component**
   - Display tracks for selected library item
   - Add to queue functionality
   - Double-click to play

2. **Queue integration**
   - Enhance existing queue component
   - Add tracks from library
   - Drag & drop support

### Phase 4: File System Scanning
1. **Library scanner implementation**
   - Scan music folders for audio files
   - Extract basic metadata (title, artist, album, duration)
   - Build library tree from scanned files

2. **Settings integration**
   - Music folder selection in settings
   - Scan triggers and progress indication
   - File watching for automatic updates

### Phase 5: Playlist Support
1. **.m3u file support**
   - Import existing playlist files
   - Display in library tree
   - Load playlist contents

2. **Playlist management**
   - Create custom playlists
   - Edit playlist contents
   - Export functionality

### Phase 6: Polish & Optimization
1. **Performance optimization**
   - Virtual scrolling for large libraries
   - Efficient metadata caching
   - Background scanning

2. **Enhanced features**
   - Album art display
   - Advanced search and filtering
   - Library statistics and views

## Technical Implementation Notes

### Animation Implementation
```typescript
// Use Reanimated for smooth height transitions
const libraryHeight = useSharedValue(0)
const animatedStyle = useAnimatedStyle(() => ({
  height: libraryHeight.value,
}))

// Toggle function
const toggleLibrary = () => {
  libraryHeight.value = withTiming(
    libraryUI$.isOpen.get() ? 0 : LIBRARY_HEIGHT,
    { duration: 250 }
  )
  libraryUI$.isOpen.set(!libraryUI$.isOpen.get())
}
```

### Tree View Implementation
- Use FlatList with nested data structure
- Implement expand/collapse with animated height
- Maintain selection and expansion state
- Efficient rendering for large libraries

### Drag & Drop
- Implement drag from track list to queue
- Visual feedback during drag operations
- Support for multiple track selection
- Queue insertion at specific positions

## Integration Points

### Existing Components to Modify
- Main window layout structure
- Player controls positioning
- Queue component enhancement
- Settings for library folders

### New Dependencies (if needed)
- Audio metadata extraction library
- File system watching
- Playlist file parsing

### Testing Considerations
- Test with various audio file formats
- Large library performance testing
- Cross-platform file path handling
- Playlist file compatibility

## Future Enhancements
- Smart playlists (recently added, most played)
- Library statistics and insights
- Advanced search with filters
- Duplicate detection and management
- Integration with online metadata services