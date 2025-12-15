import { observe } from "@legendapp/state";
import { useObserveEffect, useValue } from "@legendapp/state/react";
import { Pressable, View } from "react-native";
import WindowControls from "@/native-modules/WindowControls";
import { settings$ } from "@/systems/Settings";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function TitleBar() {
    perfCount("TitleBar.render");
    const showOnHover = useValue(settings$.general.showTitleBarOnHover);

    useObserveEffect(() => {
        const showOnHover = settings$.general.showTitleBarOnHover.get();
        const isHovered = state$.titleBarHovered.get();
        if (!showOnHover && isHovered) {
            state$.titleBarHovered.set(false);
        }
    });

    const onHover = () => {
        if (!settings$.general.showTitleBarOnHover.get()) {
            return;
        }
        perfLog("TitleBar.onHover", { hovered: true });
        state$.titleBarHovered.set(true);
    };

    const onHoverLeave = () => {
        if (!settings$.general.showTitleBarOnHover.get()) {
            return;
        }
        perfLog("TitleBar.onHoverLeave", { hovered: false });
        state$.titleBarHovered.set(false);
    };

    if (!showOnHover) {
        return null;
    }

    return (
        <View className="absolute top-0 left-0 right-0 h-[28px]" pointerEvents="box-none">
            <Pressable
                className="h-full w-[220px]"
                onPointerMove={onHover}
                onHoverIn={onHover}
                onHoverOut={onHoverLeave}
            >
                <View pointerEvents="none" className="h-full w-full" />
            </Pressable>
        </View>
    );
}

let areControlsVisible: boolean | undefined;
observe(() => {
    perfCount("TitleBar.observe");
    const showOnHover = settings$.general.showTitleBarOnHover.get();
    const shouldShowControls = showOnHover && state$.titleBarHovered.get();
    const shouldHideControls = !shouldShowControls;
    perfLog("TitleBar.observe.state", { hide: shouldHideControls, showOnHover });

    if (areControlsVisible === undefined || areControlsVisible !== shouldShowControls) {
        areControlsVisible = shouldShowControls;
        setTimeout(() => {
            if (shouldHideControls) {
                WindowControls.hideWindowControls();
            } else {
                WindowControls.showWindowControls();
            }
            perfLog("TitleBar.observe.timeout", { hide: shouldHideControls, showOnHover });
        }, 100);
    }
});
