## Instructions

- Follow all of the steps in order, one by one
- Check them off in this file as they are completed
- Do a git commit with a brief description of the change for each step before moving to the next step, including this file
- Remember that this is a React Native MacOS app, so iOS only APIs will not work.
- Use Legend State for state
- Use Reanimated for animations

## Steps

[x] Split the playerState code in the YouTubeMusicPlayer code into three different kinds of player state, because we will want them all to update at different times. So split out the playlistsState, playlistState, and playbackState.
[x] Instead of polling for changes in youtube music on an interval, use a less intensive strategy. Use MutationObserver on the specific areas of the UI that's being watched for changes to trigger updates.

## Plan for later (do not do these yet)

[] The Playlist should use the cached playlist on load.
[] Handle media keys
[] Make an expanded playlist view
[] Youtube Music seems to only load track thumbnails after scrolling down