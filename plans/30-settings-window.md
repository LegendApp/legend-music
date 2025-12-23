# Plan

Deliver a Finder-style macOS settings window by moving layout
responsibility for the sidebar and page title into native titlebar-aware
views, while keeping non-mac layout unchanged.

## Requirements

- Finder-style macOS settings window using native AppKit controls.
- Sidebar fills top-to-bottom, including the titlebar region.
- Left-aligned title with a prefix ("Settings — <Page>") pinned at the top
  of the window.

## Scope

- In: macOS settings window UI, native modules for titlebar accessory/title
  updates, settings layout wiring.
- Out: non-mac platforms and broader settings redesign.

## Files and entry points

- `src/settings/SettingsContainer.tsx`
- `src/settings/components/SettingsLayout.tsx`
- `src/windows/index.ts`
- `src/native-modules/WindowManager.ts`
- `macos/LegendMusic-macOS/WindowManager/WindowManager.m`
- `macos/LegendMusic-macOS/SidebarSplitView/SidebarSplitView.swift`
- New native module files under `macos/LegendMusic-macOS/TitlebarAccessory/`
- `macos/LegendMusic.xcodeproj/project.pbxproj`

## Data model / API changes

- Add a native titlebar accessory module that can set left-aligned title
  text per window.
- Consolidate settings page metadata (id, label, title) so the sidebar and
  titlebar stay in sync.

## Action items

[ ] Ensure the settings window content view truly extends into the titlebar
(mirror the main window frame adjustment for `FullSizeContentView` if
needed) so the split view reaches the top edge.
[ ] Build a native module for a titlebar accessory using
`NSTitlebarAccessoryViewController` + `NSTextField` aligned left; expose
methods to set text and attach/detach to a window by identifier.
[ ] Wire the JS bridge (`src/native-modules/...`) and update
`SettingsContainer` to push "Settings — <Page>" on selection changes; fall
back to no-op on non-mac.
[ ] Update `SettingsLayout` to optionally hide the in-scroll header on
macOS, keeping the title only in the native titlebar.
[ ] Review `SidebarSplitView` and `NativeSidebar` styling to ensure the
sidebar background uses proper native material and is not inset below the
titlebar.
[ ] Manual validation of sidebar height, title alignment, and title changes
across settings pages.

## Testing and validation

- Manual: open settings window, switch pages, resize, and verify title
  stays pinned while content scrolls.
- Optional: `bun run lint`.

## Risks and edge cases

- Accessory title may collide with window controls; add leading inset to
  clear traffic lights.
- Window frame adjustments could affect saved window size/position; scope
  changes to settings window only.
- Title updates should avoid triggering window reconfiguration/flicker.

## Open questions

- Confirm exact prefix string and truncation behavior for long page titles.
- Should the native title update also change the window title (for Mission
  Control) or only the accessory label?
