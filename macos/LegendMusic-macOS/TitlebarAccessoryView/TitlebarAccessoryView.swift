import AppKit
import React

@objc(RNTitlebarAccessoryView)
class RNTitlebarAccessoryView: RCTViewManager {
    override func view() -> NSView! {
        return TitlebarAccessoryView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

final class TitlebarAccessoryView: RCTUIView {
    private let contentContainer = NSView()
    private weak var titlebarView: NSView?

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
        contentContainer.wantsLayer = true
        contentContainer.layer?.backgroundColor = NSColor.clear.cgColor
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        updateAttachment()
    }

    override func layout() {
        super.layout()
        syncContainerFrame()
    }

    override func insertReactSubview(_ subview: NSView!, at atIndex: Int) {
        contentContainer.addSubview(subview)
    }

    override func removeReactSubview(_ subview: NSView!) {
        subview.removeFromSuperview()
    }

    override func didUpdateReactSubviews() {
        // Handled by insert/remove overrides.
    }

    private func updateAttachment() {
        guard let window else {
            detachFromTitlebar()
            return
        }

        guard let nextTitlebarView = window.standardWindowButton(.closeButton)?.superview else {
            detachFromTitlebar()
            return
        }

        if titlebarView !== nextTitlebarView {
            detachFromTitlebar()
            titlebarView = nextTitlebarView
            nextTitlebarView.addSubview(contentContainer)
        }

        syncContainerFrame()
    }

    private func detachFromTitlebar() {
        contentContainer.removeFromSuperview()
        titlebarView = nil
    }

    private func syncContainerFrame() {
        guard let titlebarView, window != nil else {
            return
        }

        let frameInWindow = convert(bounds, to: nil)
        let frameInTitlebar = titlebarView.convert(frameInWindow, from: nil)
        contentContainer.frame = frameInTitlebar
    }
}
