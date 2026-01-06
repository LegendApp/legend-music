import AppKit
import Carbon
import Foundation
import React

@objc(GlobalHotkey)
class GlobalHotkey: RCTEventEmitter {
    private var hasListeners = false
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private let hotKeyId: UInt32 = 1
    private let hotKeySignature: OSType = OSType(0x4C4D484B) // "LMHK"

    override init() {
        super.init()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillTerminate),
            name: NSApplication.willTerminateNotification,
            object: nil
        )
    }

    deinit {
        unregisterHotkeyInternal()
        removeEventHandler()
        NotificationCenter.default.removeObserver(self)
    }

    @objc override func supportedEvents() -> [String] {
        return ["onHotkeyPressed"]
    }

    @objc override func startObserving() {
        hasListeners = true
    }

    @objc override func stopObserving() {
        hasListeners = false
    }

    @objc override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    @objc func registerHotkey(
        _ keyCode: NSNumber,
        modifiers: NSNumber,
        resolver resolve: RCTPromiseResolveBlock,
        rejecter reject: RCTPromiseRejectBlock
    ) {
        let keyCodeValue = keyCode.intValue
        if keyCodeValue < 0 || keyCodeValue > 255 {
            resolve(["success": false, "message": "Unsupported key code."])
            return
        }

        unregisterHotkeyInternal()

        guard installEventHandlerIfNeeded() else {
            resolve(["success": false, "message": "Failed to install hotkey handler."])
            return
        }

        let carbonModifiers = convertModifiers(modifiers.uint32Value)
        var hotKeyID = EventHotKeyID(signature: hotKeySignature, id: hotKeyId)
        let status = RegisterEventHotKey(
            UInt32(keyCodeValue),
            carbonModifiers,
            hotKeyID,
            GetEventDispatcherTarget(),
            0,
            &hotKeyRef
        )

        if status != noErr {
            hotKeyRef = nil
            resolve(["success": false, "message": "Failed to register hotkey."])
            return
        }

        resolve(["success": true])
    }

    @objc func unregisterHotkey(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        unregisterHotkeyInternal()
        resolve(["success": true])
    }

    @objc private func applicationWillTerminate() {
        unregisterHotkeyInternal()
    }

    private func unregisterHotkeyInternal() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
    }

    private func installEventHandlerIfNeeded() -> Bool {
        if eventHandler != nil {
            return true
        }

        var eventSpec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))

        let status = InstallEventHandler(
            GetEventDispatcherTarget(),
            { _, eventRef, userData -> OSStatus in
                guard let userData else {
                    return noErr
                }
                let instance = Unmanaged<GlobalHotkey>.fromOpaque(userData).takeUnretainedValue()
                instance.handleHotkeyEvent(eventRef)
                return noErr
            },
            1,
            &eventSpec,
            UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
            &eventHandler
        )

        return status == noErr
    }

    private func removeEventHandler() {
        if let eventHandler {
            RemoveEventHandler(eventHandler)
            self.eventHandler = nil
        }
    }

    private func handleHotkeyEvent(_ eventRef: EventRef?) {
        guard hasListeners, let eventRef else {
            return
        }

        var hotKeyID = EventHotKeyID()
        let status = GetEventParameter(
            eventRef,
            EventParamName(kEventParamDirectObject),
            EventParamType(typeEventHotKeyID),
            nil,
            MemoryLayout<EventHotKeyID>.size,
            nil,
            &hotKeyID
        )

        if status != noErr || hotKeyID.id != hotKeyId {
            return
        }

        sendEvent(withName: "onHotkeyPressed", body: ["id": hotKeyID.id])
    }

    private func convertModifiers(_ modifiers: UInt32) -> UInt32 {
        var carbonModifiers: UInt32 = 0

        if modifiers & UInt32(NSEvent.ModifierFlags.command.rawValue) != 0 {
            carbonModifiers |= UInt32(cmdKey)
        }
        if modifiers & UInt32(NSEvent.ModifierFlags.shift.rawValue) != 0 {
            carbonModifiers |= UInt32(shiftKey)
        }
        if modifiers & UInt32(NSEvent.ModifierFlags.option.rawValue) != 0 {
            carbonModifiers |= UInt32(optionKey)
        }
        if modifiers & UInt32(NSEvent.ModifierFlags.control.rawValue) != 0 {
            carbonModifiers |= UInt32(controlKey)
        }

        return carbonModifiers
    }
}
