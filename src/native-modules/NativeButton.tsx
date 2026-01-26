import { cssInterop } from 'nativewind';
import { requireNativeComponent, type ViewProps } from 'react-native';
import type { SFSymbols } from '@/types/SFSymbols';

export interface NativeButtonProps extends ViewProps {
    /** SF Symbol name for the icon */
    sfSymbol?: SFSymbols;
    /** Optional text label */
    title?: string;
    /** Press callback */
    onPress?: () => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Whether the button is selected (for toggle states) */
    selected?: boolean;
}

const RNNativeButton = requireNativeComponent<NativeButtonProps>('RNNativeButton');

cssInterop(RNNativeButton, {
    className: 'style',
});

export function NativeButton({
    sfSymbol,
    title,
    onPress,
    disabled = false,
    selected = false,
    ...props
}: NativeButtonProps) {
    return (
        <RNNativeButton
            sfSymbol={sfSymbol}
            title={title}
            onPress={onPress}
            disabled={disabled}
            selected={selected}
            {...props}
        />
    );
}
