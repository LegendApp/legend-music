## Plan
Expand `PlaylistSelectorSearchDropdown` to support provider-backed search (local immediate, Spotify submit) and show
Spotify results on demand with a helper hint.

## Research Notes
- `src/components/PlaylistSelectorSearchDropdown.tsx` uses `usePlaylistSearchResults` and `buildSearchResults` in
  `src/components/PlaylistSelectorSearchDropdown/hooks.ts` for local tracks/playlists/library.
- Keyboard handling uses `useDropdownKeyboardNavigation` in `src/components/PlaylistSelectorSearchDropdown/hooks.ts`,
  which consumes Enter to select the highlighted item.
- Spotify search already exists in `src/providers/spotify/search.ts` and requires auth.
- Spotify badge component lives at `src/components/SpotifySourceBadge.tsx`.
- Track mapping for Spotify exists in `src/components/MediaLibrary/useLibraryTrackList.ts`
  (`buildSpotifyLibraryTrack`).

## Current Search Flow
- Search query is stored in `useSearchDropdownState` and cleared on close.
- Local search results are computed immediately from local tracks/playlists/albums/artists.
- Enter selects the highlighted result via `useDropdownKeyboardNavigation`.
- No provider gating or remote search behavior.

## Integration Design Considerations
- Move local-only search logic out of the dropdown into the local provider.
- Add provider search settings with `searchMode` ("immediate" vs "submit") and use them to decide if Enter should
  trigger a provider search.
- Spotify search should only be available when the Spotify provider is enabled (active provider).
- Enter should trigger Spotify search only once per query and should not select results when it triggers a search.
- Changing the query or closing the dropdown clears any Spotify results and resets the "searched" marker.
- Use a shared Spotify track -> `LocalTrack` mapper so search results queue consistently with other Spotify flows.

## Suggested Module Additions
- `src/providers/search/types.ts` (or extend `src/providers/types.ts`) to define a search provider shape with `id`,
  `searchMode`, and `search`.
- `src/providers/local/search.ts` to host the extracted local search logic and export a local search provider config.
- `src/providers/spotify/searchProvider.ts` (or extend `src/providers/spotify/search.ts`) to add search provider config
  and reuse `searchSpotifyTracks`.
- `src/providers/spotify/mapTrack.ts` (or move the existing mapper) for `ProviderTrack` -> `LocalTrack` mapping used
  by search and library.

## UI/Interaction Notes
- Show "Press enter to search Spotify" at the bottom when the query is non-empty, Spotify is enabled, and Spotify has
  not been searched for that query.
- Render Spotify results in the same list and add `SpotifySourceBadge` on the right for Spotify tracks.
- Keep local results visible while Spotify search is pending; optionally show a small loading or error row for Spotify
  only.

## Steps
- [x] Define the search provider config (search mode + search function) and wire provider-enabled checks.
- [ ] Move local search logic into the local provider and update dropdown/tests to use it.
- [ ] Add Spotify search provider logic with query tracking, result clearing on input change, and track mapping.
- [ ] Update dropdown keyboard handling so Enter triggers Spotify search once per query and does not select a result
  when it does.
- [ ] Add Spotify icon rendering for Spotify results and the "Press enter" helper text.

Validation: Run the search dropdown manually; verify local results still appear immediately, Enter triggers Spotify
search once per query when Spotify is enabled, results clear on text change, and Spotify items show the badge.
