import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { AnimatePresence, Motion } from "@legendapp/motion";
import { observe } from "@legendapp/state";
import { use$, useObserveEffect } from "@legendapp/state/react";
import type { JSX } from "react";
import { Pressable } from "react-native";
import WindowControls from "@/native-modules/WindowControls";
import { settings$ } from "@/systems/Settings";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

type MotionViewProps = Parameters<typeof Motion.View>[0];
const MotionView = Motion.View as unknown as (props: MotionViewProps) => JSX.Element;

export function TitleBar() {
    perfCount("TitleBar.render");
    const showOnHover = use$(settings$.general.showTitleBarOnHover);
    const isHovered = use$(state$.titleBarHovered);

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
        <Pressable
            className="absolute top-0 left-0 right-0 h-[28px]"
            onPointerMove={onHover}
            onHoverIn={onHover}
            onHoverOut={onHoverLeave}
        >
            <AnimatePresence>
                {isHovered ? (
                    <MotionView
                        className="absolute inset-0 border-b border-border-popup"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "tween", duration: 100 }}
                    >
                        <VibrancyView
                            blendingMode="withinWindow"
                            state="active"
                            material="popover"
                            style={{ flex: 1 }}
                        />
                    </MotionView>
                ) : null}
            </AnimatePresence>
        </Pressable>
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
