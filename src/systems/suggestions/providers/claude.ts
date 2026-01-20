import { parseSuggestedTracks } from "@/systems/ai/parser";
import { createAiSuggestionProvider } from "@/systems/suggestions/ai/aiProvider";

export const claudeSuggestionProvider = createAiSuggestionProvider({
    id: "claude",
    name: "Claude Code",
    command: "claude",
    buildInvocation: (prompt) => ({ args: ["-p", prompt] }),
    parseResponse: (raw, count) => parseSuggestedTracks(raw, count),
});
