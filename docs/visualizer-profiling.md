# Visualizer Profiling Playbook

Use this checklist to validate visualizer performance changes on macOS.

## Recommended Instruments Template

1. Launch **Instruments** and create a multi-trace document with:
   - **Time Profiler** (sample interval 1 ms)
   - **Allocations**
   - **Core Animation FPS**
   - **Points of Interest** (shows native `os_signpost` markers)
2. Target the `LegendMusic` process and click record.
3. In the app, open the Visualizer window and start playback on a representative track.

## Reading the Signposts

The native `AudioPlayer` emits signposts under the `com.legendmusic.audio` subsystem. Each visualizer frame emits:

| Marker | Description |
| --- | --- |
| `TapBuffer` | Audio tap handed raw PCM to the mono mix path. |
| `EnqueueSamples` | Samples written into the ring buffer for FFT processing. |
| `VisualizerFrame` (interval) | End-to-end processing of a frame: windowing → FFT → binning → emit. |
| `Window`, `FFT`, `Binning`, `Emit` | Stage markers inside the frame interval. |

Use the interval duration to verify the native analysis budget (≤ **4 ms**). The debug overlay (below) surfaces the same tap duration in real time.

## Debug Overlay

Toggle the overlay from the Visualizer controls (`Debug Overlay` switch). It displays:

- Current FPS estimate (target **60 fps**)
- Frame interval
- Native tap duration (ms)
- Active throttle interval (ms)
- Bin count

The overlay reads from `visualizerDiagnostics$`, which is updated on each frame.

## Pass/Fail Gates

- **Native Analysis**: ≤ 4.0 ms averaged over steady playback. Investigate `VisualizerFrame` intervals > 4 ms (watch `Binning` vs `FFT` events).
- **JS Uniform Update**: ≤ 2.0 ms budget. Monitor the `ShaderSurface` handler in profiles if overlay FPS dips.
- **Frame Rate**: Core Animation track should stay at ~60 fps without prolonged throttling (>33 ms). Overlay throttle should remain at 16 ms except during backoff recovery.

## Exporting Evidence

1. When satisfied, stop the capture.
2. Save the `.trace` file under `dist/profiling/` (git-ignored) for archival.
3. Attach overlay screenshots and key metrics (avg tap duration, fps) to the PR validation notes.
