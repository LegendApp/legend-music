# Native Button Components with Liquid Glass Style

## Overview
Create native macOS button components with the liquid glass appearance from macOS 26, matching the toolbar button style (grouped buttons sharing a glass container).

These are general-purpose components using `NSGlassEffectView` + `NSButton`, which work anywhere in the view hierarchy - not tied to `NSToolbar`.

## Components to Create

### 1. NativeButton
A single button with liquid glass background.

**Properties:**
- `sfSymbol`: SF Symbol name for the icon
- `title`: Optional text label
- `onPress`: Press callback
- `disabled`: Boolean
- `selected`: Boolean (for toggle states)

### 2. NativeButtonGroup
A container that groups multiple buttons with a shared liquid glass background.

**Properties:**
- `children`: NativeButton components
- `onSelectionChange`: Optional callback when selection changes (for segmented behavior)

## File Structure

### TypeScript/React Native
- `src/native-modules/NativeButton.tsx` - NativeButton component
- `src/native-modules/NativeButtonGroup.tsx` - NativeButtonGroup component

### Native macOS (Swift + Objective-C Bridge)
- `macos/LegendMusic-macOS/NativeButton/NativeButton.swift` - Swift implementation
- `macos/LegendMusic-macOS/NativeButton/NativeButtonBridge.m` - Objective-C bridge
- `macos/LegendMusic-macOS/NativeButtonGroup/NativeButtonGroup.swift` - Swift implementation
- `macos/LegendMusic-macOS/NativeButtonGroup/NativeButtonGroupBridge.m` - Objective-C bridge

## Implementation Details

### NativeButton.swift
```swift
@objc(RNNativeButton)
class RNNativeButton: RCTViewManager {
    override func view() -> NSView! {
        return NativeButtonView()
    }
}

class NativeButtonView: NSView {
    @objc var sfSymbol: String = ""
    @objc var title: String = ""
    @objc var disabled: Bool = false
    @objc var selected: Bool = false
    @objc var onPress: RCTBubblingEventBlock?

    private var button: NSButton!
    private var glassContainer: NSView? // NSGlassEffectView on macOS 26+

    // Button uses borderless style, glass container provides background
    // On hover: subtle highlight within the glass
    // On press: deeper highlight
}
```

### NativeButtonGroup.swift
```swift
@objc(RNNativeButtonGroup)
class RNNativeButtonGroup: RCTViewManager {
    override func view() -> NSView! {
        return NativeButtonGroupView()
    }
}

class NativeButtonGroupView: NSView {
    private var glassContainer: NSView? // Shared NSGlassEffectView

    // Single glass container wrapping all child buttons
    // Child NativeButtonView instances rendered without individual glass
    // Handles layout of children horizontally
}
```

### Key Implementation Notes

1. **Glass Container**: Use `NSGlassEffectView` (macOS 26+) as the background
2. **Button Style**: `NSButton` with `.borderless` or `.accessoryBarAction` bezel style
3. **Hover States**: Track mouse enter/exit for highlight effects within glass
4. **Child Communication**: ButtonGroup tells child buttons not to render their own glass
5. **Fallback**: On macOS < 26, use a rounded rect with subtle fill

### macOS Version Handling
```swift
if #available(macOS 26.0, *) {
    let glass = NSGlassEffectView(frame: bounds)
    glass.style = .regular
    // Use glass container
} else {
    // Fallback: rounded rect with semi-transparent background
    layer?.backgroundColor = NSColor.white.withAlphaComponent(0.1).cgColor
    layer?.cornerRadius = 8
}
```

## Verification
1. Build the macOS app: `bun run mac`
2. Test NativeButton renders with glass effect
3. Test NativeButtonGroup shows shared glass container around multiple buttons
4. Test onPress callbacks fire correctly
5. Test disabled and selected states
6. Test fallback appearance on older macOS (if available)
