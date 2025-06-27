import { Portal } from "@gorhom/portal";
import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import type { ReactNode } from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import {
	type LayoutChangeEvent,
	type LayoutRectangle,
	ScrollView,
	Text,
	View,
} from "react-native";
import { Icon } from "@/systems/Icon";
import { state$ } from "@/systems/State";
import { cn } from "@/utils/cn";
import { ShadowDropdown } from "@/utils/styles";
import { Button } from "./Button";

// Context for sharing dropdown state
interface DropdownContextValue {
	isOpen$: Observable<boolean>;
	triggerRef: { current: LayoutRectangle | null };
	close: () => void;
	onSelect?: (value: string) => void;
	closeOnSelect?: boolean;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

// Context for submenu state
interface SubmenuContextValue {
	parentPosition: LayoutRectangle | null;
	dropdownContentRect: LayoutRectangle | null;
	level: number;
	submenuId?: string;
}

const SubmenuContext = createContext<SubmenuContextValue>({
	parentPosition: null,
	dropdownContentRect: null,
	level: 0,
});

function useDropdownContext() {
	const context = useContext(DropdownContext);
	if (!context) {
		throw new Error(
			"Dropdown components must be used within DropdownMenu.Root",
		);
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

function Root({
	children,
	onSelect,
	closeOnSelect = true,
	onOpenChange,
}: RootProps) {
	const isOpen$ = useObservable(false);
	const triggerRef = useRef<LayoutRectangle>(null);

	const close = useCallback(() => {
		isOpen$.set(false);
		state$.isDropdownOpen.set(false);
		onOpenChange?.(false);
	}, [onOpenChange]);

	useEffect(() => {
		return isOpen$.onChange(({ value: open }) => {
			state$.isDropdownOpen.set(open);
			onOpenChange?.(open);
		});
	}, [onOpenChange]);

	const contextValue: DropdownContextValue = {
		isOpen$,
		triggerRef,
		close,
		onSelect,
		closeOnSelect,
	};

	return (
		<DropdownContext.Provider value={contextValue}>
			{children}
		</DropdownContext.Provider>
	);
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

	const onLayout = useCallback((event: LayoutChangeEvent) => {
		const layout = event.nativeEvent.layout;
		event.target.measureInWindow((x, y) => {
			triggerRef.current = {
				x,
				y,
				width: layout.width,
				height: layout.height,
			};
		});
	}, []);

	const onToggle = useCallback(() => {
		isOpen$.toggle();
	}, []);

	if (asChild) {
		// If asChild, we should not render a button, just the children
		return (
			<View onLayout={onLayout}>
				<Button onPress={onToggle}>{children}</Button>
			</View>
		);
	}

	if (unstyled || showCaret) {
		// Custom styled trigger with optional caret
		return (
			<Button
				className={cn("flex-row items-center group", className)}
				onPress={onToggle}
				onLayout={onLayout}
			>
				{caretPosition === "left" && showCaret && (
					<Text
						className={cn(
							"text-white/70 group-hover:text-white mr-2",
							caretClassName,
						)}
					>
						⌄
					</Text>
				)}
				<View className={cn("flex-1", textClassName)}>{children}</View>
				{caretPosition === "right" && showCaret && (
					<Text
						className={cn(
							"text-white/70 group-hover:text-white ml-2",
							caretClassName,
						)}
					>
						<Icon name="chevron.up.chevron.down" size={14} />
					</Text>
				)}
			</Button>
		);
	}

	return (
		<Button className={className} onPress={onToggle} onLayout={onLayout}>
			{children}
		</Button>
	);
}

// Content component
interface ContentProps {
	children: ReactNode;
	className?: string;
	maxHeightClassName?: `max-h-${number}`;
	offset?: { x?: number; y?: number };
	scrolls?: boolean;
	maxWidthMatchTrigger?: boolean;
}

function Content({
	children,
	className = "",
	maxHeightClassName,
	offset = { x: 0, y: 0 },
	scrolls = true,
	maxWidthMatchTrigger = false,
}: ContentProps) {
	const contextValue = useDropdownContext();
	const { isOpen$, triggerRef, close } = contextValue;
	const isOpen = use$(isOpen$);
	const [dropdownContentRect, setDropdownContentRect] =
		useState<LayoutRectangle | null>(null);

	const onDropdownContentLayout = useCallback((event: LayoutChangeEvent) => {
		setDropdownContentRect(event.nativeEvent.layout);
	}, []);

	if (!isOpen) {
		return null;
	}

	return (
		<Portal>
			<View className="absolute z-10 top-0 left-0 right-0 bottom-0">
				<Button onPress={close} className="flex-1" />
			</View>
			<View
				className={cn(
					"absolute z-10 bg-background-secondary rounded-md",
					className,
				)}
				style={[
					{
						left: triggerRef.current?.x! + (offset.x || 0),
						top:
							triggerRef.current?.y! +
							triggerRef.current?.height! +
							4 +
							(offset.y || 0),
						...(maxWidthMatchTrigger && triggerRef.current?.width
							? { width: triggerRef.current.width }
							: {}),
					},
					ShadowDropdown,
				]}
			>
				<DropdownContext.Provider value={contextValue}>
					<SubmenuContext.Provider
						value={{
							parentPosition: triggerRef.current,
							dropdownContentRect,
							level: 0,
						}}
					>
						{scrolls ? (
							<ScrollView
								onLayout={onDropdownContentLayout}
								className={cn(
									"rounded-md border border-border-popup",
									maxHeightClassName,
								)}
								contentContainerClassName="p-1"
								scrollEnabled={!!maxHeightClassName}
							>
								{children}
							</ScrollView>
						) : (
							<View
								className={cn(
									"rounded-md border border-border-popup",
									maxHeightClassName,
								)}
							>
								{children}
							</View>
						)}
					</SubmenuContext.Provider>
				</DropdownContext.Provider>
			</View>
		</Portal>
	);
}

// Label component
interface LabelProps {
	children: ReactNode;
	className?: string;
}

function Label({ children, className = "" }: LabelProps) {
	return (
		<Text
			className={cn(
				"px-3 py-2 text-text-secondary text-sm font-medium",
				className,
			)}
		>
			{children}
		</Text>
	);
}

// Item component
interface ItemProps {
	children: ReactNode;
	onSelect?: () => void;
	value?: string;
	className?: string;
	disabled?: boolean;
}

function Item({
	children,
	onSelect,
	value,
	className = "",
	disabled = false,
}: ItemProps) {
	const {
		close,
		onSelect: contextOnSelect,
		closeOnSelect,
	} = useDropdownContext();

	const handlePress = useCallback(() => {
		if (disabled) return;

		if (onSelect) {
			onSelect();
		} else if (value && contextOnSelect) {
			contextOnSelect(value);
		}

		if (closeOnSelect) {
			close();
		}
	}, [onSelect, value, contextOnSelect, closeOnSelect, close, disabled]);

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
	return (
		<Text className={cn("text-text-primary flex-1", className)}>
			{children}
		</Text>
	);
}

// CheckboxItem component
interface CheckboxItemProps {
	children: ReactNode;
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
	value?: string;
	className?: string;
}

function CheckboxItem({
	children,
	checked = false,
	onCheckedChange,
	value,
	className = "",
}: CheckboxItemProps) {
	const {
		close,
		onSelect: contextOnSelect,
		closeOnSelect,
	} = useDropdownContext();

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
			className={cn(
				"py-2 px-3 rounded-md hover:bg-white/10 flex-row items-center",
				className,
			)}
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
	return (
		<Text className={cn("text-text-primary mr-2", className)}>{children}</Text>
	);
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
	const { parentPosition, dropdownContentRect, level } =
		useContext(SubmenuContext);
	const itemLayout = useRef<LayoutRectangle | null>(null);

	const onLayout = useCallback((event: LayoutChangeEvent) => {
		itemLayout.current = event.nativeEvent.layout;
	}, []);

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

	const getSubmenuPosition = () => {
		if (!itemLayout.current || !parentPosition || !dropdownContentRect) {
			return null;
		}

		return {
			left: parentPosition.x + dropdownContentRect.width + 1,
			top: parentPosition.y + parentPosition.height + itemLayout.current.y + 4,
		};
	};

	const submenuPosition = getSubmenuPosition();

	return (
		<SubmenuContext.Provider
			value={{
				parentPosition: submenuPosition
					? {
							x: submenuPosition.left,
							y: submenuPosition.top,
							width: itemLayout.current?.width || 0,
							height: itemLayout.current?.height || 0,
						}
					: null,
				dropdownContentRect: null,
				level: level + 1,
				submenuId,
			}}
		>
			<View className={className} onLayout={onLayout}>
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
			className={cn(
				"p-2 rounded-lg hover:bg-white/10 flex-row justify-between items-center",
				className,
			)}
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
}

function SubContent({
	children,
	className = "",
	maxHeightClassName,
}: SubContentProps) {
	const [isOpen, setIsOpen] = useState(false);
	const activeSubmenuId = use$(state$.activeSubmenuId);
	const { parentPosition, submenuId } = useContext(SubmenuContext);
	const contextValue = useDropdownContext();

	useEffect(() => {
		if (activeSubmenuId === submenuId) {
			setIsOpen(true);
		} else {
			setIsOpen(false);
		}
	}, [activeSubmenuId, submenuId]);

	if (!isOpen || !parentPosition) {
		return null;
	}

	return (
		<Portal>
			<View
				className={cn("absolute z-20 bg-background-secondary", className)}
				style={[
					{
						left: parentPosition.x,
						top: parentPosition.y,
						minWidth: parentPosition.width,
					},
					ShadowDropdown,
				]}
			>
				<DropdownContext.Provider value={contextValue}>
					<ScrollView
						className={cn(
							"rounded-md border border-border-popup",
							maxHeightClassName,
						)}
						contentContainerClassName="p-1"
						scrollEnabled={!!maxHeightClassName}
					>
						{children}
					</ScrollView>
				</DropdownContext.Provider>
			</View>
		</Portal>
	);
}

// Separator component
interface SeparatorProps {
	className?: string;
}

function Separator({ className = "" }: SeparatorProps) {
	return (
		<View className={cn("h-[1px] bg-border-popup my-1 -mx-1", className)} />
	);
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
