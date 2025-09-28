[x] usePlaylistSelection.ts has a lot of duplicated code. Clean it up to reuse code where it makes sense.
[x] Replace the keyboard events in usePlaylistSelection.ts with useOnHotkeys. You'll need to add Up/Down types to HotkeyCallbacks.
[] Add a delete key handler in usePlaylistSelection.ts to delete the selected items from the playlist.
[] Add a Cmd + A hotkey to select all items in the playlist.

## Punt (do not do these)
1. Try to fix album art
2. Add tooltips with button description and hotkey
3. Media Library should have a recently added feature or sort by date or something
4. Delete key should remove the selected track
