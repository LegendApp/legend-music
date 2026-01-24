import { parseSuggestedTracks } from "@/systems/ai/parser";
import { createAiSuggestionProvider } from "@/systems/suggestions/ai/aiProvider";
import { buildAiInvocation } from "@/systems/suggestions/ai/invocation";

export const claudeSuggestionProvider = createAiSuggestionProvider({
    id: "claude",
    name: "Claude Code",
    buildInvocation: (prompt) => buildAiInvocation("claude", prompt),
    parseResponse: (raw, count) => parseSuggestedTracks(raw, count),
});
