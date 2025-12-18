import { localProvider } from "@/providers/localProvider";
import { registerProvider } from "@/providers/providerRegistry";
import { spotifyProvider } from "@/providers/spotify";

let initialized = false;

export function ensureProvidersRegistered(): void {
    if (initialized) {
        return;
    }
    registerProvider(localProvider);
    registerProvider(spotifyProvider);
    initialized = true;
}
