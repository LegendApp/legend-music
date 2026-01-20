import Foundation
import React

@objc(AICommandRunner)
class AICommandRunner: NSObject {
    private let workQueue = DispatchQueue(label: "com.legendapp.ai-command-runner", qos: .userInitiated)

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc func getAvailability(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let claudePath = resolveExecutable("claude")
        let codexPath = resolveExecutable("codex")
        let preferred = claudePath != nil ? "claude" : (codexPath != nil ? "codex" : nil)
        let preferredValue: Any = preferred ?? NSNull()

        resolve([
            "claude": claudePath != nil,
            "codex": codexPath != nil,
            "preferredTool": preferredValue
        ])
    }

    @objc func runCommand(_ params: NSDictionary,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let command = params["command"] as? String, !command.isEmpty else {
            reject("missing_command", "Missing command to execute.", nil)
            return
        }

        let args = params["args"] as? [String] ?? []
        let input = params["input"] as? String
        let timeoutMs = params["timeoutMs"] as? NSNumber

        guard let resolvedPath = resolveCommandPath(command) else {
            reject("command_not_found", "Command not found: \(command)", nil)
            return
        }

        workQueue.async {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: resolvedPath)
            process.arguments = args

            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            var stdinPipe: Pipe?
            if input != nil {
                let pipe = Pipe()
                process.standardInput = pipe
                stdinPipe = pipe
            }

            do {
                try process.run()
            } catch {
                DispatchQueue.main.async {
                    reject("spawn_failed", error.localizedDescription, error)
                }
                return
            }

            if let input = input, let stdinPipe = stdinPipe {
                if let data = input.data(using: .utf8) {
                    stdinPipe.fileHandleForWriting.write(data)
                }
                stdinPipe.fileHandleForWriting.closeFile()
            }

            let timeoutSeconds = timeoutMs?.doubleValue ?? 0
            let hasTimeout = timeoutSeconds > 0
            let timeoutLock = NSLock()
            var didTimeout = false

            if hasTimeout {
                DispatchQueue.global().asyncAfter(deadline: .now() + timeoutSeconds / 1000.0) {
                    if process.isRunning {
                        timeoutLock.lock()
                        didTimeout = true
                        timeoutLock.unlock()
                        process.terminate()
                    }
                }
            }

            process.waitUntilExit()

            let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let stdout = String(data: stdoutData, encoding: .utf8) ?? ""
            let stderr = String(data: stderrData, encoding: .utf8) ?? ""

            var timeoutFlag = false
            if hasTimeout {
                timeoutLock.lock()
                timeoutFlag = didTimeout
                timeoutLock.unlock()
            }

            let payload: [String: Any] = [
                "stdout": stdout,
                "stderr": stderr,
                "exitCode": Int(process.terminationStatus),
                "timedOut": timeoutFlag
            ]

            DispatchQueue.main.async {
                resolve(payload)
            }
        }
    }

    private func resolveCommandPath(_ command: String) -> String? {
        if command.contains("/") {
            return FileManager.default.isExecutableFile(atPath: command) ? command : nil
        }

        return resolveExecutable(command)
    }

    private func resolveExecutable(_ name: String) -> String? {
        let fallbackPaths = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin"
        ]

        var searchPaths: [String] = []
        if let pathValue = ProcessInfo.processInfo.environment["PATH"] {
            searchPaths = pathValue.split(separator: ":").map { String($0) }
        }

        for fallback in fallbackPaths where !searchPaths.contains(fallback) {
            searchPaths.append(fallback)
        }

        for dir in searchPaths {
            let candidate = (dir as NSString).appendingPathComponent(name)
            if FileManager.default.isExecutableFile(atPath: candidate) {
                return candidate
            }
        }

        return nil
    }
}
