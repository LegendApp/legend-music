## Plan
Evolve the macOS visualizer window into a shader-driven showcase with selectable presets so we can ship multiple high-performance visual effects (powered by Skia runtime shaders) without fragmenting the UI.

## Visualizer UI
- Replace the existing visualizer controls with a single dropdown that lists available presets (current shader, Cubescape, Sunset) and persists the last selection.
- Update `VisualizerWindow.tsx` to load the selected visualizer dynamically and ensure window-level chrome (title, toolbar) reflects the active preset.
- Provide graceful fallbacks for unsupported GPU contexts and surface helpful error states if shader compilation fails.

## Shader Infrastructure
- Introduce a reusable shader renderer abstraction that wraps Skia runtime effects (and avoids Metal-specific hooks) to manage uniforms, time progression, and frame updates.
- Port the current visualizer to the new shader pipeline, ensuring parity with existing visuals while improving performance via GPU execution.
- Centralize shared uniforms (audio-reactive data, resolution, theme colors) so each preset receives consistent inputs.

## Visualizer Implementations
- Implement a shader module that adapts the Cubescape effect from https://www.shadertoy.com/view/Msl3Rr, translating GLSL to Skia runtime effects and exposing tweakable parameters for future iterations.
- Implement a shader module for the Sunset effect from https://www.shadertoy.com/view/tsScRK, matching timing/gradient behavior while optimizing for real-time playback via Skia.
- Add attribution comments at the top of each visualizer source file that link back to the originating Shadertoy.
- Document each visualizer's uniforms and any environment constraints to keep future additions straightforward.

## Integration & Performance
- Ensure audio-reactive uniforms remain compatible with the Skia shader pipeline and decouple frame throttling from individual presets.
- Add runtime checks and profiling hooks to monitor frame times; fall back to lower resolution or reduced iterations when the window is backgrounded.
- Update window/menu integration so hotkeys and context menus can switch presets and expose the new dropdown state.

## Tests & Verification
- Add unit tests around the shader selection logic and persistence layer to confirm the correct preset loads at startup.
- Create integration tests (or stories) that render each shader with mock uniforms to prevent regressions.
- Manually validate on macOS hardware that dropdown changes, shader compilation, and performance tuning behave as expected.

## Steps
- [x] Replace visualizer UI with dropdown-driven preset selection.
- [x] Build shared shader renderer infrastructure and migrate the current visualizer.
- [x] Implement Cubescape and Sunset shader presets.
- [x] Expand tests and manual validation for multi-visualizer support.
