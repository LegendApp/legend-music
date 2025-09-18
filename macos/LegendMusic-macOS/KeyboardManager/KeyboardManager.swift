import Foundation
import AppKit
import Carbon

private enum CustomKeyCode {
    static let mediaPlayPause = 10_001
    static let mediaNext = 10_002
    static let mediaPrevious = 10_003
}

// Class to manage keyboard shortcuts
@objc(KeyboardManager)
class KeyboardManager: NSObject {

    // Callback type for keyboard events
    typealias KeyboardEventCallback = (_ keyCode: Int, _ modifiers: Int) -> Bool

    // Singleton instance
    @objc static let shared = KeyboardManager()

    // Event monitor for local keyboard events
    private var localEventMonitor: Any?

    // Callbacks
    private var localKeyDownCallback: KeyboardEventCallback?
    private var localKeyUpCallback: KeyboardEventCallback?

    private override init() {
        super.init()

        // Register for app termination to clean up
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillTerminate),
            name: NSApplication.willTerminateNotification,
            object: nil
        )
    }

    deinit {
        stopMonitoring()
        NotificationCenter.default.removeObserver(self)
    }

    @objc func applicationWillTerminate() {
        stopMonitoring()
    }

    // MARK: - Local Keyboard Monitoring

    // Start monitoring local keyboard events (when app is in focus)
    @objc func startMonitoring(keyDownCallback: KeyboardEventCallback? = nil, keyUpCallback: KeyboardEventCallback? = nil) {
        // Store callbacks
        self.localKeyDownCallback = keyDownCallback
        self.localKeyUpCallback = keyUpCallback

        // Stop any existing monitors
        stopMonitoring()

        // Create a local event monitor for keyDown events
        let eventMask: NSEvent.EventTypeMask = [.keyDown, .keyUp, .systemDefined]

        localEventMonitor = NSEvent.addLocalMonitorForEvents(matching: eventMask) { [weak self] event in
            guard let self = self else { return event }

            switch event.type {
            case .systemDefined:
                return self.handleSystemDefinedEvent(event)
            case .keyDown, .keyUp:
                let keyCode = Int(event.keyCode)
                let modifiers = Int(event.modifierFlags.rawValue)

                if event.type == .keyDown {
                    if let handled = self.localKeyDownCallback?(keyCode, modifiers), handled {
                        return nil
                    }
                } else {
                    if let handled = self.localKeyUpCallback?(keyCode, modifiers), handled {
                        return nil
                    }
                }
                return event
            default:
                return event
            }
        }
    }

    private func handleSystemDefinedEvent(_ event: NSEvent) -> NSEvent? {
        guard event.subtype.rawValue == NX_SUBTYPE_AUX_CONTROL_BUTTONS else {
            return event
        }

        let data = event.data1
        let keyCode = Int((data & 0xFFFF_0000) >> 16)
        let keyFlags = (data & 0x0000_FFFF)
        let keyState = (keyFlags & 0xFF00) >> 8

        guard let mappedKeyCode = mapMediaKeyCode(keyCode) else {
            return event
        }

        if keyState == NX_KEYDOWN {
            if let handled = localKeyDownCallback?(mappedKeyCode, 0), handled {
                return nil
            }
        } else if keyState == NX_KEYUP {
            if let handled = localKeyUpCallback?(mappedKeyCode, 0), handled {
                return nil
            }
        }

        return event
    }

    private func mapMediaKeyCode(_ keyCode: Int) -> Int? {
        switch keyCode {
        case Int(NX_KEYTYPE_PLAY):
            return CustomKeyCode.mediaPlayPause
        case Int(NX_KEYTYPE_FAST), 17: // NX_KEYTYPE_FAST or NX_KEYTYPE_NEXT
            return CustomKeyCode.mediaNext
        case Int(NX_KEYTYPE_REWIND), 18: // NX_KEYTYPE_REWIND or NX_KEYTYPE_PREVIOUS
            return CustomKeyCode.mediaPrevious
        default:
            return nil
        }
    }

    // Stop monitoring local keyboard events
    @objc func stopMonitoring() {
        if let monitor = localEventMonitor {
            NSEvent.removeMonitor(monitor)
            localEventMonitor = nil
        }
    }
}
