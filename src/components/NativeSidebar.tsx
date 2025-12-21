import { useObservable, useObserveEffect } from "@legendapp/state/react";
import { useEffect, useMemo } from "react";
import { Platform, type StyleProp, View, type ViewStyle } from "react-native";
import { Sidebar } from "@/components/Sidebar";
import { NativeSidebarView, type NativeSidebarItem } from "@/native-modules/NativeSidebar";

export interface NativeSidebarProps {
    items: NativeSidebarItem[];
    selectedId?: string;
    onSelectionChange?: (id: string) => void;
    width?: number;
    className?: string;
    style?: StyleProp<ViewStyle>;
}

export function NativeSidebar({
    items,
    selectedId,
    onSelectionChange,
    width,
    className,
    style,
}: NativeSidebarProps) {
    const isMacOS = Platform.OS === "macos";

    const fallbackItems = useMemo(() => {
        return items.map((item) => ({ id: item.id, name: item.label }));
    }, [items]);

    const selectedItem$ = useObservable<string>(selectedId ?? items[0]?.id ?? "");

    useEffect(() => {
        if (!isMacOS && selectedId !== undefined && selectedItem$.get() !== selectedId) {
            selectedItem$.set(selectedId);
        }
    }, [isMacOS, selectedId, selectedItem$]);

    useObserveEffect(selectedItem$, ({ value }) => {
        if (!isMacOS && value !== selectedId) {
            onSelectionChange?.(value ?? "");
        }
    });

    if (isMacOS) {
        return (
            <NativeSidebarView
                items={items}
                selectedId={selectedId}
                onSidebarSelectionChange={(event) => onSelectionChange?.(event.nativeEvent.id)}
                style={[style, width !== undefined ? { width } : null]}
                className={className}
            />
        );
    }

    return (
        <View style={[{ flex: 1 }, style]}>
            <Sidebar items={fallbackItems} selectedItem$={selectedItem$} width={width} className={className} />
        </View>
    );
}
