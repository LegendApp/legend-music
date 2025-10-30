## Plan
Introduce a Skia-backed text primitive that updates via observables without triggering React rerenders, then migrate the playback time labels to use it.

## Skia Text Primitive
- Build a `SkiaText` component in `src/components/` that renders a text node via `@shopify/react-native-skia`.
- Accept props with a `text$` `Observable<string>` alongside typography settings (font, size, color, alignment).
- Subscribe to `text$` once on mount, mirror the latest value into a Reanimated `SharedValue`, and release the subscription on unmount.
- Render the Skia text using a stable draw callback that reads the shared value so updates stay UI-thread only.
- Provide a fallback `text` prop (string) for non-observable usage, defaulting to empty when neither is supplied.

## Playback Area Integration
- Remove hover-gated logic around current time and duration indicators so they always render.
- Replace `CurrentTime` and `CurrentDuration` implementations with the new `SkiaText`, wiring up their existing observables.
- Ensure font/color sizing matches the rest of the playback controls after the migration.
- Verify the new component leaves the surrounding layout unchanged and keeps updates smooth during playback.

## Validation & Follow-up
- Add unit coverage around subscription lifecycle (mock observable, assert unsubscribe) or note gaps if Skia makes UI testing impractical.
- Evaluate whether other readouts (e.g., remaining time, song title) should migrate to `SkiaText` for consistency and note in roadmap if so.
- Confirm no regressions in hover behavior or accessibility; document new component API in relevant README or Storybook if available.

## Steps
- [x] Implement `SkiaText` shared-value component with observable subscription management.
- [x] Swap playback time labels to `SkiaText` and remove hover-only visibility.
- [ ] Validate behavior (manual playback check, add/update tests or document gaps) and capture follow-up opportunities.
