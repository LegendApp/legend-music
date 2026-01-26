import AppKit
import React

@objc(RNNativeButtonGroup)
class RNNativeButtonGroup: RCTViewManager {
    override func view() -> NSView! {
        return NativeButtonGroupView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

class NativeButtonGroupView: NSView {
    @objc var onSelectionChange: RCTBubblingEventBlock?

    private var glassContainer: NSView?
    private var contentContainer: NSView!
    private var childButtons: [NativeButtonView] = []

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

        // Create content container for child buttons
        contentContainer = NSView(frame: bounds)
        contentContainer.translatesAutoresizingMaskIntoConstraints = false
        contentContainer.wantsLayer = true
        contentContainer.layer?.backgroundColor = NSColor.clear.cgColor

        // Setup glass container
        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView(frame: bounds)
            glass.translatesAutoresizingMaskIntoConstraints = false
            glass.style = .regular
            glass.wantsLayer = true
            glass.layer?.backgroundColor = NSColor.clear.cgColor
            glass.contentView = contentContainer
            glassContainer = glass
            addSubview(glass)

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
            addSubview(fallbackView)

            contentContainer.frame = fallbackView.bounds
            fallbackView.addSubview(contentContainer)

            NSLayoutConstraint.activate([
                fallbackView.leadingAnchor.constraint(equalTo: leadingAnchor),
                fallbackView.trailingAnchor.constraint(equalTo: trailingAnchor),
                fallbackView.topAnchor.constraint(equalTo: topAnchor),
                fallbackView.bottomAnchor.constraint(equalTo: bottomAnchor),
                contentContainer.leadingAnchor.constraint(equalTo: fallbackView.leadingAnchor),
                contentContainer.trailingAnchor.constraint(equalTo: fallbackView.trailingAnchor),
                contentContainer.topAnchor.constraint(equalTo: fallbackView.topAnchor),
                contentContainer.bottomAnchor.constraint(equalTo: fallbackView.bottomAnchor),
            ])
        }
    }

    override func insertReactSubview(_ subview: NSView!, at atIndex: Int) {
        // Add to content container instead of directly to self
        contentContainer.addSubview(subview)

        // If this is a NativeButtonView, configure it for group mode
        if let buttonView = subview as? NativeButtonView {
            buttonView.isInGroup = true
            childButtons.append(buttonView)
        }
    }

    override func removeReactSubview(_ subview: NSView!) {
        subview.removeFromSuperview()

        // Remove from tracked buttons
        if let buttonView = subview as? NativeButtonView {
            childButtons.removeAll { $0 === buttonView }
        }
    }

    override func layout() {
        super.layout()
        glassContainer?.frame = bounds

        if #available(macOS 26.0, *) {
            // Glass container manages content view layout
        } else {
            contentContainer.frame = glassContainer?.bounds ?? bounds
        }

        // Layout child buttons horizontally
        layoutChildButtons()
    }

    private func layoutChildButtons() {
        let subviews = contentContainer.subviews
        guard !subviews.isEmpty else { return }

        let padding: CGFloat = 4
        let spacing: CGFloat = 2
        var xOffset = padding

        for subview in subviews {
            let buttonWidth = subview.frame.width > 0 ? subview.frame.width : 28
            let buttonHeight = bounds.height - (padding * 2)

            subview.frame = NSRect(
                x: xOffset,
                y: padding,
                width: buttonWidth,
                height: buttonHeight
            )

            xOffset += buttonWidth + spacing
        }
    }
}
