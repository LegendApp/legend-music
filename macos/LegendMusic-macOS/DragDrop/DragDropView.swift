import Foundation
import AppKit
import React

@objc(RNDragDrop)
class RNDragDrop: RCTViewManager {
    override func view() -> NSView! {
        return DragDropView()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

class DragDropView: NSView {
    @objc var onDragEnter: RCTDirectEventBlock?
    @objc var onDragLeave: RCTDirectEventBlock?
    @objc var onDrop: RCTDirectEventBlock?
    @objc var allowedFileTypes: [String] = ["mp3", "wav", "m4a", "aac", "flac"]

    private var isDragOver = false

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupDragDrop()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupDragDrop()
    }

    private func setupDragDrop() {
        // Register for drag and drop
        registerForDraggedTypes([.fileURL])
    }

    // MARK: - Drag and Drop Implementation

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        let pasteboard = sender.draggingPasteboard

        // Check if we have file URLs
        guard let fileURLs = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL] else {
            return []
        }

        // Filter for allowed audio file types
        let audioFiles = fileURLs.filter { url in
            let fileExtension = url.pathExtension.lowercased()
            return allowedFileTypes.contains(fileExtension)
        }

        // Only allow drop if we have valid audio files
        if audioFiles.isEmpty {
            return []
        }

        isDragOver = true

        // Send drag enter event
        onDragEnter?([:])

        return .copy
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        isDragOver = false

        // Send drag leave event
        onDragLeave?([:])
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        return isDragOver ? .copy : []
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let pasteboard = sender.draggingPasteboard

        // Get file URLs
        guard let fileURLs = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL] else {
            return false
        }

        // Filter for allowed audio file types
        let audioFiles = fileURLs.filter { url in
            let fileExtension = url.pathExtension.lowercased()
            return allowedFileTypes.contains(fileExtension)
        }

        if audioFiles.isEmpty {
            return false
        }

        isDragOver = false

        // Convert URLs to file paths
        let filePaths = audioFiles.map { $0.path }

        // Send drop event with file paths
        onDrop?([
            "files": filePaths
        ])

        return true
    }

    override func concludeDragOperation(_ sender: NSDraggingInfo?) {
        isDragOver = false
    }
}