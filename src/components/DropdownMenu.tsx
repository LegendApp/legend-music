import { Callout } from "@fluentui-react-native/callout";
import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import type { Component, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { type GestureResponderEvent, ScrollView, Text, View } from "react-native";
import { Icon } from "@/systems/Icon";
import { state$ } from "@/systems/State";
import { cn } from "@/utils/cn";
import { Button } from "./Button";

// Context for sharing dropdown state
interface DropdownContextValue {
    isOpen$: Observable<boolean>;
    triggerRef: React.RefObject<View | null>;
    close: () => void;
    onSelect?: (value: string) => void;
    closeOnSelect?: boolean;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

// Context for submenu state
interface SubmenuContextValue {
    parentRef: React.RefObject<View | null> | null;
    level: number;
    submenuId?: string;
}

const SubmenuContext = createContext<SubmenuContextValue>({
    parentRef: null,
    level: 0,
});

function useDropdownContext() {
    const context = useContext(DropdownContext);
    if (!context) {
        throw new Error("Dropdown components must be used within DropdownMenu.Root");
    }
    return context;
}

// Root component
interface RootProps {
    children: ReactNode;
    onSelect?: (value: string) => void;
    closeOnSelect?: boolean;
    onOpenChange?: (open: boolean) => void;
}

function Root({ children, onSelect, closeOnSelect = true, onOpenChange }: RootProps) {
    const isOpen$ = useObservable(false);
    const openedWithMouseDown$ = useObservable(false);
    const triggerRef = useRef<View>(null);

    const close = useCallback(() => {
        setTimeout(() => {
            isOpen$.set(false);
            openedWithMouseDown$.set(false);
            state$.isDropdownOpen.set(false);
        }, 60);
        onOpenChange?.(false);
    }, [onOpenChange]);

    useEffect(() => {
        return isOpen$.onChange(({ value: open }) => {
            state$.isDropdownOpen.set(open);
            onOpenChange?.(open);
            if (!open) {
                openedWithMouseDown$.set(false);
            }
        });
    }, [onOpenChange]);

    const contextValue: DropdownContextValue = {
        isOpen$,
        triggerRef,
        close,
        onSelect,
        closeOnSelect,
    };

    return <DropdownContext.Provider value={contextValue}>{children}</DropdownContext.Provider>;
}

// Trigger component
interface TriggerProps {
    children: ReactNode;
    className?: string;
    asChild?: boolean;
    unstyled?: boolean;
    showCaret?: boolean;
    caretPosition?: "right" | "left";
    textClassName?: string;
    caretClassName?: string;
}

function Trigger({
    children,
    className,
    asChild = false,
    unstyled = false,
    showCaret = false,
    caretPosition = "right",
    textClassName,
    caretClassName,
}: TriggerProps) {
    const { isOpen$, triggerRef } = useDropdownContext();

    const onMouseDown = useCallback(() => {
        if (!isOpen$.get()) {
            isOpen$.set(true);
        }
    }, []);

    if (asChild) {
        // If asChild, we should not render a button, just the children
        return (
            <View ref={triggerRef}>
                <Button onMouseDown={onMouseDown}>{children}</Button>
            </View>
        );
    }

    if (unstyled || showCaret) {
        // Custom styled trigger with optional caret
        return (
            <View ref={triggerRef}>
                <Button className={cn("flex-row items-center group", className)} onMouseDown={onMouseDown}>
                    {caretPosition === "left" && showCaret && (
                        <Text className={cn("text-white/70 group-hover:text-white mr-2", caretClassName)}>⌄</Text>
                    )}
                    <View className={cn("flex-1", textClassName)}>{children}</View>
                    {caretPosition === "right" && showCaret && (
                        <Text className={cn("text-white/70 group-hover:text-white ml-2", caretClassName)}>
                            <Icon name="chevron.up.chevron.down" size={14} />
                        </Text>
                    )}
                </Button>
            </View>
        );
    }

    return (
        <View ref={triggerRef}>
            <Button className={className} onMouseDown={onMouseDown}>
                {children}
            </Button>
        </View>
    );
}

// Content component
interface ContentProps {
    children: ReactNode;
    className?: string;
    maxHeightClassName?: `max-h-${number}`;
    scrolls?: boolean;
    directionalHint?:
        | "bottonLeftEdge"
        | "bottomCenter"
        | "bottomRightEdge"
        | "topLeftEdge"
        | "topCenter"
        | "topRightEdge";
}

function Content({
    children,
    className = "",
    maxHeightClassName,
    scrolls = true,
    directionalHint = "bottonLeftEdge",
}: ContentProps) {
    const contextValue = useDropdownContext();
    const { isOpen$, triggerRef, close } = contextValue;
    const isOpen = use$(isOpen$);

    if (!isOpen) {
        return null;
    }

    return (
        <Callout
            target={triggerRef as React.RefObject<Component>}
            onDismiss={close}
            directionalHint={directionalHint}
            gapSpace={4}
            minWidth={400}
            dismissBehaviors={["preventDismissOnKeyDown"]}
            allowsVibrancy
        >
            <DropdownContext.Provider value={contextValue}>
                <SubmenuContext.Provider
                    value={{
                        parentRef: triggerRef,
                        level: 0,
                    }}
                >
                    {scrolls ? (
                        <ScrollView
                            className={cn("rounded border border-border-popup", maxHeightClassName, className)}
                            contentContainerClassName="p-1"
                            scrollEnabled={!!maxHeightClassName}
                        >
                            {children}
                        </ScrollView>
                    ) : (
                        <View className={cn("rounded border border-border-popup", maxHeightClassName, className)}>
                            <View className="p-1">{children}</View>
                        </View>
                    )}
                </SubmenuContext.Provider>
            </DropdownContext.Provider>
        </Callout>
    );
}

// Label component
interface LabelProps {
    children: ReactNode;
    className?: string;
}

function Label({ children, className = "" }: LabelProps) {
    return <Text className={cn("px-3 py-2 text-text-secondary text-sm font-medium", className)}>{children}</Text>;
}

// Item component
interface ItemProps {
    children: ReactNode;
    onSelect?: () => void;
    value?: string;
    className?: string;
    disabled?: boolean;
}

function Item({ children, onSelect, value, className = "", disabled = false }: ItemProps) {
    const { close, onSelect: contextOnSelect, closeOnSelect } = useDropdownContext();

    const handlePress = useCallback(
        (e: GestureResponderEvent) => {
            if (disabled) return;

            if (onSelect) {
                onSelect();
            } else if (value && contextOnSelect) {
                contextOnSelect(value);
            }

            if (closeOnSelect) {
                close();
            }
        },
        [onSelect, value, contextOnSelect, closeOnSelect, close, disabled],
    );

    return (
        <Button
            className={cn(
                "py-2 px-3 rounded-md hover:bg-white/10 flex-row items-center",
                disabled && "opacity-50",
                className,
            )}
            onPress={handlePress}
            disabled={disabled}
        >
            {children}
        </Button>
    );
}

// ItemTitle component
interface ItemTitleProps {
    children: ReactNode;
    className?: string;
}

function ItemTitle({ children, className = "" }: ItemTitleProps) {
    return <Text className={cn("text-text-primary flex-1", className)}>{children}</Text>;
}

// CheckboxItem component
interface CheckboxItemProps {
    children: ReactNode;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    value?: string;
    className?: string;
}

function CheckboxItem({ children, checked = false, onCheckedChange, value, className = "" }: CheckboxItemProps) {
    const { close, onSelect: contextOnSelect, closeOnSelect } = useDropdownContext();

    const handlePress = useCallback(() => {
        const newChecked = !checked;
        onCheckedChange?.(newChecked);

        if (value && contextOnSelect) {
            contextOnSelect(value);
        }

        if (closeOnSelect) {
            close();
        }
    }, [checked, onCheckedChange, value, contextOnSelect, closeOnSelect, close]);

    return (
        <Button
            className={cn("py-2 px-3 rounded-md hover:bg-white/10 flex-row items-center", className)}
            onPress={handlePress}
        >
            {children}
        </Button>
    );
}

// ItemIndicator component
interface ItemIndicatorProps {
    children?: ReactNode;
    className?: string;
}

function ItemIndicator({ children = "✓", className = "" }: ItemIndicatorProps) {
    return <Text className={cn("text-text-primary mr-2", className)}>{children}</Text>;
}

// Sub component
interface SubProps {
    children: ReactNode;
    className?: string;
}

function Sub({ children, className = "" }: SubProps) {
    const submenuId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const activeSubmenuId = use$(state$.activeSubmenuId);
    const { level } = useContext(SubmenuContext);
    const subRef = useRef<View>(null);

    useEffect(() => {
        if (activeSubmenuId !== null && activeSubmenuId !== submenuId && isOpen) {
            setIsOpen(false);
        }
    }, [activeSubmenuId, submenuId, isOpen]);

    useEffect(() => {
        const unsubscribe = state$.isDropdownOpen.onChange(() => {
            if (!state$.isDropdownOpen.get()) {
                setIsOpen(false);
                state$.activeSubmenuId.set(null);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <SubmenuContext.Provider
            value={{
                parentRef: subRef,
                level: level + 1,
                submenuId,
            }}
        >
            <View ref={subRef} className={className}>
                {children}
            </View>
        </SubmenuContext.Provider>
    );
}

// SubTrigger component
interface SubTriggerProps {
    children: ReactNode;
    className?: string;
}

function SubTrigger({ children, className = "" }: SubTriggerProps) {
    const { submenuId } = useContext(SubmenuContext);

    const onHoverIn = useCallback(() => {
        if (submenuId) {
            state$.activeSubmenuId.set(submenuId);
        }
    }, [submenuId]);

    return (
        <Button
            className={cn("p-2 rounded-lg hover:bg-white/10 flex-row justify-between items-center", className)}
            onHoverIn={onHoverIn}
        >
            {children}
            <Text className="text-text-tertiary ml-2">▶</Text>
        </Button>
    );
}

// SubContent component
interface SubContentProps {
    children: ReactNode;
    className?: string;
    maxHeightClassName?: `max-h-${number}`;
    directionalHint?:
        | "rightTopEdge"
        | "rightCenter"
        | "rightBottomEdge"
        | "leftTopEdge"
        | "leftCenter"
        | "leftBottomEdge";
}

function SubContent({
    children,
    className = "",
    maxHeightClassName,
    directionalHint = "rightTopEdge",
}: SubContentProps) {
    const [isOpen, setIsOpen] = useState(false);
    const activeSubmenuId = use$(state$.activeSubmenuId);
    const { parentRef, submenuId } = useContext(SubmenuContext);
    const contextValue = useDropdownContext();

    useEffect(() => {
        if (activeSubmenuId === submenuId) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [activeSubmenuId, submenuId]);

    if (!isOpen || !parentRef) {
        return null;
    }

    return (
        <Callout
            target={parentRef as React.RefObject<Component>}
            directionalHint={directionalHint}
            gapSpace={1}
            dismissBehaviors={["preventDismissOnKeyDown"]}
            minWidth={400}
        >
            <DropdownContext.Provider value={contextValue}>
                <ScrollView
                    className={cn("rounded border border-border-popup", maxHeightClassName, className)}
                    contentContainerClassName="p-1"
                    scrollEnabled={!!maxHeightClassName}
                >
                    {children}
                </ScrollView>
            </DropdownContext.Provider>
        </Callout>
    );
}

// Separator component
interface SeparatorProps {
    className?: string;
}

function Separator({ className = "" }: SeparatorProps) {
    return <View className={cn("h-[1px] bg-border-popup my-1 -mx-1", className)} />;
}

// Arrow component (placeholder for now)
interface ArrowProps {
    className?: string;
}

function Arrow({ className: _className }: ArrowProps) {
    // This would typically be a visual arrow pointing to the trigger
    return null;
}

// Export the compound component
export const DropdownMenu = {
    Root,
    Trigger,
    Content,
    Label,
    Item,
    ItemTitle,
    CheckboxItem,
    ItemIndicator,
    Sub,
    SubTrigger,
    SubContent,
    Separator,
    Arrow,
};
