import AppKit
import React

@objc(RNNativeButton)
class RNNativeButton: RCTViewManager {
    override func view() -> NSView! {
        return NativeButtonView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

class NativeButtonView: NSView {
    @objc var sfSymbol: String = "" {
        didSet {
            updateButton()
        }
    }

    @objc var title: String = "" {
        didSet {
            updateButton()
        }
    }

    @objc var disabled: Bool = false {
        didSet {
            button.isEnabled = !disabled
            updateAppearance()
        }
    }

    @objc var selected: Bool = false {
        didSet {
            updateAppearance()
        }
    }

    @objc var onPress: RCTBubblingEventBlock?

    // Track whether this button is inside a group (no individual glass)
    var isInGroup: Bool = false {
        didSet {
            updateGlassContainer()
        }
    }

    private var button: NSButton!
    private var glassContainer: NSView?
    private var trackingArea: NSTrackingArea?
    private var isHovered: Bool = false

    override var isFlipped: Bool {
        return true
    }

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        wantsLayer = true

        // Create the button
        button = NSButton(frame: bounds)
        button.autoresizingMask = [.width, .height]
        button.bezelStyle = .accessoryBarAction
        button.isBordered = false
        button.imagePosition = .imageLeading
        button.target = self
        button.action = #selector(buttonPressed)
        button.setButtonType(.momentaryChange)

        // Setup glass container for standalone buttons
        updateGlassContainer()

        addSubview(button)
        updateTrackingArea()
    }

    private func updateGlassContainer() {
        // Remove existing glass container
        glassContainer?.removeFromSuperview()
        glassContainer = nil

        // Only add glass if not in a group
        guard !isInGroup else { return }

        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView(frame: bounds)
            glass.translatesAutoresizingMaskIntoConstraints = false
            glass.style = .regular
            glass.wantsLayer = true
            glassContainer = glass
            addSubview(glass, positioned: .below, relativeTo: button)

            NSLayoutConstraint.activate([
                glass.leadingAnchor.constraint(equalTo: leadingAnchor),
                glass.trailingAnchor.constraint(equalTo: trailingAnchor),
                glass.topAnchor.constraint(equalTo: topAnchor),
                glass.bottomAnchor.constraint(equalTo: bottomAnchor),
            ])
        } else {
            // Fallback for older macOS
            let fallbackView = NSView(frame: bounds)
            fallbackView.translatesAutoresizingMaskIntoConstraints = false
            fallbackView.wantsLayer = true
            fallbackView.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.1).cgColor
            fallbackView.layer?.cornerRadius = 8
            glassContainer = fallbackView
            addSubview(fallbackView, positioned: .below, relativeTo: button)

            NSLayoutConstraint.activate([
                fallbackView.leadingAnchor.constraint(equalTo: leadingAnchor),
                fallbackView.trailingAnchor.constraint(equalTo: trailingAnchor),
                fallbackView.topAnchor.constraint(equalTo: topAnchor),
                fallbackView.bottomAnchor.constraint(equalTo: bottomAnchor),
            ])
        }
    }

    private func updateButton() {
        // Set SF Symbol image
        if !sfSymbol.isEmpty {
            if let image = NSImage(systemSymbolName: sfSymbol, accessibilityDescription: nil) {
                let config = NSImage.SymbolConfiguration(pointSize: 14, weight: .medium)
                button.image = image.withSymbolConfiguration(config)
            }
        } else {
            button.image = nil
        }

        // Set title
        button.title = title

        // Adjust image position based on whether we have both
        if !sfSymbol.isEmpty && !title.isEmpty {
            button.imagePosition = .imageLeading
        } else if !sfSymbol.isEmpty {
            button.imagePosition = .imageOnly
        } else {
            button.imagePosition = .noImage
        }

        updateAppearance()
    }

    private func updateAppearance() {
        let alpha: CGFloat = disabled ? 0.4 : 1.0

        if selected {
            button.contentTintColor = NSColor.controlAccentColor.withAlphaComponent(alpha)
        } else if isHovered && !disabled {
            button.contentTintColor = NSColor.labelColor.withAlphaComponent(0.8)
        } else {
            button.contentTintColor = NSColor.secondaryLabelColor.withAlphaComponent(alpha)
        }

        // Update hover highlight
        if !isInGroup {
            if #available(macOS 26.0, *) {
                // Glass handles hover states automatically
            } else {
                // Fallback hover effect
                if isHovered && !disabled {
                    glassContainer?.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.15).cgColor
                } else {
                    glassContainer?.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.1).cgColor
                }
            }
        }
    }

    @objc private func buttonPressed() {
        print("[NativeButton] buttonPressed called, disabled: \(disabled)")
        guard !disabled else { return }
        print("[NativeButton] calling onPress")
        onPress?([:])
    }

    // MARK: - Mouse Tracking

    private func updateTrackingArea() {
        if let existing = trackingArea {
            removeTrackingArea(existing)
        }

        trackingArea = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea!)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        updateTrackingArea()
    }

    override func mouseDown(with event: NSEvent) {
        print("[NativeButton] mouseDown received")
        super.mouseDown(with: event)
    }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        updateAppearance()
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        updateAppearance()
    }

    override func layout() {
        super.layout()
        glassContainer?.frame = bounds
        button.frame = bounds
        print("[NativeButton] layout - view bounds: \(bounds), button frame: \(button.frame)")
    }
}
