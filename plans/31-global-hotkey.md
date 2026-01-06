## Plan
Add a configurable global hotkey that shows the main window:
- Settings UI with a hotkey capture field and enable toggle.
- macOS native global hotkey registration + event bridge.
- JS integration that registers/unregisters the hotkey and shows the window on activation.

This work should reuse the existing keyboard keycode/text mapping and settings patterns.

## Current Files & Concepts (No Prior Context Required)
- Settings UI: `src/settings/GeneralSettings.tsx`, `src/settings/components/SettingsLayout.tsx`
- Settings store: `src/systems/Settings.ts`
- Keyboard key maps + pressed state: `src/systems/keyboard/Keyboard.ts`, `src/systems/keyboard/KeyboardManager.ts`
- Capture guard: `src/systems/State.ts` (`listeningForKeyPress`)
- Window controls: `src/native-modules/WindowManager.ts`, `src/windows/index.ts`
- Existing hotkey persistence: `src/systems/hotkeys.ts`
- macOS native modules live under `macos/LegendMusic-macOS/`

## Desired UX

### A) Settings row
- "Global hotkey" row in General settings with:
  - Enable toggle.
  - A capture field showing the current shortcut (or "Click to record").
- When disabled, the capture field is read-only and the hotkey is unregistered.

### B) Capture behavior
- Clicking the field enters capture mode and shows pressed keys live.
- A capture saves when all keys are released.
- Ignore modifier-only combinations; keep the previous value if no valid key was pressed.
- Escape or blur cancels capture (no save), and capture mode exits cleanly.

### C) Activation
- When the global hotkey fires, the main window is shown/activated (open if needed).

## Data Model Changes
- Add a persisted setting for global hotkey, e.g.
  - `settings$.general.globalHotkeyEnabled: boolean`
  - `settings$.general.globalHotkey: KeyboardEventCodeHotkey | null`
- Define the stored format to align with `KeyboardEventCodeHotkey` and `KeyText` display.

## Native Module (macOS)
- New module `GlobalHotkey` that can:
  - Register a single hotkey (modifiers + key code).
  - Unregister the hotkey on disable or app shutdown.
  - Emit an activation event to JS.
- Return a registration result with success/failure + reason for UI feedback.

## UI + Systems Implementation Details

### 1) Hotkey capture control
File: `src/components/HotkeyCapture.tsx` (or `src/settings/components/HotkeyCapture.tsx`)
- Enter capture on click and set `state$.listeningForKeyPress`.
- Use `keysPressed$` + `KeyText` to build display text.
- Save on key release when at least one non-modifier key was pressed.
- Exit capture on blur/escape and restore previous value.

### 2) Settings wiring
File: `src/settings/GeneralSettings.tsx`
- Add a SettingsRow with the enable toggle and capture control.
- Show error state when native registration fails (if any).

### 3) Global hotkey registration + activation
Files: `src/native-modules/GlobalHotkey.ts`, `src/systems/GlobalHotkey.ts`
- Listen for setting changes and register/unregister with the native module.
- On activation event, call the window manager to bring the main window forward.
- No-op on non-mac platforms.

## Steps
- [x] Confirm the hotkey setting location (General vs separate section) and default binding.
- [x] Add the persisted global hotkey fields to `settings$` and a typed hotkey format.
- [ ] Build the hotkey capture control (UI + capture logic + display formatting).
- [ ] Wire the settings row to enable/disable and update the stored hotkey.
- [ ] Implement the macOS native global hotkey module + JS bridge + activation event.
- [ ] Register/unregister the hotkey on settings changes and show the main window on activation.
- [ ] Manual validation on macOS (capture, persistence, registration failures, activation).

Validation:
- Manual: toggle enable, record a shortcut, relaunch, verify it persists and the hotkey shows the window.
- Optional: `bun run lint`.

## Open Questions
- Default hotkey: Command+Shift+L.
- Activation: focus main window, opening if closed.
