import AppKit
import React

@objc(RNSidebar)
class RNSidebar: RCTViewManager {
    override func view() -> NSView! {
        return SidebarView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

private struct SidebarItem {
    let id: String
    let label: String
}

final class SidebarView: NSView, NSTableViewDataSource, NSTableViewDelegate {
    @objc var items: [NSDictionary] = [] {
        didSet {
            reloadItems()
        }
    }

    @objc var selectedId: NSString? {
        didSet {
            updateSelection()
        }
    }

    @objc var onSelectionChange: RCTBubblingEventBlock?

    private let scrollView = NSScrollView()
    private let tableView = NSTableView()
    private let tableColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("SidebarColumn"))
    private var itemModels: [SidebarItem] = []
    private var isUpdatingSelection = false

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

    override func layout() {
        super.layout()
        scrollView.frame = bounds
        tableView.frame = scrollView.bounds
    }

    private func reloadItems() {
        itemModels = items.compactMap { item in
            guard let id = item["id"] as? String else {
                return nil
            }

            let label = item["label"] as? String ?? ""
            return SidebarItem(id: id, label: label)
        }

        tableView.reloadData()
        updateSelection()
    }

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

    func numberOfRows(in tableView: NSTableView) -> Int {
        return itemModels.count
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let item = itemModels[row]
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

        cellView.textField?.stringValue = item.label
        return cellView
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
        onSelectionChange?(["id": selectedItem.id])
    }
}
