import { computed, observable } from "@legendapp/state";
import { aiCommandRunner, type AIToolId } from "@/native-modules/AICommandRunner";

export type AiAvailabilityState = {
    isChecking: boolean;
    claude: boolean;
    codex: boolean;
    preferredTool: AIToolId | null;
    lastCheckedAt: number | null;
};

export const aiAvailability$ = observable<AiAvailabilityState>({
    isChecking: false,
    claude: false,
    codex: false,
    preferredTool: null,
    lastCheckedAt: null,
});

export const isAiAvailable$ = computed(() => aiAvailability$.claude.get() || aiAvailability$.codex.get());

let availabilityInitialized = false;

export async function refreshAiAvailability(): Promise<void> {
    aiAvailability$.isChecking.set(true);
    try {
        const availability = await aiCommandRunner.getAvailability();
        aiAvailability$.claude.set(Boolean(availability.claude));
        aiAvailability$.codex.set(Boolean(availability.codex));
        aiAvailability$.preferredTool.set(availability.preferredTool ?? null);
        aiAvailability$.lastCheckedAt.set(Date.now());
    } catch (error) {
        console.warn("Failed to check AI CLI availability", error);
        aiAvailability$.claude.set(false);
        aiAvailability$.codex.set(false);
        aiAvailability$.preferredTool.set(null);
        aiAvailability$.lastCheckedAt.set(Date.now());
    } finally {
        aiAvailability$.isChecking.set(false);
    }
}

export function initializeAiAvailability(): void {
    if (availabilityInitialized) {
        return;
    }

    availabilityInitialized = true;
    void refreshAiAvailability();
}
