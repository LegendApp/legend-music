import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { AnimatePresence, Motion } from "@legendapp/motion";
import { observe } from "@legendapp/state";
import { Show } from "@legendapp/state/react";
import { Pressable, StyleSheet } from "react-native";
import WindowControls from "@/native-modules/WindowControls";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function TitleBar() {
    perfCount("TitleBar.render");
    const onHover = () => {
        perfLog("TitleBar.onHover", { hovered: true });
        state$.titleBarHovered.set(true);
    };

    const onHoverLeave = () => {
        perfLog("TitleBar.onHoverLeave", { hovered: false });
        state$.titleBarHovered.set(false);
    };

    return (
        <Pressable
            className="absolute top-0 left-0 right-0 h-[28px] z-[1000]"
            onPointerMove={onHover}
            onHoverIn={onHover}
            onHoverOut={onHoverLeave}
        >
            <Show if={state$.titleBarHovered} wrap={AnimatePresence}>
                <Motion.View
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
                        style={styles.vibrancy}
                    />
                </Motion.View>
            </Show>
        </Pressable>
    );
}

observe(() => {
    perfCount("TitleBar.observe");
    const hide = !state$.titleBarHovered.get();
    perfLog("TitleBar.observe.state", { hide });

    setTimeout(() => {
        if (hide) {
            WindowControls.hideWindowControls();
        } else {
            WindowControls.showWindowControls();
        }
        perfLog("TitleBar.observe.timeout", { hide });
    }, 100);
});

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
