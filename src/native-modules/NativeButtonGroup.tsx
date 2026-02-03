import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import { requireNativeComponent, type ViewProps } from 'react-native';

export interface NativeButtonGroupProps extends ViewProps {
    /** NativeButton components */
    children: ReactNode;
    /** Optional callback when selection changes (for segmented behavior) */
    onButtonSelectionChange?: (index: number) => void;
}

const RNNativeButtonGroup = requireNativeComponent<NativeButtonGroupProps>('RNNativeButtonGroup');

cssInterop(RNNativeButtonGroup, {
    className: 'style',
});

export function NativeButtonGroup({ children, onButtonSelectionChange, ...props }: NativeButtonGroupProps) {
    return (
        <RNNativeButtonGroup onButtonSelectionChange={onButtonSelectionChange} {...props}>
            {children}
        </RNNativeButtonGroup>
    );
}
