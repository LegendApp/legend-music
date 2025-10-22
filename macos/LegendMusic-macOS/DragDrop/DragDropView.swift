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
    @objc var onTrackDragEnter: RCTDirectEventBlock?
    @objc var onTrackDragLeave: RCTDirectEventBlock?
    @objc var onTrackDragHover: RCTDirectEventBlock?
    @objc var onTrackDrop: RCTDirectEventBlock?
    @objc var allowedFileTypes: [String] = ["mp3", "wav", "m4a", "aac", "flac"]

    private enum DragContentType {
        case files
        case tracks
    }

    private var isDragOver = false
    private var currentDragType: DragContentType?

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
        registerForDraggedTypes([.fileURL, trackPasteboardType])
    }

    // MARK: - Drag and Drop Implementation

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        let pasteboard = sender.draggingPasteboard

        if pasteboard.availableType(from: [trackPasteboardType]) != nil,
           let trackData = pasteboard.data(forType: trackPasteboardType),
           let tracks = try? JSONSerialization.jsonObject(with: trackData, options: []) as? [[String: Any]],
           !tracks.isEmpty {
            currentDragType = .tracks
            isDragOver = true
            onTrackDragEnter?([:])
            return .copy
        }

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
        currentDragType = .files

        // Send drag enter event
        onDragEnter?([:])

        return .copy
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        if currentDragType == .tracks {
            onTrackDragLeave?([:])
        } else {
            onDragLeave?([:])
        }
        isDragOver = false
        currentDragType = nil
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        if currentDragType == .tracks, let onTrackDragHover = onTrackDragHover {
            let location = convert(sender.draggingLocation, from: nil)
            onTrackDragHover([
                "location": [
                    "x": location.x,
                    "y": location.y,
                ],
            ])
        }
        return isDragOver ? .copy : []
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let pasteboard = sender.draggingPasteboard

        if currentDragType == .tracks {
            defer {
                currentDragType = nil
                isDragOver = false
            }

            guard let trackData = pasteboard.data(forType: trackPasteboardType),
                  let tracks = try? JSONSerialization.jsonObject(with: trackData, options: []) as? [[String: Any]],
                  !tracks.isEmpty
            else {
                return false
            }

            let location = convert(sender.draggingLocation, from: nil)

            onTrackDrop?([
                "tracks": tracks,
                "location": [
                    "x": location.x,
                    "y": location.y,
                ],
            ])

            return true
        }

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

        currentDragType = nil
        return true
    }

    override func concludeDragOperation(_ sender: NSDraggingInfo?) {
        isDragOver = false
        currentDragType = nil
    }
}
