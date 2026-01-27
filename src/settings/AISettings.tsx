import { useMemo } from "react";
import { Text } from "react-native";

import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Select } from "@/components/Select";
import { showToast } from "@/components/Toast";
import { LOCAL_LIBRARY_PROVIDER_ID } from "@/providers/localLibrary/constants";
import { getStreamingProvider } from "@/providers/streamingProviderRegistry";
import { enabledSearchProviderIds$, searchProviders$ } from "@/providers/search/registry";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";
import { settings$ } from "@/systems/Settings";
import { clearAiSearchCache } from "@/systems/ai/searchCache";
import {
    ensureSuggestionProvidersRegistered,
    suggestionProviderAvailability$,
    suggestionProviders$,
} from "@/systems/suggestions";
import { AI_PROMPT_SOURCE_OPTIONS } from "@/systems/ai/promptSource";
import { useValue } from "@legendapp/state/react";

ensureSuggestionProvidersRegistered();

export function AISettings() {
    const providers = useValue(suggestionProviders$);
    const searchProviders = useValue(searchProviders$);
    const enabledSearchProviderIds = useValue(enabledSearchProviderIds$);
    const providerAvailability = useValue(suggestionProviderAvailability$);
    const selectedPreferredProviderId = useValue(settings$.ai.preferredTrackProviderId);

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

    const preferredServiceOptions = useMemo(() => {
        const enabledProviderIds = new Set(enabledSearchProviderIds);
        const options = [{ value: "auto", label: "Auto" }];
        const selectedProviderId = selectedPreferredProviderId ?? "auto";

        const toOption = (providerId: string) => {
            const providerName =
                providerId === LOCAL_LIBRARY_PROVIDER_ID
                    ? "Local Library"
                    : getStreamingProvider(providerId)?.name ?? providerId;
            const isLocalLibrary = providerId === LOCAL_LIBRARY_PROVIDER_ID;
            const isAvailable = isLocalLibrary || enabledProviderIds.has(providerId);
            return {
                value: providerId,
                label: isAvailable ? providerName : `${providerName} (Not Available)`,
            };
        };

        for (const provider of searchProviders) {
            if (
                !enabledProviderIds.has(provider.id) &&
                provider.id !== LOCAL_LIBRARY_PROVIDER_ID &&
                provider.id !== selectedProviderId
            ) {
                continue;
            }
            options.push(toOption(provider.id));
        }

        if (selectedProviderId !== "auto" && !options.some((option) => option.value === selectedProviderId)) {
            options.push(toOption(selectedProviderId));
        }

        if (!options.some((option) => option.value === LOCAL_LIBRARY_PROVIDER_ID)) {
            options.push(toOption(LOCAL_LIBRARY_PROVIDER_ID));
        }

        return options;
    }, [enabledSearchProviderIds, searchProviders, selectedPreferredProviderId]);

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
                    title="Suggestion Provider"
                    description="Choose which provider to use for suggestions"
                    control={<Select value$={settings$.ai.suggestionProviderId} options={providerOptions} />}
                    controlWrapperClassName="w-48"
                />
                <SettingsRow
                    title="AI Prompt Source"
                    description="Use streaming services for AI prompts or limit suggestions to your Local Library"
                    control={<Select value$={settings$.ai.promptSource} options={AI_PROMPT_SOURCE_OPTIONS} />}
                    controlWrapperClassName="w-48"
                />
                <SettingsRow
                    title="Preferred Service"
                    description="Prefer this service when resolving AI-suggested tracks"
                    control={
                        <Select value$={settings$.ai.preferredTrackProviderId} options={preferredServiceOptions} />
                    }
                    controlWrapperClassName="w-48"
                />
                <SettingsRow
                    title="Clear AI Search Cache"
                    description="Remove cached AI playlist search results stored on this device"
                    control={
                        <Button
                            variant="secondary"
                            size="medium"
                            onClick={() => {
                                clearAiSearchCache();
                                showToast("AI search cache cleared", "info");
                            }}
                        >
                            <Text className="text-text-primary text-sm font-medium">Clear Cache</Text>
                        </Button>
                    }
                />
            </SettingsSection>
        </SettingsPage>
    );
}
