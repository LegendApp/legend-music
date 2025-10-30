## Plan
Eliminate the most expensive work in the macOS audio → shader pipeline so visualizer presets hold a stable 60 fps on typical tracks while leaving headroom for future shader complexity.

## Native Audio Pipeline
- Replace the per-frame `NSData` allocations in `AudioPlayer.m` (see `handleVisualizerBuffer`) with a reusable lock-free ring buffer that hands pointers + frame counts to the FFT worker queue, cutting allocator churn and GC pressure on the tap.
- Rework the overlap handling in `enqueueVisualizerSamples` to use a circular buffer (or double-buffered overlap-save) so we stop `memmove`-ing `hopSize` samples every frame; aim for zero-copy pointer arithmetic when preparing FFT windows.
- Gate FFT size/bin count negotiation to only run on config changes (off the tap thread) so the tap never rebuilds buffers mid-stream; add perf counters (log/metrics) for tap duration vs. budget to confirm throttle decisions.
- Vectorize mono mixing using Accelerate (e.g., `vDSP` combine/scale for interleaved or planar input) instead of nested scalar loops.
- Replace per-bin accumulation in the binning loop with faster primitives:
  - Use prefix sums for O(1) window averages, or
  - Convert to dB with `vDSP_vdbcon` then range-map/clamp with vector ops.
- Precompute per-bin emphasis and response gamma lookup tables when bin count changes; apply via vector multiply instead of `powf` per bin per frame.
- Align cadence with a dedicated GCD timer sampling the ring at ~16 ms (or adaptive, see Bridge) to reduce jitter vs. ad-hoc last-emit checks.

## React Native Bridge
- Convert the visualizer event payload in `AudioPlayer.m` (see `sendVisualizerEventWithRMS`) from an array of boxed floats to a compact structure (e.g., `NSData` with `float` payload or quantized `UInt8/UInt16` bins plus metadata) to reduce bridge serialization cost by an order of magnitude.
- Prefer a Phase 2 path using a JSI/TurboModule typed-array surface (shared buffer or pull-based API) to bypass JSON/NSArray entirely; keep the `NSData` format as the initial step/fallback.
- Align emit cadence with the desired refresh (target 16 ms) and drop the redundant JS-side smoothing so we only process each bin set once. Add adaptive backoff: 16 → 24 → 33 → 50 ms before halving bin count.
- Unify defaults: make native’s default throttle match JS (16 ms) and source of truth should be the JS config unless explicitly overridden.
- Document the wire format and cadence policies in `src/native-modules/AudioPlayer.ts`, including fallback handling for legacy array payloads if needed.

## ShaderSurface Runtime
- Replace `Array.from(base.bins)` with a persistent `Float32Array` that mutates in place so Skia receives stable references and we avoid per-frame allocations; keep the uniforms object stable and only mutate the typed array.
- Skip interpolation when incoming `binCount` equals `resolvedBinCount`; resample only when the bridge delivers fewer/more bins than the shader requests.
- Centralize smoothing in native (bins and amplitude) so React only copies data into uniforms; remove the JS attack/release filters.
- Drive `u_time` from Skia/Reanimated clock (UI thread), and update uniforms only on new audio frames (not every RAF) to cut JS churn.

## Validation & Tooling
- Add an Instruments profiling recipe (Time Profiler + Allocations + Core Animation) to the repo documenting how to validate tap latency and frame rate post-changes.
- Create a lightweight debug overlay (feature flag) that surfaces current FPS, tap duration, and last throttle decision inside the visualizer window for manual QA.
- Update `plans/1-drag-media.md` or relevant roadmap docs once the performance plan is approved, keeping stakaeholders aligned on sequencing.
- Add `os_signpost` points around tap -> mixdown -> FFT -> binning -> emit to correlate with Instruments’ Points of Interest and quickly spot regressions.
- Include target budgets in docs: ≤4 ms native analysis, ≤2 ms JS uniform updates, stable 60 fps render.

## Steps
- [x] Implement ring buffer + overlap-save windowing; vectorize mono mixing with Accelerate.
- [x] Optimize binning: prefix sums or vectorized dB mapping + precomputed emphasis/gamma.
- [x] Unify cadence defaults at 16 ms and add adaptive backoff before reducing bins.
- [ ] Redesign bridge payload (NSData floats or quantized) and document wire format.
- [ ] Add optional JSI typed-array path (Phase 2) to bypass JSON/NSArray.
- [ ] Streamline `ShaderSurface`: persistent typed array uniform, native-only smoothing, UI-thread time.
- [ ] Ship profiling docs + debug overlay + `os_signpost` POIs and budgets.
