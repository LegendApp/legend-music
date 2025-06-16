import { use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Icon } from "@/systems/Icon";
import { getSelectedTab$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { Button } from "./Button";
import { DropdownMenu } from "./DropdownMenu";
import { Select } from "./Select";

export type ViewMode = "List" | "Board";
export type GroupingOption = "status" | "state" | "label" | "assigned" | "none";
export type OrderingOption = "created_at" | "updated_at" | "comments" | "title";
export type OrderDirectionOption = "asc" | "desc";

export interface DisplayOptionsState {
    grouping: GroupingOption;
    ordering: OrderingOption;
    orderDirection: OrderDirectionOption;
}

const GroupingOptions: GroupingOption[] = ["status", "state", "label", "assigned"];
const OrderingOptions: OrderingOption[] = ["created_at", "updated_at", "comments", "title"];
const OrderDirectionOptions: OrderDirectionOption[] = ["asc", "desc"];

interface DisplayOptionTagProps {
    option: keyof DisplayOptionsState;
    value: string;
    onRemove: () => void;
}

export const DisplayOptionTag = ({ option, value, onRemove }: DisplayOptionTagProps) => {
    const getDisplayName = (opt: string) => {
        switch (opt) {
            case "created_at":
                return "Created Date";
            case "updated_at":
                return "Updated Date";
            case "asc":
                return "Ascending";
            case "desc":
                return "Descending";
            default:
                return opt.charAt(0).toUpperCase() + opt.slice(1);
        }
    };

    return (
        <View className="bg-background-secondary border h-6 border-border-primary rounded-lg flex-row items-center gap-1 overflow-hidden">
            <Text className="text-xs text-text-secondary pl-2">
                {option}: {getDisplayName(value)}
            </Text>
            <Button className="px-2 hover:bg-white/10 rounded-r-md h-full justify-center" onPress={onRemove}>
                <Text className="text-text-secondary text-xs group-hover:text-white">x</Text>
            </Button>
        </View>
    );
};

export interface DisplayOptionsProps {
    supportGrouping: boolean;
}

const ViewModeSelector = () => {
    const mode$ = getSelectedTab$().viewMode;
    const mode = use$(mode$);

    const handleModeChange = (newMode: ViewMode) => {
        mode$.set(newMode);
    };

    const viewModes: ViewMode[] = ["List", "Board"];

    return (
        <View className="flex-row border border-border-primary rounded-md mx-2 my-2 overflow-hidden">
            {viewModes.map((viewMode) => (
                <Button
                    key={viewMode}
                    className={cn(
                        "px-3 py-2 justify-center border-r border-border-primary last:border-r-0 gap-x-2 flex-1 flex-row rounded-none",
                        mode === viewMode
                            ? "bg-background-tertiary"
                            : "bg-background-secondary hover:bg-background-tertiary",
                    )}
                    variant="accent"
                    onPress={() => handleModeChange(viewMode)}
                >
                    <Icon
                        name={viewMode === "List" ? "list.bullet" : "rectangle.split.3x1"}
                        size={viewMode === "List" ? 16 : 18}
                        marginTop={viewMode === "List" ? -1 : -3}
                    />
                    <Text className={cn("text-xs", mode === viewMode ? "text-text-primary" : "text-text-secondary")}>
                        {viewMode}
                    </Text>
                </Button>
            ))}
        </View>
    );
};

export const DisplayOptions = ({ supportGrouping = false }: DisplayOptionsProps) => {
    const displayOptions$ = getSelectedTab$().displayOptions;

    const getDisplayName = (option: string) => {
        switch (option) {
            case "created_at":
                return "Created Date";
            case "updated_at":
                return "Updated Date";
            case "asc":
                return "Ascending";
            case "desc":
                return "Descending";
            default:
                return option.charAt(0).toUpperCase() + option.slice(1);
        }
    };

    const renderOptionText = (option: string) => <Text className="text-text-primary">{getDisplayName(option)}</Text>;

    return (
        <View className="flex-col gap-2">
            <View className="flex-row items-center flex-wrap gap-2">
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger className="hover:bg-background-tertiary rounded-md flex-row justify-between items-center overflow-hidden h-9 px-2 gap-x-1">
                        <Icon name={"slider.horizontal.3"} size={16} marginTop={-3} />
                        <Text className={cn("text-text-secondary text-xs")}>Display</Text>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <ViewModeSelector />
                        {supportGrouping && (
                            <View className="flex-row items-center justify-between gap-x-8 p-2">
                                <Text className="text-text-primary">Group By</Text>
                                <Select
                                    selected$={displayOptions$.grouping}
                                    items={GroupingOptions}
                                    getItemKey={(option) => option}
                                    renderItem={renderOptionText}
                                    renderItemText={getDisplayName}
                                    triggerClassName="bg-background-tertiary"
                                />
                            </View>
                        )}
                        <View className="flex-row items-center justify-between gap-x-8 p-2">
                            <Text className="text-text-primary">Order By</Text>
                            <Select
                                selected$={displayOptions$.ordering}
                                items={OrderingOptions}
                                getItemKey={(option) => option}
                                renderItem={renderOptionText}
                                renderItemText={getDisplayName}
                                triggerClassName="bg-background-tertiary"
                            />
                        </View>
                        <View className="flex-row items-center justify-between gap-x-8 p-2">
                            <Text className="text-text-primary">Order Direction</Text>
                            <Select
                                selected$={displayOptions$.orderDirection}
                                items={OrderDirectionOptions}
                                getItemKey={(option) => option}
                                renderItem={renderOptionText}
                                renderItemText={getDisplayName}
                                triggerClassName="bg-background-tertiary"
                            />
                        </View>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </View>
        </View>
    );
};
