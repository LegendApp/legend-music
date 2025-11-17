import {
    LegendList as BaseLegendList,
    type LegendListProps,
    type LegendListRef,
    type LegendListRenderItemProps,
} from "@legendapp/list";
import { forwardRef, type ReactElement } from "react";

function LegendListInner<T>(props: LegendListProps<T>, ref: React.Ref<LegendListRef>) {
    return BaseLegendList({ ...props, ref } as any) as ReactElement;
}

// Provide a JSX-friendly wrapper because the upstream type returns ReactNode
export const LegendList = forwardRef(LegendListInner) as <T>(
    props: LegendListProps<T> & React.RefAttributes<LegendListRef>,
) => ReactElement | null;

export type { LegendListRenderItemProps };
