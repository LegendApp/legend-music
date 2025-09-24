# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds all TypeScript sources; key subdirectories include `components/` for shared UI, `systems/` and `observables/` for domain logic, `legend-kit/` for design system primitives, and `native-modules/` for macOS bridges. `src/App.tsx` remains the single entry point.
- `app/` and `app.json` drive Expo routing; `macos/` contains the Xcode project. Keep native edits isolated here and commit generated project changes intentionally.
- Tests live in `__tests__/` (see `__tests__/App.test.tsx`) or alongside features as `*.test.ts(x)`; store static media in `assets/` and Tailwind tokens in `global.css` + `tailwind.config.js`.
- Shared tooling lives in `scripts/`, `biome.json`, `metro.config.js`, and `patches/`. Update the relevant patch file when bumping a dependency it covers.

## Build, Test, and Development Commands
- `bun install` syncs dependencies (repository is Bun-first via `bun.lock`).
- `bun run start` starts Metro with client logging for local development.
- `bun run mac` launches the macOS binary through React Native.
- `bun run test` runs Jest with the React Native preset.
- `bun run lint` checks formatting and linting with Biome; `bun run lint:fix` applies safe autofixes.
- `bun run build` executes `scripts/build.ts`, which wraps `xcodebuild` to produce a Release `.app`. Ensure Xcode CLI tools and CocoaPods are installed before running.

## Coding Style & Naming Conventions
- Biome enforces 4-space indentation, double quotes, LF endings, and a 120-character max line (`biome.json`). Run lint before committing.
- Write modern TypeScript, prefer functional React components, and reuse hooks from `src/hooks/` where possible.
- Import via path aliases defined in `tsconfig.json` (`@/` for `src`, `@legend-kit/` for design kit utilities).
- Tailwind-style `className` usage should reference tokens from `global.css` and stay aligned with palettes in `src/theme/`.
- StyleSheet shoult not be used, use Tailwind-style `className` instead.

## Testing Guidelines
- Jest and `react-test-renderer` power unit tests; colocate new specs under `__tests__/` or near the code using the `.test.tsx` suffix.
- Prefer focused tests that assert observable/system behavior and mock native modules when the bridge is not available.
- Run `bun run test` before opening a PR and keep snapshots current.

## Commit & Pull Request Guidelines
- Follow the existing history: concise, imperative subjects without trailing punctuation (e.g., `Improve playback area`).
- Group related work per commit, mention issue IDs when relevant, and document native steps (`bundle exec pod install`) in the body.
- PRs should describe intent, list validation commands, and include screenshots or screen recordings for UI changes while calling out any macOS-specific setup.

## Task Completion Guidelines
- When asked to do multiple tasks in a plan file, when finished with each task:
    1. Mark the task complete in the plan file and save it
    2. Create a commit with a summarized description of the task, not including the [] prefix.