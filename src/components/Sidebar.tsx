import type { Observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import TabView, { SceneMap } from "react-native-bottom-tabs";

export interface SidebarItem {
    id: string;
    name: string;
}

interface SidebarProps {
    items: SidebarItem[];
    scenes: Record<string, ComponentType>;
    selectedItem$: Observable<string>;
}

export function Sidebar({ items, scenes, selectedItem$ }: SidebarProps) {
    const selectedItem = useValue(selectedItem$);
    const routes = useMemo(
        () =>
            items.map((item) => ({
                key: item.id,
                title: item.name,
            })),
        [items],
    );

    const [index, setIndex] = useState(() =>
        Math.max(
            routes.findIndex((route) => route.key === selectedItem),
            0,
        ),
    );

    useEffect(() => {
        const matchedIndex = routes.findIndex((route) => route.key === selectedItem);
        if (matchedIndex === -1 && routes[0] && selectedItem !== routes[0].key) {
            selectedItem$.set(routes[0].key);
            setIndex(0);
            return;
        }

        if (matchedIndex !== -1 && matchedIndex !== index) {
            setIndex(matchedIndex);
        }
    }, [index, routes, selectedItem, selectedItem$]);

    const renderScene = useMemo(
        () =>
            SceneMap(
                items.reduce(
                    (acc, item) => {
                        const SceneComponent = scenes[item.id];
                        acc[item.id] = SceneComponent ? () => <SceneComponent /> : () => null;
                        return acc;
                    },
                    {} as Record<string, ComponentType>,
                ),
            ),
        [items, scenes],
    );

    const handleIndexChange = (nextIndex: number) => {
        setIndex(nextIndex);
        const nextRoute = routes[nextIndex];
        if (nextRoute) {
            selectedItem$.set(nextRoute.key);
        }
    };

    if (routes.length === 0) {
        return null;
    }

    return (
        <TabView
            style={{ flex: 1 }}
            navigationState={{ index, routes }}
            renderScene={renderScene}
            onIndexChange={handleIndexChange}
            labeled
            sidebarAdaptable
        />
    );
}
