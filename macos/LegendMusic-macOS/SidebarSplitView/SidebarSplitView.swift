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

final class SidebarSplitView: NSView, NSSplitViewDelegate {
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
        splitViewController.splitView.delegate = self

        splitViewController.view.frame = bounds
        splitViewController.view.autoresizingMask = [.width, .height]
        addSubview(splitViewController.view)

        sidebarContainer.autoresizingMask = [.width, .height]
        contentContainer.autoresizingMask = [.width, .height]
    }

    override func layout() {
        super.layout()
        splitViewController.view.frame = bounds
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
        let targetView = atIndex == 0 ? sidebarContainer : contentContainer
        targetView.addSubview(subview)
        subview.frame = targetView.bounds
        subview.autoresizingMask = [.width, .height]
    }

    override func removeReactSubview(_ subview: NSView!) {
        subview.removeFromSuperview()
    }

    func splitViewDidResizeSubviews(_ notification: Notification) {
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
}
