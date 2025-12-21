import { cssInterop } from "nativewind";
import { requireNativeComponent, type ViewProps } from "react-native";

export interface NativeSidebarItem {
    id: string;
    label: string;
}

export interface NativeSidebarViewProps extends ViewProps {
    items: NativeSidebarItem[];
    selectedId?: string;
    onSelectionChange?: (event: { nativeEvent: { id: string } }) => void;
}

const NativeSidebarView = requireNativeComponent<NativeSidebarViewProps>("RNSidebar");

cssInterop(NativeSidebarView, {
    className: "style",
});

export { NativeSidebarView };
