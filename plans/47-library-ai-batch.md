## Plan
Batch local library search AI scoring to handle large CSVs by chunking tracks, scoring per batch, and globally
ranking results before returning the top matches.

## Research Notes
- `src/providers/localLibrary/search.ts` currently sends the full CSV to the AI prompt and resolves exact matches.
- `buildLocalLibrarySearchPrompt` in `src/systems/ai/prompts` builds the AI request payload.
- `parseSuggestedTracks` in `src/systems/ai/parser` expects structured AI output for suggested tracks.
- `localMusicState$.tracks` provides the local library metadata for matching/returning results.
- `aiCommandRunner` executes CLI AI tools with a prompt-only interface.

## Steps
- [x] Add a batch-scoring prompt format and parser for `{id, score}` results, ensuring consistent scoring rubric
      across batches and JSON-only output.
- [x] Update local library search to chunk the CSV/library into batches (e.g., 300–500), invoke AI scoring per
      batch, merge scores, and return the top results by score.
- [ ] Preserve current error handling/timeouts, and add safeguards for malformed JSON or missing scores.
- [ ] Validate behavior with a manual run (large library) and note any performance tuning (batch size, top-K).

## Validation
Manual validation: search a query against a large local library (10k+ tracks) and confirm top results are ranked
by AI score, with stable ordering and no prompt-size failures.
