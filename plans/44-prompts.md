## Plan
Make AI prompts customizable via settings, backed by a JSON manager with placeholder validation and UX guidance for
missing required placeholders.

## Research Notes
- `src/systems/ai/prompts.ts` defines the current AI prompt strings that need to become user-editable.
- `src/systems/Settings.ts` shows how `createJSONManager` is used to persist settings to disk.
- `src/settings/AISettings.tsx` is the likely home for adding prompt editors alongside the existing AI settings.

## Steps
- [ ] Add a `prompts$` observable in `src/systems/ai/prompts.ts` using `createJSONManager` with `prompts.json` storage,
      plus defaults from the current prompt definitions.
- [ ] Update AI settings UI to render a large text input for each prompt with required placeholder hints and per-prompt
      validation state.
- [ ] Implement save behavior that appends missing required placeholders (e.g., `{prompt}`, `{library}`) to the end of
      the prompt, shows a left-aligned error message, and keeps a right-aligned save button.
- [ ] Wire prompt usage to read from `prompts$`, ensuring any required placeholder enforcement is centralized and
      applied consistently.

## Validation
Confirm all prompts appear in AI settings with editable text areas; saving without required placeholders appends them
and shows the inline error message; prompt usage throughout the app reads from `prompts$` and persists to
`prompts.json`.
