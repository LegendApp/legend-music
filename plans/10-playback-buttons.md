## Plan
Make playback controls more accessible while keeping the primary UI clean, and let users customize which transport buttons they see.

## Playback Menu & Hotkeys
- Add a `Playback` submenu in `src/native-modules/NativeMenuManager.ts` containing previous, play/pause, next, shuffle, and repeat items with platform-appropriate icons and state.
- Wire each menu item to the underlying controls in `localAudioControls`, ensuring menu state reflects playback status (e.g., toggled repeat/shuffle).
- Register new global hotkeys in `src/systems/hotkeys.ts` (and associated managers) for previous, play/pause, next, shuffle, and repeat, and surface conflicts or errors to logging.

## Hotkey Settings
- Extend `src/settings/HotkeySettings.tsx` to list the new actions with editable shortcuts and validation feedback.
- Persist any new hotkey preferences through existing settings/state pathways so the menu and playback layer stay in sync.

## UI Customization State
- Introduce data structures (in `src/systems/Settings.ts`) describing available playback and bottom-bar controls plus their visibility/order.
- Provide defaults that mirror current layouts and ensure migrations honor existing user settings.
- Expose composable selectors/hooks so `PlaybackArea` and the bottom bar can render buttons based on the customized configuration.

## Customize UI Settings Page
- Create a `CustomizeUISettings.tsx` page with sections for the playback area and bottom bar, using draggable rows to move actions between “Shown” and “Hidden” lists and reorder within each list.
- Ensure drag-and-drop updates persist immediately through the customization state and give users clear affordances (icons, labels, tooltips).
- Integrate the new page into the settings navigation (`SettingsLayout`/`SettingsContainer`) with appropriate routing and titles.

## Validation & Follow-up
- Add unit or interaction tests covering menu updates, hotkey persistence, and customized button rendering, or document manual QA plans.
- Update relevant documentation/help text so users know about the playback menu, hotkeys, and customization options.

## Steps
- [x] Implement playback submenu controls and hotkeys.
- [x] Expand hotkey settings UI for new actions.
- [x] Model customization state and wire playback/bottom bar rendering.
- [x] Build Customize UI settings page with drag-and-drop lists.
- [x] Validate behavior and document follow-up tasks.
