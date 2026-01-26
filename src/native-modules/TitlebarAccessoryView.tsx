import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import { requireNativeComponent, type ViewProps } from "react-native";

export interface TitlebarAccessoryViewProps extends ViewProps {
    children: ReactNode;
}

const NativeTitlebarAccessoryView =
    requireNativeComponent<TitlebarAccessoryViewProps>("RNTitlebarAccessoryView");

cssInterop(NativeTitlebarAccessoryView, {
    className: "style",
});

export function TitlebarAccessoryView({ children, ...props }: TitlebarAccessoryViewProps) {
    return <NativeTitlebarAccessoryView {...props}>{children}</NativeTitlebarAccessoryView>;
}
