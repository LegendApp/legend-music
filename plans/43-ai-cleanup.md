## Plan
Clean up AI source selection behavior to keep Local Library always available, ensure selected services remain visible
even when unavailable, and align AI features with the prompt source choice across providers and queue extensions.

## Research Notes
- `src/settings/AISettings.tsx` builds the AI settings dropdowns; preferred service options are filtered by enabled
  providers and currently hide disabled selections.
- `src/systems/suggestions/providers/spotify.ts` ignores `promptSource`, so Local Library prompts can still route through
  Spotify even when the user chooses a local-only source.
- `src/components/AudioPlayer.tsx` and `src/components/Playlist.tsx` enqueue AI suggestions without passing a prompt
  source, so they always rely on the global default and not any per-playlist source metadata.
- `src/systems/suggestions/ai/aiProvider.ts` already respects `promptSource` for local library constraints and provider
  restrictions; other providers should follow the same behavior or surface a warning.

## Steps
- [x] Update the Preferred Service dropdown to always include the currently selected provider, even when unavailable,
      and label unavailable providers as "Not Available".
- [ ] Ensure the Local Library option is always visible and selectable in AI source-related settings regardless of
      streaming provider availability.
- [ ] Respect `promptSource` in the Spotify suggestion provider by rejecting or warning on local-library requests, or
      by rerouting to the AI provider pipeline when local-only prompts are requested.
- [ ] Pass prompt source settings into auto-extend queue and context-menu queue extension flows so they respect the
      selected default (or future per-playlist sources where applicable).

## Validation
Confirm the Preferred Service dropdown shows the selected provider even if disabled and labels it as unavailable; Local
Library always appears in AI source selectors; Spotify suggestions honor local-library prompts by refusing or rerouting;
queue auto-extend and context menu extensions respect the prompt source selection.
