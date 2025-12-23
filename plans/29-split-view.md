## Plan
Add a native split view wrapper for macOS and replace the settings layout with it so the Sidebar and Content panes are resized via NSSplitView while keeping the current styling and behavior.

## Current Files & Concepts (No Prior Context Required)
- Native NSSplitView implementation: `macos/LegendMusic-macOS/SplitView/RNSplitView.m`, `macos/LegendMusic-macOS/SplitView/RNSplitView.h`
- Native view wrapper patterns: `src/native-modules/DragDropView.tsx`, `src/native-modules/GlassEffectView.tsx`, `macos/LegendMusic-macOS/DragDrop/DragDropView.swift`
- Settings layout and sidebar: `src/settings/SettingsContainer.tsx`, `src/components/Sidebar.tsx`

## Desired UX
- Settings window uses a native split view divider between the sidebar and content.
- Sidebar is visible on first render with a reasonable default width and minimum size.
- Content expands to fill remaining space and stays visible during resize.
- Divider drag resizes panes without blank or zero-width panels.

## Steps
- [x] Add a `SplitView` wrapper in `src/native-modules/SplitView.tsx` using `requireNativeComponent("RNSplitView")`, `cssInterop`, and typed props (`isVertical`, `dividerThickness`, `onSplitViewDidResize`).
- [x] Confirm `RNSplitView` is included in the macOS target; adjust minimum sizes or defaults if they conflict with the settings sidebar width.
- [x] Update `src/settings/SettingsContainer.tsx` to render Sidebar and Content as the two direct children of `SplitView`, keeping background and padding styles aligned with the current layout.
- [x] Add any wrapper views/className needed so both panes have explicit sizing and the content pane remains `flex-1`.

## Validation
- Manual: Settings view renders with a visible sidebar and content pane; divider drags to resize; no pane disappears or collapses below the minimum size.
- Manual: Sidebar list and settings content remain interactive after resize.
