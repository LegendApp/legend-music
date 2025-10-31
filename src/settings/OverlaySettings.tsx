import { observer, use$ } from "@legendapp/state/react";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Checkbox } from "@/components/Checkbox";
import { Select } from "@/components/Select";
import {
    OVERLAY_MAX_DISPLAY_DURATION_SECONDS,
    OVERLAY_MIN_DISPLAY_DURATION_SECONDS,
    settings$,
} from "@/systems/Settings";

const verticalOptions = [
    { value: "top", label: "Top" },
    { value: "middle", label: "Middle" },
    { value: "bottom", label: "Bottom" },
];

const horizontalOptions = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
];

export const OverlaySettings = observer(function OverlaySettings() {
    const durationSeconds = use$(settings$.overlay.displayDurationSeconds);
    const overlayEnabled = use$(settings$.overlay.enabled);
    const [durationDraft, setDurationDraft] = useState(String(durationSeconds));

    useEffect(() => {
        setDurationDraft(String(durationSeconds));
    }, [durationSeconds]);

    const handleDurationChange = (text: string) => {
        const sanitized = text.replace(/[^0-9]/g, "");
        setDurationDraft(sanitized);

        const parsed = Number.parseInt(sanitized, 10);
        if (!Number.isNaN(parsed)) {
            const clamped = Math.max(
                OVERLAY_MIN_DISPLAY_DURATION_SECONDS,
                Math.min(parsed, OVERLAY_MAX_DISPLAY_DURATION_SECONDS),
            );
            settings$.overlay.displayDurationSeconds.set(clamped);
        }
    };

    const handleDurationBlur = () => {
        const parsed = Number.parseInt(durationDraft, 10);
        const clamped = Number.isNaN(parsed)
            ? durationSeconds
            : Math.max(
                  OVERLAY_MIN_DISPLAY_DURATION_SECONDS,
                  Math.min(parsed, OVERLAY_MAX_DISPLAY_DURATION_SECONDS),
              );
        settings$.overlay.displayDurationSeconds.set(clamped);
        setDurationDraft(String(clamped));
    };

    return (
        <View className="flex-1 bg-background-primary">
            <View className="p-6">
                <Text className="text-2xl font-bold text-text-primary mb-6">Overlay Settings</Text>

                <View className="bg-background-secondary rounded-lg border border-border-primary p-4 gap-4">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-6">
                            <Text className="text-text-primary text-base font-medium">Enable overlay</Text>
                            <Text className="text-text-tertiary text-sm mt-1">
                                Show the current song overlay when a new track begins.
                            </Text>
                        </View>
                        <Checkbox $checked={settings$.overlay.enabled} />
                    </View>

                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-6">
                            <Text className="text-text-primary text-base font-medium">Display duration</Text>
                            <Text className="text-text-tertiary text-sm mt-1">
                                Number of seconds the overlay remains visible (between {OVERLAY_MIN_DISPLAY_DURATION_SECONDS} and {OVERLAY_MAX_DISPLAY_DURATION_SECONDS}).
                            </Text>
                        </View>
                        <TextInput
                            value={durationDraft}
                            onChangeText={handleDurationChange}
                            onBlur={handleDurationBlur}
                            keyboardType="numeric"
                            className="bg-background-tertiary text-text-primary border border-border-primary rounded-md px-3 py-1.5 w-20 text-center"
                            accessibilityLabel="Overlay display duration"
                        />
                    </View>

                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-6">
                            <Text className="text-text-primary text-base font-medium">Position</Text>
                            <Text className="text-text-tertiary text-sm mt-1">
                                Choose where the overlay appears on screen.
                            </Text>
                        </View>
                        <View className="flex-row gap-3">
                            <View className="w-32">
                                <Select
                                    options={verticalOptions}
                                    value$={settings$.overlay.position.vertical}
                                    disabled={!overlayEnabled}
                                    triggerClassName="px-2"
                                />
                            </View>
                            <View className="w-32">
                                <Select
                                    options={horizontalOptions}
                                    value$={settings$.overlay.position.horizontal}
                                    disabled={!overlayEnabled}
                                    triggerClassName="px-2"
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});
