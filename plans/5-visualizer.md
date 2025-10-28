## Plan
Deliver a live music visualizer by streaming real-time spectrum data from the macOS audio engine, rendering it with `@shopify/react-native-skia`, and exposing the experience in a dedicated secondary window summoned via the `v` hotkey.

## Audio Analysis Tap
- Extend the native `AudioPlayer` to attach an `AVAudioEngine`/`AVAudioMixing` tap that emits FFT-ready PCM windows without interrupting playback.
- Publish throttled amplitude/FFT frames over a new React Native event (`onVisualizerFrame`) with configurable bin counts and smoothing.
- Guard native work behind feature flags and lifecycle hooks so the tap starts/stops with playback and avoids leaking observers.
- Validate CPU headroom by measuring frame emission cost under typical playback and fall back to lower resolution if necessary.

## Skia Visualizer Canvas
- Introduce a Skia-powered visualizer component that consumes streamed frame data and renders animated bars/waves using `Canvas`, `Line`, and `ImageShader` primitives.
- Implement color gradients and easing similar to the provided sample while keeping GC pressure low (reuse arrays, memoize drawing ops).
- Support multiple render modes (spectrum, waveform) toggled in-app to keep future experimentation simple.
- Add lightweight unit or story-style tests to ensure the component handles empty frames and resizing without crashes.

## Visualizer Window
- Create a new macOS window module (e.g., `VisualizerWindow`) registered through the existing multi-window infrastructure and route it via Expo/React Native navigation.
- Ensure the window listens to the shared observables so state stays in sync (current track metadata, play/pause).
- Provide default sizing, translucent background, and window-level tweaks so the visualizer feels distinct yet consistent with the app.
- Persist window bounds between sessions and auto-close when playback stops (optional toggle).

## Hotkey Integration
- Hook keyboard handling in the main window to capture the `v` key (respect modifiers and existing shortcuts).
- When invoked, spawn or focus the visualizer window; when already visible, allow toggling focus/visibility.
- Update help overlays and documentation so users discover the shortcut.
- Add integration coverage that simulates the keypress to confirm the window command path stays wired.

## Supplemental Ideas
- Experiment with device motion/reactive gradients for future cross-platform reuse while keeping the macOS path stable.
- Provide a minimal settings panel in the visualizer window to adjust FFT size, smoothing, and color themes.
- Investigate mirroring frames to WebSocket/devtools for remote visual debugging.
- Consider capturing frame timing metrics to guard against regressions as visuals grow more complex.

## Steps
- [x] Emit real-time visualizer frames from the native audio module.
- [x] Render the frames with a Skia visualizer component.
- [ ] Launch and control a dedicated visualizer window with a `v` hotkey.
