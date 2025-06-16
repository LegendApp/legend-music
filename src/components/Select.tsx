import type { Observable, ObservableParam } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { DropdownMenu } from "@/components/DropdownMenu";
import { WithCheckbox } from "@/components/WithCheckbox";
import { cn } from "@/utils/cn";
import { equals } from "@/utils/equals";

export interface SelectPropsBase<T> {
    items: T[];
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
    closeOnSelect?: boolean;
    unstyled?: boolean;
    withCheckbox?: boolean;
    getItemKey: (item: NoInfer<T>) => string;
    renderItem: (item: NoInfer<T>) => ReactNode;
    renderItemText?: (item: NoInfer<T>) => string;
}

export interface SelectProps<T> extends SelectPropsBase<T> {
    selected$?: ObservableParam<NoInfer<T>>;
    selected?: T;
    onSelectItem?: (item: NoInfer<T>) => void;
}

export interface SelectMultipleProps<T> extends SelectPropsBase<T> {
    selectedItems$: Observable<T[]>;
    onSelectItem?: (item: NoInfer<T>, isRemove: boolean) => void;
}

export function Select<T>({ selected, selected$, placeholder, onSelectItem, renderItemText, ...rest }: SelectProps<T>) {
    selected = selected$ ? use$<T>(selected$) : selected;

    // Create internal array observable that mirrors the single selection
    const selectedItems$ = useObservable<T[]>(selected ? [selected] : []);

    const handleSelectItem = (item: T) => {
        selected$?.set(item);
        selectedItems$.set([item] as any);
        onSelectItem?.(item);
    };

    return (
        <SelectMultiple
            selectedItems$={selectedItems$}
            placeholder={selected && renderItemText ? String(renderItemText(selected)) : placeholder}
            onSelectItem={handleSelectItem}
            closeOnSelect={true}
            renderItemText={renderItemText}
            {...rest}
        />
    );
}

export function SelectMultiple<T>({
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
}: SelectMultipleProps<T>) {
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
        return <WithCheckbox checked={checked}>{renderItem(item)}</WithCheckbox>;
    };

    const renderItems = () => {
        return items.map((item) => (
            <DropdownMenu.Item key={getItemKey(item)} onSelect={() => handleSelectItem(item)}>
                {withCheckbox ? renderWithCheckbox(item) : renderItem(item)}
            </DropdownMenu.Item>
        ));
    };

    const selectedCount = selectedItems$.length;
    const displayText =
        selectedCount > 1
            ? (renderItemText ? selectedItems.map(renderItemText) : selectedItems).join(", ")
            : selectedCount > 0
              ? renderItem(selectedItems[0])
              : placeholder;

    return (
        <DropdownMenu.Root closeOnSelect={closeOnSelect}>
            <DropdownMenu.Trigger
                className={cn(
                    !unstyled &&
                        "bg-background-secondary hover:bg-background-tertiary rounded-md flex-row justify-between items-center overflow-hidden border border-border-primary h-8 px-2",
                    triggerClassName,
                )}
            >
                <Text className="text-text-secondary text-xs">{displayText}</Text>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className={className} maxHeightClassName="max-h-96">
                {renderItems()}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
