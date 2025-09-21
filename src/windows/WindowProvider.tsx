import type { ComponentType, ReactNode } from "react";
import { createContext, useContext } from "react";

const WindowContext = createContext<string>("");

export const useWindowId = () => useContext(WindowContext);

type WindowProviderProps = {
    children: ReactNode;
    id: string;
};

export function WindowProvider({ children, id }: WindowProviderProps) {
    return <WindowContext.Provider value={id}>{children}</WindowContext.Provider>;
}

export const withWindowProvider = <P extends Record<string, unknown>>(
    WrappedComponent: ComponentType<P>,
    id: string,
) => {
    const WithWindowProvider = (props: P) => (
        <WindowProvider id={id}>
            <WrappedComponent {...props} />
        </WindowProvider>
    );

    WithWindowProvider.displayName = `WithWindowProvider(${WrappedComponent.displayName ?? WrappedComponent.name ?? "Component"})`;

    return WithWindowProvider;
};
