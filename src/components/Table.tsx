import type { PropsWithChildren } from "react";
import { Text, View, type ViewStyle } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";

import { Button } from "@/components/Button";
import { PlaybackIndicator } from "@/components/PlaybackIndicator";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { cn } from "@/utils/cn";

export type TableColumnAlign = "left" | "center" | "right";

export interface TableColumnSpec {
    id: string;
    label?: string;
    flex?: number;
    width?: number;
    minWidth?: number;
    align?: TableColumnAlign;
}

interface TableProps {
    header?: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}

export function Table({ header, className, bodyClassName, children }: PropsWithChildren<TableProps>) {
    return (
        <View
            className={cn(
                "flex-1 min-h-0 bg-background-secondary border border-border-primary rounded-md overflow-hidden",
                className,
            )}
        >
            {header ? <View className="border-b border-white/10">{header}</View> : null}
            <View className={cn("flex-1 min-h-0", bodyClassName)}>{children}</View>
        </View>
    );
}

interface TableHeaderProps {
    columns: TableColumnSpec[];
    className?: string;
    cellClassName?: string;
}

export function TableHeader({ columns, className, cellClassName }: TableHeaderProps) {
    const listItemStyles = useListItemStyles();

    return (
        <View className={cn("flex-row items-center h-8 px-3 bg-black/20", className)}>
            {columns.map((column) => (
                <TableCell key={column.id} column={column} className={cellClassName}>
                    {column.label ? (
                        <Text
                            className={cn(
                                "text-[11px] font-semibold uppercase tracking-wider",
                                listItemStyles.text.muted,
                            )}
                            numberOfLines={1}
                        >
                            {column.label}
                        </Text>
                    ) : null}
                </TableCell>
            ))}
        </View>
    );
}

interface TableRowProps {
    isSelected?: boolean;
    isActive?: boolean;
    isInteractive?: boolean;
    className?: string;
    onClick?: (event: NativeMouseEvent) => void;
    onDoubleClick?: (event: NativeMouseEvent) => void;
    onRightClick?: (event: NativeMouseEvent) => void;
}

export function TableRow({
    children,
    className,
    isSelected = false,
    isActive = false,
    isInteractive = true,
    onClick,
    onDoubleClick,
    onRightClick,
}: PropsWithChildren<TableRowProps>) {
    const listItemStyles = useListItemStyles();

    return (
        <Button
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onRightClick={onRightClick}
            className={cn(
                listItemStyles.getRowClassName({
                    variant: "compact",
                    isSelected,
                    isActive,
                    isInteractive,
                }),
                className,
            )}
        >
            {isActive ? (
                <PlaybackIndicator />
            ) : null}
            {children}
        </Button>
    );
}

interface TableCellProps {
    column: TableColumnSpec;
    className?: string;
    textClassName?: string;
    truncate?: boolean;
}

export function TableCell({
    column,
    className,
    textClassName,
    truncate = false,
    children,
}: PropsWithChildren<TableCellProps>) {
    const style: ViewStyle = {};
    if (column.width !== undefined) {
        style.width = column.width;
    }
    if (column.minWidth !== undefined) {
        style.minWidth = column.minWidth;
    }
    if (column.flex !== undefined && column.width === undefined) {
        style.flex = column.flex;
    }

    const alignClassName =
        column.align === "right" ? "items-end" : column.align === "center" ? "items-center" : "items-start";

    if (truncate && (typeof children === "string" || typeof children === "number")) {
        return (
            <View style={style} className={cn("justify-center px-2", alignClassName, className)}>
                <Text className={cn("text-sm text-text-primary truncate", textClassName)} numberOfLines={1}>
                    {children}
                </Text>
            </View>
        );
    }

    return (
        <View style={style} className={cn("justify-center px-2", alignClassName, className)}>
            {children}
        </View>
    );
}
