import { useMemo } from "react";

import { Checkbox } from "@/components/Checkbox";
import { Select } from "@/components/Select";
import { LOCAL_LIBRARY_PROVIDER_ID } from "@/providers/localLibrary/constants";
import { getStreamingProvider } from "@/providers/streamingProviderRegistry";
import { searchProviders$ } from "@/providers/search/registry";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";
import { settings$ } from "@/systems/Settings";
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

    const preferredServiceOptions = useMemo(() => {
        const options = [{ value: "auto", label: "Auto" }];
        for (const provider of searchProviders) {
            const providerName =
                provider.id === LOCAL_LIBRARY_PROVIDER_ID
                    ? "Local Library"
                    : getStreamingProvider(provider.id)?.name ?? provider.id;
            options.push({ value: provider.id, label: providerName });
        }
        return options;
    }, [searchProviders]);

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
            </SettingsSection>
        </SettingsPage>
    );
}
