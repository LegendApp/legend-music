## Plan
Reduce runtime CPU and heap churn from playback progress reporting by lowering event frequency, shrinking payloads, and offloading interpolation to JS while keeping UI state accurate.

## Progress Event Slimming
- Move native progress emissions to a 5s interval with a minimal payload (currentTime only; duration only when it changes) and keep the delta guard to avoid redundant sends.
- Add a lightweight native toggle for occlusion-aware throttling (normal cadence when visible, slower when occluded) while still firing immediate updates on visibility changes and track changes.
- Keep Now Playing updates intact but ensure progress events are not sent while paused.

## JS-side Interpolation
- Have JS extrapolate playback time between native ticks using lastNativeTime + timestamp while `isPlaying`, snapping back on each native tick.
- Trim the JS handler to only update state (no perf logs/console) and avoid writes when values are unchanged.
- Make the progress listener optional so it can be disabled without affecting playback controls.

## Steps
- [x] Lower native progress emission frequency and payload size, keeping duration-only updates when it changes.
- [x] Add occlusion-aware throttling for progress events with immediate refresh on visibility/track changes.
- [ ] Implement JS-side interpolation and a minimal progress handler to reduce allocations.
- [ ] Validate playback UI correctness (seek bar, elapsed time, now playing) with throttled updates enabled and disabled.
