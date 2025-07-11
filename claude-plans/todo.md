## Instructions

- Follow all of the steps in order, one by one
- After each step is completed and before moving to the next step, check off the completed step in this file. Then do a git commit with a brief description of the changes in all chaged files, including the updated plan file.

## Steps

[] Add hotkeys for media controls. I think we can use our useOnHotkeys hook for that.

## Plan for later (do not do these yet)

[] Does reducing the frequency of player time observer significantly improve cpu usage? If so we could reduce frequency and assume it's playing and just increment in JS? Or something different in native code?
[] It's using a lot of CPU while playing. Is that from UI or just playing the song?
[] Go back to old non-callout dropdown if it's not fixed soon
[] How to detect errors in ytm and show it?
[] Initial enabling of ytm would need to show it to be able to sign in
[] The settings window is doing the same stoplights hiding as the main window? Not reproing anymore...
[] What if the playback buttons didn't have a border?
[] Finish UI for selecting mp3 folders
[] Clean up the directories in cache where files go. m3u should go in playlists
[] Allow user to select where m3u files go
[] Selecting a song in a non-playlist should switch to now playing
[] Need to make sure it's playing song not video
[] Sometimes on load is says "Sponsored" with 0:00
[] New logo