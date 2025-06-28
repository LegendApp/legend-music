## Instructions

- Follow all of the steps in order, one by one
- Check them off in this file as they are completed
- Do a git commit with a brief description of the change for each step before moving to the next step, including this file
- Remember that this is a React Native MacOS app, so iOS only APIs will not work.
- Use Legend State for state
- Use Reanimated for animations

## Steps

[x] Youtube Music playlists should be saved with an "index" property which is used for opening it, rather than parsing the index from the sidebar_id
[x] When a YTM playlist is opened, it should parse the id out of the url and update its id, replacing its temporary id
[] The Playlist should use LegendList rather than the scrollview
[] Implement ID3 tag parsing for the mp3s to get the artist name and song title. `bun add id3js` to install it, and see the documentation at https://github.com/43081j/id3

## Plan for later (do not do these yet)

[] Handle media keys
[] Make an expanded playlist view