import { cssInterop } from "nativewind";
import { requireNativeComponent, type ViewProps } from "react-native";

export interface NativeSidebarItem {
    id: string;
    label: string;
}

export interface NativeSidebarViewProps extends ViewProps {
    items: NativeSidebarItem[];
    selectedId?: string;
    onSidebarSelectionChange?: (event: { nativeEvent: { id: string } }) => void;
}

const NativeSidebarView = requireNativeComponent<NativeSidebarViewProps>("LMSidebar");

cssInterop(NativeSidebarView, {
    className: "style",
});

export { NativeSidebarView };
