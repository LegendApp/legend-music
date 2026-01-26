import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import { requireNativeComponent, type ViewProps } from 'react-native';

export interface NativeButtonGroupProps extends ViewProps {
    /** NativeButton components */
    children: ReactNode;
    /** Optional callback when selection changes (for segmented behavior) */
    onSelectionChange?: (index: number) => void;
}

const RNNativeButtonGroup = requireNativeComponent<NativeButtonGroupProps>('RNNativeButtonGroup');

cssInterop(RNNativeButtonGroup, {
    className: 'style',
});

export function NativeButtonGroup({ children, onSelectionChange, ...props }: NativeButtonGroupProps) {
    return (
        <RNNativeButtonGroup onSelectionChange={onSelectionChange} {...props}>
            {children}
        </RNNativeButtonGroup>
    );
}
