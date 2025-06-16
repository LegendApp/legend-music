# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development**: `bun run mac` (runs the React Native macOS app)
- **Linting/Formatting**: `bun run lint` (check), `bun run lint:fix` (fix)
- **Testing**: `bun test`
- **Build**: `bun scripts/build.ts`
- **Install dependencies**: `bun install` (always use Bun, not npm/yarn)
- **Add packages**: `bun add <package>` or `bun add -d <package>` for dev dependencies
- **Pod install**: `cd macos && pod install` (only when native dependencies change)

## Architecture Overview

LegendMusic is a React Native macOS application for managing GitHub issues. The app is built around these core architectural patterns:

### State Management (Legend State)
- Uses `@legendapp/state` for reactive state management throughout the app
- Observable variables are suffixed with `$` (e.g., `settings$`, `issues$`)
- Access observable values in React components using `use$(observable)`
- Prefer `useObservable` over `useState` for local component state

### Key State Files
- `src/systems/Settings.ts` - App-wide settings and configuration
- `src/systems/State.ts` - UI state (dropdowns, selected items, navigation)
- `src/observables/appState.ts` - React Native app lifecycle state
- `src/sync/StateGithub.ts` - GitHub API data (issues, users, labels)

### Data Synchronization
- Custom GitHub API sync system in `src/sync/syncedGithub.ts`
- Automatically handles caching, persistence, and pagination
- Uses msgpack for efficient data storage via `ExpoFSPersistPlugin`
- Authentication managed through Keel backend (`src/keel/`)

### Component Structure
- Components in `src/components/` are primarily functional and use NativeWind/Tailwind
- Prefer named exports over default exports
- Settings screens in `src/settings/`
- Native macOS integrations in `src/native-modules/`

### Styling
- Uses NativeWind (Tailwind CSS for React Native)
- Prefer Tailwind classes over StyleSheet objects
- Uses FluentUI VibrancyView for native macOS glass effects

### File Organization
- `@/*` path alias maps to `src/*`
- `@legend-kit/*` path alias maps to `src/legend-kit/*` (internal utilities)
- Components are typically in their own files
- Utilities in `src/utils/` for shared helper functions

## Development Guidelines

- This is a macOS-only app - no need for iOS/Android/web fallbacks
- Use Motion components only when animating styles
- Follow Biome formatting rules (4 spaces, single quotes, 120 line width)
- Patched dependencies are managed in `patches/` directory
- Do not modify keelClient.ts