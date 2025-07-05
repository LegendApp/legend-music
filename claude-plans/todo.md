## Instructions

- Follow all of the steps in order, one by one
- After each step is completed and before moving to the next step, check off the completed step in this file. Then do a git commit with a brief description of the changes in all chaged files, including the updated plan file.

## Steps

[x] Add an Unregistered component which displays below the playlist. It should be hidden on startup, and display after 10 minutes in a pretty subtle way. Then after 20 more minutes it should become less subtle. Then after 30 more minutes it should become much less subtle.
[x] Add an Open Source page to the settings. It should detail that the app is fully open source and the libraries it uses (with links to their githubs): React Native MacOS, Legend State, Legend List, Expo, Nativewind, Tailwind, id3js, gorhom portal, biome. If you don't know a link just leave a TODO there.
[x] In the Open Source page it should have a small advertisement for Legend Kit, which is a set of useful tools on top of Legend State/List/Motion and includes premium versions of Legend Music and future Legend apps.
[x] In the Accounts page it should have two modes, registered and unregistered. If registered it should just say it's registered and thank you. If unregistered it should describe how it's free and open source but we need support to improve this app and other Legend tools. There are two options for registering: purchase Legend Kit (include some details on this page that were created in the step above) or a $9 one time price.

## Plan for later (do not do these yet)

[] Restore window size
[] The settings window is doing the same stoplights hiding as the main window
[] What if the playback buttons didn't have a border?
[] Finish UI for selecting mp3 folders
[] Clean up the directories in cache where files go. m3u should go in playlists
[] Allow user to select where m3u files go
[] Selecting a song in a non-playlist should switch to now playing
[] Need to make sure it's playing song not video
[] Sometimes on load is says "Sponsored" with 0:00
[] New logo