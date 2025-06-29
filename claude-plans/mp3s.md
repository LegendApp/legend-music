## Instructions

- Follow all of the steps in order, one by one
- Check them off in this file as they are completed
- Do a git commit with a brief description of the change for each step before moving to the next step, including this file
- Remember that this is a React Native MacOS app, so iOS only APIs will not work.
- Use Legend State for state
- Use Reanimated for animations

## Steps

[x] Dropdown menus should activate on mouse down rather than click. If the mouse is already down when it's opened, mouse up should activate the selected item.
[] Improve the styling of the Suggestions header in the playlist
[] YouTubeMusicPlayer.tsx should set the url including stateSaved$.songId if available. Use this format: `https://music.youtube.com/watch?v=${track.id}&list=${playlistIdForUrl}` and extract that to a helper function and replace the few places it's used
[] Remove playTrackAtIndex and set the stateSaved$.songId instead

## Plan for later (do not do these yet)

[] Handle media keys
[] Make an expanded playlist view
[] Youtube Music seems to only load track thumbnails after scrolling down
[] Make a native module for opening new windows.