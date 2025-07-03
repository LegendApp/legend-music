## Instructions

- Follow all of the steps in order, one by one
- Check them off in this file as they are completed
- Do a git commit with a brief description of the change for each step before moving to the next step, including this file
- Remember that this is a React Native MacOS app, so iOS only APIs will not work.
- Use Legend State for state
- Use Reanimated for animations

## Steps

[x] Add a search button to the right of the playlist selector which is only visible if the local files playlist is selected
[x] Clicking the search button should show a dropdown menu with a textbox and a list of results
[x] Searching should search through all local files and playlists and display them in the list of results
[x] Selecting a track in search should add it to now playing and start playing it


## Plan for later (do not do these yet)

[] Playing a song overwrites the logos
[] Hotkey to open a search
[] Clicking a song on a playlist that's not currently open does not immediately play it until clicking it again
[] Make a native module for opening new windows.
[] Selecting a song in a non-playlist should switch to now playing
[] Have a menu item / hotkey to enable ytm view where it shows it to the right
[] Make an expanded playlist view
    [] Local files should display as a tree of artist / album