import Foundation
import AppKit
import React

@objc(WindowControls)
class WindowControls: RCTEventEmitter {
    private var hasListeners = false
    private weak var mainWindow: NSWindow?

    override init() {
        super.init()
    }

    @objc override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    @objc override func supportedEvents() -> [String]? {
        return ["fullscreenChange"]
    }

    @objc override func startObserving() {
        hasListeners = true
        refreshMainWindowReference()
        // Check and emit initial fullscreen status
        checkAndEmitFullscreenStatus()

        // Set up notifications for fullscreen changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowDidResize),
            name: NSWindow.didResizeNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowDidEnterFullScreen),
            name: NSWindow.didEnterFullScreenNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(windowWillExitFullScreen),
            name: NSWindow.willExitFullScreenNotification,
            object: nil
        )
    }

    @objc override func stopObserving() {
        hasListeners = false
        NotificationCenter.default.removeObserver(self)
    }

    @objc func windowDidResize(_ notification: Notification) {
        guard isNotificationForMainWindow(notification) else { return }
        checkAndEmitFullscreenStatus()
    }

    @objc func windowDidEnterFullScreen(_ notification: Notification) {
        guard hasListeners, isNotificationForMainWindow(notification) else { return }
        // Directly emit true for fullscreen since we know it entered fullscreen
        sendEvent(withName: "fullscreenChange", body: ["isFullscreen": true])
    }

    @objc func windowWillExitFullScreen(_ notification: Notification) {
        guard hasListeners, isNotificationForMainWindow(notification) else { return }
        // Directly emit false for fullscreen since we know it exited fullscreen
        sendEvent(withName: "fullscreenChange", body: ["isFullscreen": false])
    }

    func checkAndEmitFullscreenStatus() {
        if !hasListeners {
            return
        }

        DispatchQueue.main.async {
            if let window = self.getMainWindow() {
                let isFullScreen = window.styleMask.contains(.fullScreen)
                self.sendEvent(withName: "fullscreenChange", body: ["isFullscreen": isFullScreen])
            }
        }
    }

    @objc func hideWindowControls() {
        DispatchQueue.main.async {
            guard let window = self.getMainWindow() else { return }
            // Hide the close button
            window.standardWindowButton(.closeButton)?.isHidden = true
            // Hide the minimize button
            window.standardWindowButton(.miniaturizeButton)?.isHidden = true
            // Hide the zoom button
            window.standardWindowButton(.zoomButton)?.isHidden = true
        }
    }

    @objc func showWindowControls() {
        DispatchQueue.main.async {
            guard let window = self.getMainWindow() else { return }
            // Show the close button
            window.standardWindowButton(.closeButton)?.isHidden = false
            // Show the minimize button
            window.standardWindowButton(.miniaturizeButton)?.isHidden = false
            // Show the zoom button
            window.standardWindowButton(.zoomButton)?.isHidden = false
        }
    }

    @objc func isWindowFullScreen(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if let window = self.getMainWindow() {
                let isFullScreen = window.styleMask.contains(.fullScreen)
                resolve(isFullScreen)
            } else {
                resolve(false)
            }
        }
    }

    private func refreshMainWindowReference() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.refreshMainWindowReference()
            }
            return
        }

        if let candidate = NSApplication.shared.windows.first(where: windowMatchesMainWindowHeuristics) {
            mainWindow = candidate
            return
        }

        if let mainWindowCandidate = NSApplication.shared.mainWindow,
           windowMatchesMainWindowHeuristics(mainWindowCandidate) {
            mainWindow = mainWindowCandidate
            return
        }

        if let keyWindowCandidate = NSApplication.shared.keyWindow,
           windowMatchesMainWindowHeuristics(keyWindowCandidate) {
            mainWindow = keyWindowCandidate
        }
    }

    private func getMainWindow() -> NSWindow? {
        if let cached = mainWindow {
            return cached
        }
        refreshMainWindowReference()
        return mainWindow
    }

    private func isNotificationForMainWindow(_ notification: Notification) -> Bool {
        guard let window = notification.object as? NSWindow else {
            return false
        }
        if let main = getMainWindow() {
            return window == main
        }

        if windowMatchesMainWindowHeuristics(window) {
            mainWindow = window
            return true
        }
        return false
    }

    private func windowMatchesMainWindowHeuristics(_ window: NSWindow) -> Bool {
        guard !window.isSheet, !(window is NSPanel) else { return false }
        if window.frameAutosaveName == "MainWindow" {
            return true
        }
        return window.title == "LegendMusic"
    }
}
