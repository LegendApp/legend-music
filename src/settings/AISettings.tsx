import { useMemo } from "react";
import { Text } from "react-native";

import { Checkbox } from "@/components/Checkbox";
import { Select } from "@/components/Select";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";
import { settings$ } from "@/systems/Settings";
import {
    ensureSuggestionProvidersRegistered,
    isSelectedSuggestionProviderAvailable$,
    selectedSuggestionProvider$,
    suggestionProviderAvailability$,
    suggestionProviders$,
} from "@/systems/suggestions";
import { useValue } from "@legendapp/state/react";

ensureSuggestionProvidersRegistered();

export function AISettings() {
    const providers = useValue(suggestionProviders$);
    const selectedProvider = useValue(selectedSuggestionProvider$);
    const isAvailable = useValue(isSelectedSuggestionProviderAvailable$);
    const providerAvailability = useValue(suggestionProviderAvailability$);

    const providerOptions = useMemo(
        () =>
            providers.map((provider) => {
                const available = providerAvailability[provider.id];
                return {
                    value: provider.id,
                    label: available ? provider.name : `${provider.name} (Not Available)`,
                    disabled: !available,
                };
            }),
        [providers, providerAvailability],
    );

    const hasAvailableProviders = providers.some((provider) => providerAvailability[provider.id]);
    const availabilityLabel = !hasAvailableProviders
        ? "No suggestion providers available"
        : !selectedProvider
            ? "No suggestion provider selected"
            : isAvailable
                ? `${selectedProvider.name} is available`
                : selectedProvider.kind === "spotify"
                    ? "Connect Spotify to enable suggestions"
                    : `${selectedProvider.name} is not available`;

    return (
        <SettingsPage>
            <SettingsSection title="AI" first>
                <SettingsRow
                    title="Enable AI Features"
                    description="Toggle AI-powered queue extension and playlist creation"
                    control={<Checkbox $checked={settings$.ai.enabled} />}
                />
                <SettingsRow
                    title="Auto-Extend Queue"
                    description="When the last song plays, extend the queue with suggestions"
                    control={<Checkbox $checked={settings$.ai.autoExtendQueue} />}
                />
                <SettingsRow
                    title="Playlist Creation"
                    description="Allow AI-generated playlists in the media library"
                    control={<Checkbox $checked={settings$.ai.playlistCreation} />}
                />
                <SettingsRow
                    title="Suggestion Provider"
                    description="Choose which provider to use for suggestions"
                    control={<Select value$={settings$.ai.suggestionProviderId} options={providerOptions} />}
                    controlWrapperClassName="w-48"
                />
                <SettingsRow
                    title="Provider Status"
                    description="Current availability for the selected provider"
                    control={<Text className="text-sm text-text-primary">{availabilityLabel}</Text>}
                />
            </SettingsSection>
        </SettingsPage>
    );
}
