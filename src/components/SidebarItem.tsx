import type { ReactNode } from "react";
import { Platform, View, type ViewProps } from "react-native";
import { NativeSidebarItemView } from "@/native-modules/NativeSidebar";
import { cn } from "@/utils/cn";

export interface SidebarItemProps extends ViewProps {
    /** Unique identifier for this item, used for selection */
    itemId: string;
    /** Whether this item can be selected (default: true) */
    selectable?: boolean;
    /** Content to render inside the sidebar item */
    children: ReactNode;
}

/**
 * A sidebar item that renders custom RN content inside a native macOS sidebar.
 * Use as a child of NativeSidebar.
 *
 * @example
 * <NativeSidebar selectedId={selected} onSelectionChange={setSelected}>
 *   <SidebarItem itemId="songs">
 *     <Text>Songs</Text>
 *   </SidebarItem>
 *   <SidebarItem itemId="header" selectable={false}>
 *     <View className="flex-row items-center justify-between">
 *       <Text className="font-semibold">Playlists</Text>
 *       <Button icon="plus" onPress={addPlaylist} />
 *     </View>
 *   </SidebarItem>
 * </NativeSidebar>
 */
export function SidebarItem({ itemId, selectable = true, children, className, style, ...props }: SidebarItemProps) {
    const isMacOS = Platform.OS === "macos";

    if (isMacOS) {
        return (
            <NativeSidebarItemView
                itemId={itemId}
                selectable={selectable}
                // className={cn("px-3 py-2", className)}
                style={style}
                {...props}
            >
                {children}
            </NativeSidebarItemView>
        );
    }

    // Fallback for non-macOS platforms
    return (
        <View className={cn("px-3 py-1", className)} style={style} {...props}>
            {children}
        </View>
    );
}
