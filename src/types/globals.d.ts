// Shared utility types that are not provided by our TypeScript version
declare global {
    // Preserve inference in generic helpers when we need to stop widening
    // https://github.com/microsoft/TypeScript/issues/14829
    type NoInfer<T> = [T][T extends any ? 0 : never];
}

declare module "@legendapp/list" {
    import type * as React from "react";
    import type { LegendListProps, LegendListRef } from "@legendapp/list";

    // The published types currently type LegendList as returning ReactNode, which
    // prevents JSX usage. Override to return a valid element.
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const LegendList: <T>(props: LegendListProps<T> & React.RefAttributes<LegendListRef>) => React.ReactElement | null;
}

declare module "react-native-reanimated" {
    interface AnimateProps<_S> {
        onMouseEnter?: () => void;
        onMouseLeave?: () => void;
    }
}

export {};
