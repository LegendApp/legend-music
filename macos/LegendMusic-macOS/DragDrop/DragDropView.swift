import Foundation
import AppKit
import React

@objcMembers
class LMSupportedAudioFormats: NSObject {
    static let supportedExtensions: [String] = ["mp3", "wav", "m4a", "aac", "flac"]
    // Additional formats AVFoundation can decode; not enabled for import yet.
    static let avFoundationAdditionalExtensions: [String] = ["aif", "aiff", "aifc", "caf"]

    static func isSupportedExtension(_ extensionString: String?) -> Bool {
        guard let extensionString, !extensionString.isEmpty else {
            return false
        }

        return supportedExtensions.contains(extensionString.lowercased())
    }

    static func isSupportedFileURL(_ url: URL?) -> Bool {
        guard let url else {
            return false
        }

        return isSupportedExtension(url.pathExtension)
    }
}

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
    @objc var allowedFileTypes: [String] = LMSupportedAudioFormats.supportedExtensions

    private enum DragContentType {
        case files
        case tracks
    }

    private var isDragOver = false
    private var currentDragType: DragContentType?

    override var isFlipped: Bool {
        return true
    }

    private func extractFilesAndDirectories(from urls: [URL]) -> (files: [URL], directories: [URL]) {
        var audioFiles: [URL] = []
        var directoryUrls: [URL] = []
        let permittedExtensions = allowedFileTypes.isEmpty ? LMSupportedAudioFormats.supportedExtensions : allowedFileTypes

        for url in urls {
            if let values = try? url.resourceValues(forKeys: [.isDirectoryKey]), values.isDirectory == true {
                directoryUrls.append(url)
                continue
            }

            let fileExtension = url.pathExtension.lowercased()
            if permittedExtensions.contains(fileExtension) {
                audioFiles.append(url)
            }
        }

        return (audioFiles, directoryUrls)
    }

    private func clampedLocation(from sender: NSDraggingInfo) -> CGPoint {
        let locationInView = convert(sender.draggingLocation, from: nil)
        let clampedX = max(0, min(locationInView.x, bounds.width))
        let clampedY = max(0, min(locationInView.y, bounds.height))
        return CGPoint(x: clampedX, y: clampedY)
    }

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
            onTrackDragEnter?([
                "tracks": tracks,
            ])
            return .copy
        }

        // Check if we have file URLs
        guard let fileURLs = pasteboard.readObjects(forClasses: [NSURL.self], options: nil) as? [URL] else {
            return []
        }

        let (audioFiles, directoryUrls) = extractFilesAndDirectories(from: fileURLs)

        // Only allow drop if we have valid audio files or directories
        if audioFiles.isEmpty && directoryUrls.isEmpty {
            return []
        }

        isDragOver = true
        currentDragType = .files

        // Send drag enter event
        onDragEnter?([
            "files": audioFiles.map { $0.path },
            "directories": directoryUrls.map { $0.path },
        ])

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
            let location = clampedLocation(from: sender)
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

            let location = clampedLocation(from: sender)

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

        let (audioFiles, directoryUrls) = extractFilesAndDirectories(from: fileURLs)

        if audioFiles.isEmpty && directoryUrls.isEmpty {
            return false
        }

        isDragOver = false

        // Convert URLs to file paths
        let filePaths = audioFiles.map { $0.path }
        let directoryPaths = directoryUrls.map { $0.path }

        // Send drop event with file paths
        onDrop?([
            "files": filePaths,
            "directories": directoryPaths,
        ])

        currentDragType = nil
        return true
    }

    override func concludeDragOperation(_ sender: NSDraggingInfo?) {
        isDragOver = false
        currentDragType = nil
    }
}
