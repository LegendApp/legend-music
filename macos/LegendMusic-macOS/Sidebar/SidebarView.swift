import AppKit
import React

@objc(LMSidebar)
class LMSidebar: RCTViewManager {
    override func view() -> NSView! {
        return SidebarView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

@objc(LMSidebarItem)
class LMSidebarItem: RCTViewManager {
    override func view() -> NSView! {
        return SidebarItemView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

/// A wrapper view for sidebar item content that stores the item ID
final class SidebarItemView: NSView {
    @objc var itemId: NSString = ""
    @objc var selectable: Bool = true
    /// Row height for this item. 0 means auto-detect from content, positive value is explicit height.
    @objc var rowHeight: CGFloat = 0
    @objc var onRightClick: RCTBubblingEventBlock?

    override var isFlipped: Bool {
        return true
    }

    override func rightMouseDown(with event: NSEvent) {
        selectContainingRow()
        super.rightMouseDown(with: event)
    }

    override func rightMouseUp(with event: NSEvent) {
        let locationInWindow = event.locationInWindow
        let locationInView = convert(locationInWindow, from: nil)
        let contentViewHeight = window?.contentView?.bounds.height ?? 0
        let pageY = contentViewHeight > 0 ? contentViewHeight - locationInWindow.y : locationInWindow.y

        onRightClick?([
            "x": locationInView.x,
            "y": locationInView.y,
            "pageX": locationInWindow.x,
            "pageY": pageY,
            "button": 2,
            "ctrlKey": event.modifierFlags.contains(.control),
            "shiftKey": event.modifierFlags.contains(.shift),
            "altKey": event.modifierFlags.contains(.option),
            "metaKey": event.modifierFlags.contains(.command),
        ])

        super.rightMouseUp(with: event)
    }

    private func selectContainingRow() {
        guard selectable else {
            return
        }

        guard let tableView = enclosingTableView() else {
            return
        }

        let row = tableView.row(for: self)
        guard row >= 0 else {
            return
        }

        tableView.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
    }

    private func enclosingTableView() -> NSTableView? {
        var view: NSView? = self
        while let current = view {
            if let tableView = current as? NSTableView {
                return tableView
            }
            view = current.superview
        }
        return nil
    }

    override func layout() {
        super.layout()
        // Size subviews to fill this view
        for subview in subviews {
            subview.frame = bounds
        }
    }
}

private struct SidebarItemModel {
    let id: String
    let view: SidebarItemView
    let selectable: Bool
}

/// Custom NSTableView that allows mouse events to pass through to RN content
final class SidebarTableView: NSTableView {
    override func validateProposedFirstResponder(_ responder: NSResponder, for event: NSEvent?) -> Bool {
        // Allow all responders to become first responder, enabling buttons in RN content to receive clicks
        return true
    }

    override func rightMouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        super.rightMouseDown(with: event)
    }
}

final class SidebarView: NSView, NSTableViewDataSource, NSTableViewDelegate {
    // Legacy items prop (for backwards compatibility)
    @objc var items: [NSDictionary] = [] {
        didSet {
            if !usesReactChildren {
                reloadLegacyItems()
            }
        }
    }

    @objc var selectedId: NSString? {
        didSet {
            updateSelection()
        }
    }

    @objc var contentInsetTop: NSNumber = 52 {
        didSet {
            updateContentInsets()
        }
    }

    @objc var onSidebarSelectionChange: RCTBubblingEventBlock?
    @objc var onSidebarLayout: RCTBubblingEventBlock?

    private let scrollView = NSScrollView()
    private var lastReportedSize: CGSize = .zero
    private let tableView = SidebarTableView()
    private let tableColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("SidebarColumn"))
    private var itemModels: [SidebarItemModel] = []
    private var legacyItemLabels: [String: String] = [:] // id -> label for legacy mode
    private var isUpdatingSelection = false
    private var usesReactChildren = false

    override var isFlipped: Bool {
        return true
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        scrollView.autoresizingMask = [.width, .height]
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.borderType = .noBorder
        updateContentInsets()

        tableView.headerView = nil
        tableView.allowsMultipleSelection = false
        tableView.allowsEmptySelection = true
        tableView.backgroundColor = .clear
        tableView.rowHeight = 28.0
        tableView.intercellSpacing = NSSize(width: 0, height: 0)
        tableView.selectionHighlightStyle = .sourceList
        tableView.focusRingType = .none
        tableView.usesAlternatingRowBackgroundColors = false
        tableView.gridStyleMask = []
        tableView.delegate = self
        tableView.dataSource = self
        tableView.columnAutoresizingStyle = .uniformColumnAutoresizingStyle

        if #available(macOS 11.0, *) {
            tableView.style = .sourceList
        }

        tableColumn.resizingMask = .autoresizingMask
        tableColumn.width = 200
        tableView.addTableColumn(tableColumn)

        tableView.autoresizingMask = [.width, .height]
        scrollView.documentView = tableView

        addSubview(scrollView)
    }

    private func updateContentInsets() {
        let topInset = CGFloat(truncating: contentInsetTop)
        scrollView.contentInsets = NSEdgeInsets(top: topInset, left: 0, bottom: 0, right: 0)
    }

    override func layout() {
        super.layout()
        scrollView.frame = bounds
        reportLayoutIfNeeded()
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()

        guard let window, window.isKeyWindow else {
            return
        }

        window.makeFirstResponder(tableView)
    }

    private func reportLayoutIfNeeded() {
        guard bounds.width > 0, bounds.height > 0 else { return }
        guard bounds.size != lastReportedSize else { return }

        lastReportedSize = bounds.size
        onSidebarLayout?([
            "width": bounds.width,
            "height": bounds.height
        ])
    }

    // MARK: - React Native Subview Management

    override func insertReactSubview(_ subview: NSView!, at index: Int) {
        super.insertReactSubview(subview, at: index)

        guard let itemView = subview as? SidebarItemView else {
            return
        }

        usesReactChildren = true

        let model = SidebarItemModel(
            id: itemView.itemId as String,
            view: itemView,
            selectable: itemView.selectable
        )

        let safeIndex = min(index, itemModels.count)
        itemModels.insert(model, at: safeIndex)
    }

    override func removeReactSubview(_ subview: NSView!) {
        guard let itemView = subview as? SidebarItemView else {
            super.removeReactSubview(subview)
            return
        }

        if let index = itemModels.firstIndex(where: { $0.view === itemView }) {
            let removed = itemModels[index]
            itemModels.remove(at: index)
        }

        super.removeReactSubview(subview)
    }

    override func didUpdateReactSubviews() {
        // React has finished updating subviews
        tableView.reloadData()
        updateSelection()
    }

    // MARK: - Legacy Items Support

    private func reloadLegacyItems() {
        legacyItemLabels.removeAll()
        itemModels = items.compactMap { item in
            guard let id = item["id"] as? String else {
                return nil
            }
            let label = item["label"] as? String ?? ""
            legacyItemLabels[id] = label

            // Create a simple view for legacy items
            let itemView = SidebarItemView()
            itemView.itemId = id as NSString
            itemView.selectable = true
            return SidebarItemModel(id: id, view: itemView, selectable: true)
        }

        tableView.reloadData()
        updateSelection()
    }

    // MARK: - Selection

    private func updateSelection() {
        guard !itemModels.isEmpty else {
            return
        }

        let selectedIdValue = selectedId as String?
        guard let id = selectedIdValue, let index = itemModels.firstIndex(where: { $0.id == id }) else {
            isUpdatingSelection = true
            tableView.deselectAll(nil)
            isUpdatingSelection = false
            return
        }

        isUpdatingSelection = true
        tableView.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
        tableView.scrollRowToVisible(index)
        isUpdatingSelection = false
    }

    // MARK: - NSTableViewDataSource

    func numberOfRows(in tableView: NSTableView) -> Int {
        return itemModels.count
    }

    // MARK: - NSTableViewDelegate

    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        guard row < itemModels.count else {
            return 28.0
        }

        let model = itemModels[row]
        let view = model.view

        // Use explicit rowHeight if set
        if view.rowHeight > 0 {
            return view.rowHeight
        }

        // Get intrinsic height from the RN view
        let intrinsicSize = view.intrinsicContentSize
        if intrinsicSize.height > 0 && intrinsicSize.height != NSView.noIntrinsicMetric {
            return intrinsicSize.height
        }

        // Fallback: measure the view's frame
        if view.frame.height > 0 {
            return view.frame.height
        }

        return 28.0
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < itemModels.count else {
            return nil
        }

        let model = itemModels[row]

        // For React children mode, use the RN view directly
        if usesReactChildren {
            let cellView = NSTableCellView()
            cellView.identifier = NSUserInterfaceItemIdentifier("SidebarRNCell")

            let rnView = model.view
            rnView.translatesAutoresizingMaskIntoConstraints = false
            cellView.addSubview(rnView)

            NSLayoutConstraint.activate([
                rnView.leadingAnchor.constraint(equalTo: cellView.leadingAnchor),
                rnView.trailingAnchor.constraint(equalTo: cellView.trailingAnchor),
                rnView.topAnchor.constraint(equalTo: cellView.topAnchor),
                rnView.bottomAnchor.constraint(equalTo: cellView.bottomAnchor),
            ])

            return cellView
        }

        // Legacy mode: render text
        let identifier = NSUserInterfaceItemIdentifier("SidebarCell")
        let cellView = tableView.makeView(withIdentifier: identifier, owner: self) as? NSTableCellView ?? {
            let view = NSTableCellView()
            view.identifier = identifier

            let textField = NSTextField(labelWithString: "")
            textField.translatesAutoresizingMaskIntoConstraints = false
            textField.lineBreakMode = .byTruncatingTail
            textField.font = NSFont.systemFont(ofSize: 13)
            textField.textColor = NSColor.labelColor
            view.addSubview(textField)
            view.textField = textField

            NSLayoutConstraint.activate([
                textField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
                textField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
                textField.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            ])

            return view
        }()

        cellView.textField?.stringValue = legacyItemLabels[model.id] ?? ""
        return cellView
    }

    func tableView(_ tableView: NSTableView, shouldSelectRow row: Int) -> Bool {
        guard row < itemModels.count else {
            return false
        }
        return itemModels[row].selectable
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        guard !isUpdatingSelection else {
            return
        }

        let row = tableView.selectedRow
        guard row >= 0 && row < itemModels.count else {
            return
        }

        let selectedItem = itemModels[row]
        onSidebarSelectionChange?(["id": selectedItem.id])
    }
}
