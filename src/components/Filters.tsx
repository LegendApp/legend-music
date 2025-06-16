import type { Observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { Fragment } from "react";
import { Text, View } from "react-native";

import { Checkbox } from "@/components/Checkbox";
import { SFSymbol } from "@/native-modules/SFSymbol";
import { labels$ } from "@/sync/StateGithub";
import type { RepoName } from "@/sync/syncedGithub";
import { getSelectedTab$, useSelectedTab } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { Button } from "./Button";
import { DropdownMenu } from "./DropdownMenu";

export type State = "Open" | "Closed";
export type Status = "Triage" | "Backlog" | "Todo" | "In Progress" | "In Review" | "Done" | "Released" | "Cancelled";
export type Label = "done?" | "1.0";
export type Assigned = "Me" | "Other";

export interface FilterState {
    repos: Partial<Record<RepoName, boolean>>;
    state: Partial<Record<State, boolean>>;
    status: Partial<Record<Status, boolean>>;
    label: Partial<Record<string, boolean>>;
    assigned: Partial<Record<Assigned, boolean>>;
}

const States: State[] = ["Open", "Closed"];
const Statuses: Status[] = ["Triage", "Backlog", "Todo", "In Progress", "In Review", "Done", "Released", "Cancelled"];
// TODO: Sync with GitHub labels and assignees
const Labels: Label[] = ["done?", "1.0"];
const Assigned: Assigned[] = ["Me", "Other"];

type FilterCategory = keyof FilterState;
type FilterValue = State | Status | Label | Assigned;

interface FilterDropdownContentProps {
    filters$: Observable<FilterState>;
    allLabels: { name: string }[];
    toggleFilter: <K extends keyof FilterState>(category: K, value: string) => void;
}

const FilterDropdownContent = ({ filters$, allLabels, toggleFilter }: FilterDropdownContentProps) => {
    const renderFilterSection = (category: keyof FilterState, title: string, items: (string | { name: string })[]) => {
        return (
            <DropdownMenu.Sub key={category}>
                <DropdownMenu.SubTrigger>
                    <Text className="text-text-primary">{title}</Text>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                    {items.map((item) => {
                        const itemKey = typeof item === "string" ? item : item.name;
                        // @ts-ignore - This is type-safe but TypeScript has trouble inferring it
                        const isActive$ = filters$[category][itemKey] as Observable<boolean>;

                        return (
                            <DropdownMenu.Item key={itemKey} onSelect={() => toggleFilter(category, itemKey)}>
                                <Checkbox $checked={isActive$} label={String(itemKey)} />
                            </DropdownMenu.Item>
                        );
                    })}
                </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
        );
    };

    return (
        <DropdownMenu.Content maxHeightClassName="max-h-96">
            {renderFilterSection("state", "State", States)}
            {renderFilterSection("status", "Status", Statuses)}
            {renderFilterSection("label", "Labels", allLabels)}
            {renderFilterSection("assigned", "Assigned to", Assigned)}
        </DropdownMenu.Content>
    );
};

interface FilterTagProps {
    category: FilterCategory;
    value: FilterValue;
    onRemove: (category: FilterCategory, value: FilterValue) => void;
    filters$: Observable<FilterState>;
    allLabels: { name: string }[];
    toggleFilter: <K extends keyof FilterState>(category: K, value: string) => void;
}

export const FilterTag = ({ category, value, onRemove, filters$, allLabels, toggleFilter }: FilterTagProps) => {
    return (
        <DropdownMenu.Root closeOnSelect={false}>
            <DropdownMenu.Trigger className="bg-background-secondary h-7 rounded-lg flex-row items-center gap-x-1 overflow-hidden border border-border-primary">
                <Text className="text-xs text-text-secondary pl-2">{String(value)}</Text>
                <Button
                    className="px-2 hover:bg-white/10 rounded-r-md h-full justify-center"
                    onPress={(e) => {
                        e.stopPropagation();
                        onRemove(category, value);
                    }}
                >
                    <Text className="text-text-secondary text-xs group-hover:text-white">x</Text>
                </Button>
            </DropdownMenu.Trigger>
            <FilterDropdownContent filters$={filters$} allLabels={allLabels} toggleFilter={toggleFilter} />
        </DropdownMenu.Root>
    );
};

export interface FilterProps {
    filters$: Observable<FilterState>;
}

export const Filters = () => {
    const filters$ = getSelectedTab$().filters;
    const filters = use$(filters$);
    const tab = useSelectedTab();
    const allLabels = use$(() =>
        Object.keys(tab.filters.repos).flatMap((repoName) => labels$[repoName as RepoName].labelsArr.get()),
    );

    const toggleFilter = <K extends keyof FilterState>(category: K, value: string) => {
        // @ts-ignore - This is type-safe but TypeScript has trouble inferring it
        filters$[category][value].set((v: boolean) => !v);
    };

    const getActiveFilters = () => {
        const activeFilters: Array<{ category: keyof FilterState; value: State | Status | Label | Assigned }> = [];

        for (const category of ["state", "status", "label", "assigned"] as const) {
            const items =
                category === "state"
                    ? States
                    : category === "status"
                      ? Statuses
                      : category === "label"
                        ? Labels
                        : Assigned;

            for (const item of items) {
                // @ts-ignore - This is type-safe but TypeScript has trouble inferring it
                if (filters?.[category]?.[item]) {
                    activeFilters.push({ category, value: item as any });
                }
            }
        }

        return activeFilters;
    };

    const activeFilters = getActiveFilters();
    const hasActiveFilters = activeFilters.length > 0;

    return (
        <Fragment>
            <DropdownMenu.Root closeOnSelect={false}>
                <DropdownMenu.Trigger
                    className={cn(
                        "rounded-md flex-row items-center gap-x-1 gap-y-2",
                        !hasActiveFilters && "hover:bg-background-tertiary px-2 h-9",
                        hasActiveFilters && "flex-wrap",
                    )}
                >
                    <View
                        className={cn(
                            hasActiveFilters &&
                                "hover:bg-background-tertiary px-2 h-9 rounded-md items-center justify-center",
                        )}
                        pointerEvents="none"
                    >
                        <SFSymbol name={"line.3.horizontal.decrease"} size={16} />
                    </View>
                    {!hasActiveFilters && <Text className={cn("text-text-secondary text-xs")}>Filter</Text>}
                </DropdownMenu.Trigger>
                <FilterDropdownContent filters$={filters$} allLabels={allLabels} toggleFilter={toggleFilter} />
            </DropdownMenu.Root>
            {hasActiveFilters &&
                activeFilters.map(({ category, value }) => (
                    <FilterTag
                        key={`filter-tag-${category}-${String(value)}`}
                        category={category}
                        value={value}
                        onRemove={toggleFilter as any}
                        filters$={filters$}
                        allLabels={allLabels}
                        toggleFilter={toggleFilter}
                    />
                ))}
        </Fragment>
    );
};
