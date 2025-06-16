import { Motion } from "@legendapp/motion";
import type { Observable } from "@legendapp/state";
import { use$, useObservable, useObserveEffect } from "@legendapp/state/react";
import { View } from "react-native";

import { ResizeHandle } from "@/components/ResizeHandle";
import { settings$ } from "@/systems/Settings";
import { ShadowDropdown } from "@/utils/styles";
import { Button } from "./Button";

const SpringOpen = {
    type: "spring",
    bounciness: 3,
    speed: 20,
} as const;

// const SpringClose = {
//     type: 'spring',
//     bounciness: 2,
//     speed: 20,
// } as const;

interface DrawerProps {
    children: React.ReactNode;
    isOpen$: Observable<boolean>;
}

export function Drawer({ children, isOpen$ }: DrawerProps) {
    const width$ = settings$.state.issueDetailWidth;
    const width = use$(width$);
    const isOpen = use$(isOpen$);
    const isRendering$ = useObservable(isOpen);
    const isRendering = use$(isRendering$);

    const onClose = () => isOpen$.set(false);

    useObserveEffect(() => {
        const isOpenNow = isOpen$.get();
        if (isOpenNow !== isRendering$.get()) {
            if (isOpenNow) {
                isRendering$.set(true);
            } else {
                setTimeout(() => {
                    // Check the latest state to make sure it hasn't re-opened
                    if (!isOpen$.get()) {
                        isRendering$.set(false);
                    }
                }, 500);
            }
        }
    });

    return (
        <Motion.View
            className="absolute right-0 top-0 bottom-0 z-10 flex-row"
            // eslint-disable-next-line react-native/no-inline-styles
            style={{ width, marginLeft: width, pointerEvents: isOpen ? "auto" : "none" }}
            animate={{
                x: isOpen ? 0 : width,
            }}
            initial={{ x: isOpen ? 0 : width }}
            exit={{ x: width }}
            transition={SpringOpen}
        >
            {(isOpen || isRendering) && (
                <>
                    <View className="flex-1 ml-4">
                        <View className="flex-1 bg-background-primary" style={ShadowDropdown}>
                            <View className="pl-3 py-2 flex-row">
                                <Button
                                    onPress={onClose}
                                    icon="chevron.right.2"
                                    variant="icon-bg"
                                    size="small"
                                    iconSize={14}
                                />
                            </View>
                            {children}
                        </View>
                    </View>
                    <View className="absolute left-2 top-0 bottom-0">
                        <ResizeHandle width$={width$} min={300} max={800} side="left" line />
                    </View>
                </>
            )}
        </Motion.View>
    );
}
