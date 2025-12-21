import AppKit
import React

@objc(RNSidebarSplitView)
class RNSidebarSplitView: RCTViewManager {
    override func view() -> NSView! {
        return SidebarSplitView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

final class SidebarSplitView: NSView {
    @objc var onSplitViewDidResize: RCTBubblingEventBlock?
    @objc var sidebarMinWidth: NSNumber = 180 {
        didSet {
            updateSidebarSizing()
        }
    }
    @objc var contentMinWidth: NSNumber = 320 {
        didSet {
            updateContentSizing()
        }
    }

    private let splitViewController: NSSplitViewController
    private let sidebarContainer = NSView()
    private let contentContainer = NSView()
    private let sidebarViewController: NSViewController
    private let contentViewController: NSViewController
    private let sidebarItem: NSSplitViewItem
    private let contentItem: NSSplitViewItem
    private var resizeObserver: NSObjectProtocol?
    private weak var sidebarReactView: NSView?
    private weak var contentReactView: NSView?

    override var isFlipped: Bool {
        return true
    }

    override init(frame frameRect: NSRect) {
        splitViewController = NSSplitViewController()
        sidebarViewController = NSViewController()
        contentViewController = NSViewController()
        sidebarViewController.view = sidebarContainer
        contentViewController.view = contentContainer
        sidebarItem = NSSplitViewItem(sidebarWithViewController: sidebarViewController)
        contentItem = NSSplitViewItem(viewController: contentViewController)
        super.init(frame: frameRect)
        setupSplitView()
    }

    required init?(coder: NSCoder) {
        splitViewController = NSSplitViewController()
        sidebarViewController = NSViewController()
        contentViewController = NSViewController()
        sidebarViewController.view = sidebarContainer
        contentViewController.view = contentContainer
        sidebarItem = NSSplitViewItem(sidebarWithViewController: sidebarViewController)
        contentItem = NSSplitViewItem(viewController: contentViewController)
        super.init(coder: coder)
        setupSplitView()
    }

    private func setupSplitView() {
        sidebarItem.canCollapse = false
        contentItem.canCollapse = false

        if #available(macOS 11.0, *) {
            sidebarItem.allowsFullHeightLayout = true
            contentItem.allowsFullHeightLayout = true
        }

        updateSidebarSizing()
        updateContentSizing()

        splitViewController.addSplitViewItem(sidebarItem)
        splitViewController.addSplitViewItem(contentItem)
        splitViewController.splitView.isVertical = true
        splitViewController.splitView.dividerStyle = .thin
        resizeObserver = NotificationCenter.default.addObserver(
            forName: NSSplitView.didResizeSubviewsNotification,
            object: splitViewController.splitView,
            queue: .main
        ) { [weak self] _ in
            self?.emitResizeEvent()
        }

        splitViewController.view.frame = bounds
        splitViewController.view.autoresizingMask = [.width, .height]
        addSubview(splitViewController.view)

        sidebarContainer.autoresizingMask = [.width, .height]
        contentContainer.autoresizingMask = [.width, .height]
    }

    override func layout() {
        super.layout()
        splitViewController.view.frame = bounds
        syncReactSubviewFrames()
    }

    private func updateSidebarSizing() {
        let minWidth = CGFloat(truncating: sidebarMinWidth)
        sidebarItem.minimumThickness = max(120, minWidth)
        sidebarItem.preferredThicknessFraction = 0.26
    }

    private func updateContentSizing() {
        let minWidth = CGFloat(truncating: contentMinWidth)
        contentItem.minimumThickness = max(240, minWidth)
    }

    override func insertReactSubview(_ subview: NSView!, at atIndex: Int) {
        if sidebarReactView == nil {
            sidebarReactView = subview
        } else if contentReactView == nil {
            contentReactView = subview
        }

        let targetView = subview === sidebarReactView ? sidebarContainer : contentContainer
        targetView.addSubview(subview)
        syncReactSubviewFrames()
    }

    override func removeReactSubview(_ subview: NSView!) {
        if subview === sidebarReactView {
            sidebarReactView = nil
        } else if subview === contentReactView {
            contentReactView = nil
        }
        subview.removeFromSuperview()
    }

    private func emitResizeEvent() {
        syncReactSubviewFrames()
        guard let onSplitViewDidResize else {
            return
        }

        let subviews = splitViewController.splitView.subviews
        let sizes = subviews.map { $0.frame.size.width }
        onSplitViewDidResize([
            "sizes": sizes,
            "isVertical": true,
        ])
    }

    private func syncReactSubviewFrames() {
        syncReactSubview(sidebarReactView, in: sidebarContainer)
        syncReactSubview(contentReactView, in: contentContainer)
    }

    private func syncReactSubview(_ subview: NSView?, in container: NSView) {
        guard let subview else {
            return
        }

        let targetFrame = container.bounds
        if subview.responds(to: Selector(("reactSetFrame:"))) {
            subview.reactSetFrame(targetFrame)
        } else {
            subview.frame = targetFrame
        }
        subview.autoresizingMask = [.width, .height]
    }

    deinit {
        if let resizeObserver {
            NotificationCenter.default.removeObserver(resizeObserver)
        }
    }
}
