import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import type { Observable } from "@legendapp/state";
import { type Animated, ScrollView, StyleSheet, View } from "react-native";

import { SidebarButton } from "@/components/SidebarButton";
import { cn } from "@/utils/cn";

export interface SidebarHeadingT {
    type: "heading";
    id: string;
    heading: string;
}

export interface SidebarItemT {
    type: "item";
    id: string;
    text: string;
}

interface SidebarCommonProps {
    items: { id: string; name: string }[];
    selectedItem$: Observable<string>;
    width?: number | Animated.Value;
    className?: string;
    children?: React.ReactNode;
}

export function Sidebar({ items, selectedItem$, width, className, children }: SidebarCommonProps) {
    const renderItems = () => {
        return items.map((item) => {
            return <SidebarButton key={item.id} text={item.name} value={item.id} selectedItem$={selectedItem$} />;
        });
    };

    const sidebarStyle = width !== undefined ? { width } : { flex: 1 };

    return (
        <View className="h-full" style={sidebarStyle}>
            <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
                <View className={cn("flex-1", className)}>
                    <ScrollView showsVerticalScrollIndicator={false}>{children ?? renderItems()}</ScrollView>
                </View>
            </VibrancyView>
        </View>
    );
}

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
