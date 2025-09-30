import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import type { Observable, ObservableParam } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { DropdownMenu } from "@/components/DropdownMenu";
import { WithCheckbox } from "@/components/WithCheckbox";
import { cn } from "@/utils/cn";
import { equals } from "@/utils/equals";

export interface SelectLegendListPropsBase<T> {
    items: T[];
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
    closeOnSelect?: boolean;
    unstyled?: boolean;
    withCheckbox?: boolean;
    getItemKey: (item: NoInfer<T>) => string;
    renderItem: (item: NoInfer<T>, mode: "item" | "preview") => ReactNode;
    renderItemText?: (item: NoInfer<T>) => string;
    showCaret?: boolean;
    caretPosition?: "right" | "left";
    textClassName?: string;
    maxWidthMatchTrigger?: boolean;
    directionalHint?:
        | "bottonLeftEdge"
        | "bottomCenter"
        | "bottomRightEdge"
        | "topLeftEdge"
        | "topCenter"
        | "topRightEdge";
}

export interface SelectLegendListProps<T> extends SelectLegendListPropsBase<T> {
    selected$?: ObservableParam<NoInfer<T> | undefined>;
    selected?: T;
    onSelectItem?: (item: NoInfer<T>) => void;
}

export interface SelectLegendListMultipleProps<T> extends SelectLegendListPropsBase<T> {
    selectedItems$: Observable<T[]>;
    onSelectItem?: (item: NoInfer<T>, isRemove: boolean) => void;
}

export function SelectLegendList<T>({
    selected,
    selected$,
    placeholder,
    onSelectItem,
    renderItemText,
    ...rest
}: SelectLegendListProps<T>) {
    selected = selected$ ? use$<T | undefined>(selected$) : selected;

    // Create internal array observable that mirrors the single selection
    const selectedItems$ = useObservable<T[]>(selected ? [selected] : []);

    const handleSelectItem = (item: T) => {
        selected$?.set(item);
        selectedItems$.set([item] as any);
        onSelectItem?.(item);
    };

    return (
        <SelectLegendListMultiple
            selectedItems$={selectedItems$}
            placeholder={selected && renderItemText ? String(renderItemText(selected)) : placeholder}
            onSelectItem={handleSelectItem}
            closeOnSelect={true}
            renderItemText={renderItemText}
            {...rest}
        />
    );
}

export function SelectLegendListMultiple<T>({
    selectedItems$,
    items,
    getItemKey,
    renderItem,
    renderItemText,
    placeholder,
    triggerClassName,
    className,
    closeOnSelect = false,
    unstyled = false,
    withCheckbox,
    onSelectItem,
    showCaret = false,
    caretPosition = "right",
    textClassName,
    directionalHint = "bottonLeftEdge",
    // maxWidthMatchTrigger = false,
}: SelectLegendListMultipleProps<T>) {
    const selectedItems = use$<T[]>(selectedItems$);

    const handleSelectItem = (item: T) => {
        const index = selectedItems.indexOf(item);
        const isRemove = index >= 0;
        if (isRemove) {
            selectedItems$.splice(index, 1);
        } else {
            selectedItems$.push(item);
        }

        onSelectItem?.(item, isRemove);
    };

    const renderWithCheckbox = (item: T) => {
        const arr = selectedItems$.get() || [];
        const checked = !!arr.find((it) => equals(item, it));
        return <WithCheckbox checked={checked}>{renderItem(item, "item")}</WithCheckbox>;
    };

    const renderListItem = ({ item }: LegendListRenderItemProps<T>) => (
        <DropdownMenu.Item key={getItemKey(item)} onSelect={() => handleSelectItem(item)}>
            {withCheckbox ? renderWithCheckbox(item) : renderItem(item, "item")}
        </DropdownMenu.Item>
    );

    const selectedCount = selectedItems$.length;
    const displayText =
        selectedCount > 1
            ? (renderItemText ? selectedItems.map(renderItemText) : selectedItems).join(", ")
            : selectedCount > 0
              ? renderItemText
                  ? renderItemText(selectedItems[0])
                  : renderItem(selectedItems[0], "preview")
              : placeholder;

    return (
        <DropdownMenu.Root closeOnSelect={closeOnSelect}>
            <DropdownMenu.Trigger
                className={cn(
                    !unstyled &&
                        "bg-background-secondary hover:bg-background-tertiary rounded-md flex-row justify-between items-center overflow-hidden border border-border-primary h-8 px-2",
                    triggerClassName,
                )}
                unstyled={unstyled}
                showCaret={showCaret}
                caretPosition={caretPosition}
                textClassName={textClassName}
            >
                <Text
                    className={cn(
                        !unstyled
                            ? "text-text-secondary text-xs"
                            : "text-white/70 group-hover:text-white text-base font-medium",
                        textClassName,
                    )}
                >
                    {displayText}
                </Text>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
                className={className}
                maxHeightClassName="max-h-96"
                scrolls={false}
                directionalHint={directionalHint}
                // maxWidthMatchTrigger={maxWidthMatchTrigger}
            >
                <View style={{ maxHeight: 384 }}>
                    <LegendList
                        data={items}
                        keyExtractor={getItemKey}
                        renderItem={renderListItem}
                        // contentContainerStyle={{ padding: 4 }}
                        style={{
                            // width: maxWidthMatchTrigger ? "100%" : 400,
                            height: "100%",
                        }}
                    />
                </View>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
