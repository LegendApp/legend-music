## Instructions

- Follow all of the steps in order, one by one
- Check them off in this file as they are completed
- Do a git commit with a brief description of the change before moving to the next step, including this file
- Remember that this is a React Native MacOS app, so iOS only APIs will not work.
- Use Legend State for state
- Use Reanimated for animations

## Steps

[x] The now playing area and playlist area need some visual separation. Make a nice looking subtle divider. The playlist selector should feel like it's the title bar for the playlist.
[x] The list of playlists should be stored in an observable array created with createJSONManager. See LocalMusicState.ts for an example of how that's set up. Put it in a Playlists.ts. Each playlist should have a "type" of "file" | "ytm". Each one should have [id, name, path, count].
[x] Create a reader and writer for the m3u playlist format to transform to a typed JS object.
[x] There should be an observable object that is a lookup table (a function taking a single string parameter) which returns a synced. That synced should persist with ExpoFSPersistPlugin and have transforms for both load and save in persist to load it from the m3u format and save it to the m3u format.

## Plan for later (do not do these yet)

[] Handle media keys
[] Make an expanded playlist view