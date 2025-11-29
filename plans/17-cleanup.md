## Plan
Prune unused surface area, tighten duplicated logic, align styling with Tailwind conventions, and tame noisy logging to improve code quality before the next iteration.

## Dead Code & Surface Area
- Remove unused components/hooks (`SidebarHeading`, `SkiaWrapper`, `HookWindowFullscreen`), native wrappers (`SplitView`, `WindowControls` helper), and dormant settings views (`HotkeySettings`, `PluginSettings`) to shrink maintenance surface.
- Drop orphaned state/cache helpers (`libraryUIState$`, `measureNavTime`, `resetLibraryCaches`, playlist cache helper exports, playlist getters, library cache availability shims) and unused types (`BaseSFSymbol` variants) unless they are wired into routing.
- Delete unused utilities (`ShadowDropdown`, color utils, array helpers, m3u validation, openUrl, pickPaths, formatRelativeDate/decodeTextEntities) or move them behind a documented consumer.

## Playback/Cache Consistency
- Consolidate playlist thumbnail key/URI derivation so queue persistence and LocalAudioPlayer share a single helper.
- Keep playlist and library cache sanitizers lean with clear defaults and tests for legacy data shapes.

## Styling Alignment
- Replace remaining `StyleSheet.create` usages with Tailwind-style `className` where practical, matching project styling guidance.

## Logging Hygiene
- Gate or remove verbose `console.log` calls (playlist operations, keyboard handling, local music state) and prefer a debug flag to keep production output clean.

## Steps
- [x] Remove unused components, hooks, native wrappers, settings views, orphaned stores/helpers, unused utils, and unused symbol types.
- [x] Refactor playlist thumbnail handling into a shared helper used by cache read/write and queue hydration; keep sanitizer tests green.
- [x] Convert prioritized `StyleSheet` blocks to Tailwind classes to align with styling conventions.
- [x] Reduce noisy logging by gating or deleting debug-only `console.log` calls.
