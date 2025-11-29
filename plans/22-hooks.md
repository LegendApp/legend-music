# useEffect audit

- [x] Replace `useEffect` with an empty dependency array in `Button` with `useMount`
- [x] Replace remaining empty dependency `useEffect` usages with `useMount`
- [x] Audit remaining `useEffect` usages and document categories

## Notes

### Window lifecycle & navigation
- [x] `src/visualizer/VisualizerWindowManager.tsx`: subscribe to window close events, open/close the visualizer window from observable state, and auto-close when playback stops.
- `src/media-library/MediaLibraryWindowManager.tsx`: track the library window closing and open/close it with sizing derived from preferences and main window geometry.
- `src/overlay/CurrentSongOverlayWindowManager.tsx`: finalize overlay dismissal on window close and open/reposition the overlay window with saved dimensions when visibility or sizing changes.
- [x] `src/overlay/CurrentSongOverlayWindow.tsx:124`: watch hover/exiting state to adjust target overlay window dimensions (setters are currently commented).
- `src/windows/useWindowFocusEffect.ts:11`: attach a focus listener and run a callback when the matching window gains focus.
- `src/windows/createWindowsNavigator.tsx:144`: lazily resolve window components on mount before registering with `AppRegistry`.

### Visualizer runtime
- `src/visualizer/shaders/ShaderSurface.tsx:145`: reset FFT buffers and uniforms when bin counts or limits change.
- `src/visualizer/shaders/ShaderSurface.tsx:180`: run a requestAnimationFrame loop to advance the time uniform while a shader is active.
- `src/visualizer/shaders/ShaderSurface.tsx:203`: configure the audio visualizer, stream FFT frames into uniforms, and tear down the listener on cleanup.
- `src/visualizer/shaders/ShaderSurface.tsx:297`: log shader compile errors.

### Playback and selection sync
- `src/components/PlaybackArea.tsx:44,58`: subscribe to playback time/duration observables to drive Skia text readouts.
- `src/components/PlaybackArea.tsx:108`: animate overlay control opacity with a spring when overlay visibility toggles.
- [x] `src/components/Playlist.tsx:325`: scroll the playlist to the active track when playback index or queue entry changes.
- [x] `src/components/Playlist.tsx:354`: clear selection once playback becomes active.
- `src/components/MediaLibrary/useLibraryTrackList.ts:107`: clear list selection when the focused library item or track list changes.
- [x] `src/components/MediaLibrary/LibraryTree.tsx:145`: ensure the selected library item stays valid for the active collection.
- `src/components/TooltipProvider.tsx:25`: reset tooltip sizing when tooltip content clears.
- `src/components/SkiaText.tsx:57,63`: mirror string props or observable text into shared values and cached width for Skia rendering.
- [x] `src/settings/OverlaySettings.tsx:31`: keep the duration input draft in sync with the overlay duration observable.
- [x] `src/settings/CustomizeUISettings.tsx:108,112`: normalize playback and bottom bar layouts to include required controls when layouts change.

### Menus and keyboard handling
- `src/components/DropdownMenu.tsx:102`: mirror dropdown open state to a shared observable and parent `onOpenChange`.
- [x] `src/components/DropdownMenu.tsx:415`: close a submenu when another submenu becomes active.
- [x] `src/components/DropdownMenu.tsx:498`: toggle submenu content visibility based on the active submenu id.
- `src/components/PlaylistSelectorSearchDropdown.tsx:81`: focus the search input when the dropdown opens.
- `src/components/PlaylistSelectorSearchDropdown/hooks.ts:154`: reset highlighted index based on open state and result count.
- `src/components/PlaylistSelectorSearchDropdown/hooks.ts:168`: attach keyboard listeners for navigation and submission while the dropdown is open.

### Drag/drop and layout registration
- `src/components/dnd/DroppableZone.tsx:50`: register/unregister drop zones with measured rects.
- `src/components/dnd/DraggableItem.tsx:70`: remove Animated value listeners on unmount to avoid leaks.
- `src/components/dnd/DraggableItem.tsx:79`: sync the original item's fade state with the dragging flag via requestAnimationFrame.
- [x] `src/components/Playlist.tsx:317`: recompute drop area window rects after playlist size changes.
- [x] `src/components/Playlist.tsx:321`: clamp the cached drop index when queue length updates.
- `src/components/ResizablePanels.tsx:282`: register panels with the layout context and unregister on cleanup.

### Animations and visual feedback
- [x] `src/components/CustomSlider.tsx:61`: animate the slider thumb size on hover/drag.
- `src/components/SkiaSpinner.tsx:52`: spin the indicator continuously based on speed.
- `src/components/Toast.tsx:43`: animate toast entrance/exit and schedule auto-hide cleanup.

### UI sync, forms, and assets
- `src/components/AlbumArt.tsx:156`: load/caches album art thumbnails, updating loading/error state on URI changes.

### Notes on commented hooks
- `src/components/Playlist.tsx` and `src/components/dnd/DroppableZone.tsx` contain commented `useEffect` scaffolding for selection initialization and proximity updates.
