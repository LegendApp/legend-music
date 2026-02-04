import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import type { NativeMouseEvent } from "react-native-macos";
import { Button } from "@/components/Button";
import { openAiGenerationPopup } from "@/systems/ai/generationPopup";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { settings$ } from "@/systems/Settings";
import { suggestionProviderAvailability$ } from "@/systems/suggestions";
import { useWindowId } from "@/windows/WindowProvider";

type QueueAiDropdownProps = {
    title: string;
    disabled?: boolean;
};

export function QueueAiDropdown({ title, disabled = false }: QueueAiDropdownProps) {
    const providerAvailability = useValue(suggestionProviderAvailability$);
    const anyProviderAvailable = Boolean(
        providerAvailability.claude || providerAvailability.codex || providerAvailability.spotify,
    );
    const aiSettings = useValue(settings$.ai);
    const isFeatureEnabled = aiSettings.enabled;
    const isDisabled = disabled || !anyProviderAvailable || !isFeatureEnabled;
    const windowId = useWindowId();

    const open = useCallback(
        (event?: NativeMouseEvent) => {
            if (isDisabled) {
                return;
            }

            const screenX = event?.pageX ?? event?.x ?? null;
            const screenY = event?.pageY ?? event?.y ?? null;
            openAiGenerationPopup({
                title,
                action: "generate-queue",
                windowId,
                anchorRect: screenX !== null && screenY !== null ? { screenX, screenY, width: 1, height: 1 } : null,
            });
        },
        [isDisabled, title, windowId],
    );

    const hotkeyHandlers = useMemo(
        () => ({
            AiQueue: () => open(undefined),
        }),
        [open],
    );
    useOnHotkeys(hotkeyHandlers);

    return (
        <Button
            icon="sparkles"
            variant="icon-hover"
            size="xs"
            iconSize={16}
            accessibilityLabel={title}
            tooltip="AI queue (a)"
            disabled={isDisabled}
            className="opacity-60 hover:opacity-100"
            onMouseDown={open}
        />
    );
}
