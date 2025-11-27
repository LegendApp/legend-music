# Convert useEffect with useValue deps

- [ ] List useEffect hooks with `useValue`-derived dependencies and record targets
- [ ] Convert identified hooks to `useObserveEffect`
- [ ] Review and finalize plan status

## Targets

- `src/components/CustomSlider.tsx`: thumb height animation effect depends on `isHovered`/`isDragging` from `useValue`.
- `src/components/DropdownMenu.tsx`: submenu visibility effects depend on `activeSubmenuId` from `useValue`.
- `src/components/MediaLibrary/LibraryTree.tsx`: selection guard effect depends on collection data from `useValue`.
- `src/components/Playlist.tsx`: instrumentation/scroll/selection effects depend on player/queue state from `useValue`.
- `src/components/MediaLibrary/useLibraryTrackList.ts`: selection reset effect depends on `selectedItem` from `useValue`.
- `src/settings/OverlaySettings.tsx`: duration draft sync effect depends on `useValue`.
- `src/settings/CustomizeUISettings.tsx`: layout completeness effects depend on layouts from `useValue`.
- `src/visualizer/VisualizerWindowManager.tsx`: open/auto-close effects depend on `isOpen`/playback from `useValue`.
- `src/media-library/MediaLibraryWindowManager.tsx`: open/close effect depends on `isOpen` from `useValue`.
- `src/overlay/CurrentSongOverlayWindowManager.tsx`: open/reposition effect depends on overlay/window state from `useValue`.
- `src/overlay/CurrentSongOverlayWindow.tsx`: hover sizing effect depends on overlay exit flag from `useValue`.
