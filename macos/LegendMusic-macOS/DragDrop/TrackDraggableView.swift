import AppKit
import React

@objc(RNTrackDragSource)
class RNTrackDragSource: RCTViewManager {
    override func view() -> NSView! {
        return TrackDraggableView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

class TrackDraggableView: NSView, NSDraggingSource {
    @objc var trackPayload: [[String: Any]] = []
    @objc var onDragStart: RCTDirectEventBlock?

    private let dragActivationDistance: CGFloat = 8
    private let dragActivationDelay: TimeInterval = 0.12
    private var initialMouseDownLocation: NSPoint?
    private var mouseDownTimestamp: TimeInterval?
    private var isDragging = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        commonInit()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    private func commonInit() {
        wantsLayer = true
    }

    override func mouseDown(with event: NSEvent) {
        initialMouseDownLocation = convert(event.locationInWindow, from: nil)
        mouseDownTimestamp = event.timestamp
        super.mouseDown(with: event)
    }

    override func mouseDragged(with event: NSEvent) {
        super.mouseDragged(with: event)

        guard !isDragging else { return }
        guard !trackPayload.isEmpty else { return }

        let startLocation = initialMouseDownLocation ?? convert(event.locationInWindow, from: nil)
        let currentLocation = convert(event.locationInWindow, from: nil)
        let distance = hypot(currentLocation.x - startLocation.x, currentLocation.y - startLocation.y)
        let elapsed = event.timestamp - (mouseDownTimestamp ?? event.timestamp)

        guard distance >= dragActivationDistance, elapsed >= dragActivationDelay else { return }

        isDragging = true
        onDragStart?([:])
        beginDragSession(event: event)
    }

    override func mouseUp(with event: NSEvent) {
        super.mouseUp(with: event)
        isDragging = false
        initialMouseDownLocation = nil
        mouseDownTimestamp = nil
    }

    private func beginDragSession(event: NSEvent) {
        guard let data = try? JSONSerialization.data(withJSONObject: trackPayload, options: []) else {
            isDragging = false
            return
        }

        let pasteboardItem = NSPasteboardItem()
        pasteboardItem.setData(data, forType: trackPasteboardType)

        let draggingItem = NSDraggingItem(pasteboardWriter: pasteboardItem)
        let draggingImage = snapshotImage()
        let draggingFrame = bounds
        draggingItem.setDraggingFrame(draggingFrame, contents: draggingImage)

        beginDraggingSession(with: [draggingItem], event: event, source: self)
    }

    private func snapshotImage() -> NSImage {
        let targetRect = bounds
        guard targetRect.width > 0, targetRect.height > 0 else {
            return NSImage(size: NSSize(width: 120, height: 40))
        }

        let image = NSImage(size: targetRect.size)
        image.lockFocus()
        if let context = NSGraphicsContext.current {
            layer?.render(in: context.cgContext) ?? draw(targetRect)
        }
        image.unlockFocus()
        return image
    }

    // MARK: - NSDraggingSource

    func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation {
        return .copy
    }

    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) {
        isDragging = false
        initialMouseDownLocation = nil
        mouseDownTimestamp = nil
    }

    func ignoreModifierKeys(for session: NSDraggingSession) -> Bool {
        return true
    }
}
