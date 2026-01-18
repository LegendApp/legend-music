import AudioToolbox
import CoreAudio
import Foundation
import MusicKit
import React

@objc(AppleMusic)
class AppleMusic: RCTEventEmitter {
    private var hasListeners = false
    private var playbackTimer: Timer?
    private var wasPlaying = false
    private var currentTrackId: String?
    private var currentArtworkUrl: String?
    private var currentDurationSeconds: Double?
    private var developerToken: String?
    private var userToken: String?
    @available(macOS 14.0, *)
    private var musicPlayer: ApplicationMusicPlayer? {
        return ApplicationMusicPlayer.shared
    }

    private func log(_ message: String) {
        NSLog("[AppleMusic] %@", message)
    }

    private func formatError(_ error: Error) -> (code: String, message: String) {
        let nsError = error as NSError
        let resolvedError = (nsError.userInfo[NSUnderlyingErrorKey] as? NSError) ?? nsError
        let errorCode = "\(resolvedError.domain)_\(resolvedError.code)"
        let message = buildErrorMessage(error: error, nsError: nsError)
        return (errorCode, message)
    }

    private func buildErrorMessage(error: Error, nsError: NSError) -> String {
        var parts: [String] = [nsError.localizedDescription]
        var detailParts: [String] = []

        if let failureReason = nsError.localizedFailureReason, !failureReason.isEmpty {
            detailParts.append(failureReason)
        }
        if let recoverySuggestion = nsError.localizedRecoverySuggestion, !recoverySuggestion.isEmpty {
            detailParts.append(recoverySuggestion)
        }
        if let debugDescription = nsError.userInfo[NSDebugDescriptionErrorKey] as? String,
           !debugDescription.isEmpty {
            detailParts.append(debugDescription)
        }

        if let underlying = nsError.userInfo[NSUnderlyingErrorKey] as? NSError {
            let summary = briefErrorSummary(underlying)
            if !summary.isEmpty {
                detailParts.append("Underlying: \(summary)")
            }
        }

        if detailParts.isEmpty {
            let reflection = String(reflecting: error)
            if !reflection.isEmpty, reflection != nsError.localizedDescription {
                detailParts.append(reflection)
            }
        }

        if !detailParts.isEmpty {
            parts.append(detailParts.joined(separator: " | "))
        }

        return parts.joined(separator: " | ")
    }

    private func briefErrorSummary(_ error: NSError) -> String {
        var parts: [String] = ["\(error.domain) \(error.code)"]
        let description = error.localizedDescription
        if !description.isEmpty {
            parts.append(description)
        }
        if let debugDescription = error.userInfo[NSDebugDescriptionErrorKey] as? String,
           !debugDescription.isEmpty,
           debugDescription != description {
            parts.append(debugDescription)
        }
        return parts.joined(separator: " ")
    }

    @objc override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    @objc override func supportedEvents() -> [String]? {
        return ["onPlaybackState", "onPlaybackError"]
    }

    @objc override func startObserving() {
        hasListeners = true
        startPlaybackPolling()
    }

    @objc override func stopObserving() {
        hasListeners = false
        stopPlaybackPolling()
    }

    @objc func getDeveloperToken(_ resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
            return
        }

        Task {
            do {
                let token = try await resolveDeveloperToken(provided: nil)
                DispatchQueue.main.async {
                    resolve(token)
                }
            } catch {
                DispatchQueue.main.async {
                    reject("developer_token_failed", error.localizedDescription, error)
                }
            }
        }
    }

    @objc func authorize(_ params: NSDictionary,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
            return
        }

        Task {
            do {
                let paramKeys = params.allKeys.compactMap { $0 as? String }.sorted()
                log("authorize start (params: \(paramKeys))")

                let status = await MusicAuthorization.request()
                log("authorization status: \(status.rawValue)")
                guard status == .authorized else {
                    throw NSError(domain: "AppleMusic", code: 1, userInfo: [NSLocalizedDescriptionKey: "Apple Music authorization denied"])
                }

                let providedDeveloperToken = params["developerToken"] as? String
                log("developer token provided: \(providedDeveloperToken != nil)")
                let developerToken = try await resolveDeveloperToken(provided: providedDeveloperToken)
                log("developer token resolved (length: \(developerToken.count))")
                let userToken = try await MusicUserTokenProvider().userToken(for: developerToken, options: [])
                log("user token resolved (length: \(userToken.count))")
                self.developerToken = developerToken
                self.userToken = userToken

                log("fetching storefront")
                let storefront = try await fetchStorefront(developerToken: developerToken, userToken: userToken)
                log("storefront fetched: \(storefront ?? "nil")")
                let subscription = await fetchSubscriptionLabel()
                log("subscription fetched: \(subscription ?? "nil")")
                let userPayload: [String: Any] = [
                    "name": "Apple Music",
                    "subscription": subscription ?? NSNull(),
                    "storefront": storefront ?? NSNull(),
                ]
                let payload: [String: Any] = [
                    "userToken": userToken,
                    "storefront": storefront ?? NSNull(),
                    "user": userPayload,
                ]
                DispatchQueue.main.async {
                    resolve(payload)
                }
            } catch {
                let nsError = error as NSError
                let formattedError = formatError(error)
                log("authorize failed: \(formattedError.code) \(formattedError.message)")
                DispatchQueue.main.async {
                    reject(formattedError.code, formattedError.message, nsError)
                }
            }
        }
    }

    @objc func unauthorize(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        developerToken = nil
        userToken = nil
        currentTrackId = nil
        currentArtworkUrl = nil
        currentDurationSeconds = nil
        DispatchQueue.main.async {
            resolve(nil)
        }
    }

    @objc func configure(_ params: NSDictionary,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
            return
        }

        Task {
            do {
                let developerToken = try await resolveDeveloperToken(provided: params["developerToken"] as? String)
                self.developerToken = developerToken
                self.userToken = params["userToken"] as? String
                DispatchQueue.main.async {
                    resolve(["success": true])
                }
            } catch {
                DispatchQueue.main.async {
                    reject("configure_failed", error.localizedDescription, error)
                }
            }
        }
    }

    @objc func loadTrack(_ params: NSDictionary,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 14.0, *) else {
            reject("unsupported", "Apple Music playback requires macOS 14 or newer.", nil)
            return
        }
        guard let player = musicPlayer else {
            reject("unsupported", "Apple Music player is unavailable.", nil)
            return
        }
        guard let trackId = params["trackId"] as? String, !trackId.isEmpty else {
            reject("missing_track", "Missing Apple Music track id.", nil)
            return
        }

        Task {
            do {
                var request = MusicCatalogResourceRequest<Song>(matching: \SongFilter.id, equalTo: MusicItemID(trackId))
                request.limit = 1
                let response = try await request.response()
                guard let song = response.items.first else {
                    throw NSError(domain: "AppleMusic", code: 2, userInfo: [NSLocalizedDescriptionKey: "Track not found"])
                }

                currentTrackId = trackId
                currentDurationSeconds = song.duration
                if let artwork = song.artwork {
                    let url = artwork.url(width: 400, height: 400)
                    currentArtworkUrl = url?.absoluteString
                } else {
                    currentArtworkUrl = nil
                }
                wasPlaying = false

                player.queue = ApplicationMusicPlayer.Queue(for: [song])

                if let startPosition = params["startPositionSeconds"] as? NSNumber {
                    player.playbackTime = startPosition.doubleValue
                }

                try await player.play()
                DispatchQueue.main.async {
                    resolve(["success": true])
                }
            } catch {
                DispatchQueue.main.async {
                    reject("load_failed", error.localizedDescription, error)
                }
                emitError(error.localizedDescription)
            }
        }
    }

    @objc func play(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 14.0, *) else {
            reject("unsupported", "Apple Music playback requires macOS 14 or newer.", nil)
            return
        }
        guard let player = musicPlayer else {
            reject("unsupported", "Apple Music player is unavailable.", nil)
            return
        }
        Task {
            do {
                try await player.play()
                DispatchQueue.main.async {
                    resolve(["success": true])
                }
            } catch {
                DispatchQueue.main.async {
                    reject("play_failed", error.localizedDescription, error)
                }
                emitError(error.localizedDescription)
            }
        }
    }

    @objc func pause(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 14.0, *) else {
            reject("unsupported", "Apple Music playback requires macOS 14 or newer.", nil)
            return
        }
        guard let player = musicPlayer else {
            reject("unsupported", "Apple Music player is unavailable.", nil)
            return
        }
        player.pause()
        DispatchQueue.main.async {
            resolve(["success": true])
        }
    }

    @objc func seek(_ positionSeconds: NSNumber,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 14.0, *) else {
            reject("unsupported", "Apple Music playback requires macOS 14 or newer.", nil)
            return
        }
        guard let player = musicPlayer else {
            reject("unsupported", "Apple Music player is unavailable.", nil)
            return
        }
        player.playbackTime = positionSeconds.doubleValue
        DispatchQueue.main.async {
            resolve(["success": true])
        }
    }

    @objc func setVolume(_ volume: NSNumber,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 14.0, *) else {
            reject("unsupported", "Apple Music playback requires macOS 14 or newer.", nil)
            return
        }
        let rawValue = volume.doubleValue
        let clampedValue = Float32(max(0.0, min(1.0, rawValue.isFinite ? rawValue : 0.0)))
        if setSystemVolume(clampedValue) {
            DispatchQueue.main.async {
                resolve(["success": true])
            }
            return
        }
        reject("unsupported", "Apple Music volume control is unavailable on this output device.", nil)
    }

    @objc func getPlaybackState(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 14.0, *) else {
            reject("unsupported", "Apple Music playback requires macOS 14 or newer.", nil)
            return
        }
        DispatchQueue.main.async {
            resolve(self.buildPlaybackState())
        }
    }

    private func startPlaybackPolling() {
        guard playbackTimer == nil else { return }
        playbackTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.emitPlaybackState()
        }
        if let timer = playbackTimer {
            RunLoop.main.add(timer, forMode: .common)
        }
    }

    private func stopPlaybackPolling() {
        playbackTimer?.invalidate()
        playbackTimer = nil
    }

    private func emitPlaybackState() {
        guard hasListeners else { return }
        let payload = buildPlaybackState()
        DispatchQueue.main.async {
            self.sendEvent(withName: "onPlaybackState", body: payload)
        }
    }

    private func buildPlaybackState() -> [String: Any] {
        guard #available(macOS 14.0, *) else {
            return ["error": "unsupported"]
        }
        guard let player = musicPlayer else {
            return ["error": "unavailable"]
        }

        let status = player.state.playbackStatus
        let isPlaying = status == .playing
        let isLoading = !player.isPreparedToPlay && currentTrackId != nil
        let positionSeconds = player.playbackTime
        let durationSeconds = currentDurationSeconds ?? 0

        var didComplete = false
        if wasPlaying, status == .stopped {
            if durationSeconds > 0 && positionSeconds >= durationSeconds - 1.0 {
                didComplete = true
            }
        }

        wasPlaying = isPlaying

        return [
            "trackId": currentTrackId ?? NSNull(),
            "isPlaying": isPlaying,
            "isLoading": isLoading,
            "positionSeconds": positionSeconds,
            "durationSeconds": durationSeconds,
            "artworkUrl": currentArtworkUrl ?? NSNull(),
            "didComplete": didComplete
        ]
    }

    private func emitError(_ message: String) {
        guard hasListeners else { return }
        DispatchQueue.main.async {
            self.sendEvent(withName: "onPlaybackError", body: ["error": message])
        }
    }

    private func setSystemVolume(_ volume: Float32) -> Bool {
        var deviceId = AudioDeviceID(0)
        var deviceAddress = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultOutputDevice,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var deviceSize = UInt32(MemoryLayout<AudioDeviceID>.size)
        let deviceStatus = AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject),
            &deviceAddress,
            0,
            nil,
            &deviceSize,
            &deviceId
        )
        guard deviceStatus == noErr, deviceId != 0 else {
            return false
        }

        func setVolume(selector: AudioObjectPropertySelector, element: AudioObjectPropertyElement) -> Bool {
            var address = AudioObjectPropertyAddress(
                mSelector: selector,
                mScope: kAudioDevicePropertyScopeOutput,
                mElement: element
            )
            guard AudioObjectHasProperty(deviceId, &address) else {
                return false
            }
            var isSettable: DarwinBoolean = false
            guard AudioObjectIsPropertySettable(deviceId, &address, &isSettable) == noErr, isSettable.boolValue else {
                return false
            }
            var value = volume
            let size = UInt32(MemoryLayout<Float32>.size)
            return AudioObjectSetPropertyData(deviceId, &address, 0, nil, size, &value) == noErr
        }

        if setVolume(selector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume, element: kAudioObjectPropertyElementMain) {
            return true
        }

        let leftChannel = setVolume(selector: kAudioDevicePropertyVolumeScalar, element: 1)
        let rightChannel = setVolume(selector: kAudioDevicePropertyVolumeScalar, element: 2)
        return leftChannel || rightChannel
    }

    @available(macOS 12.0, *)
    private func resolveDeveloperToken(provided: String?) async throws -> String {
        if let provided = provided?.trimmingCharacters(in: .whitespacesAndNewlines), !provided.isEmpty {
            developerToken = provided
            return provided
        }

        if let cached = developerToken, !cached.isEmpty {
            return cached
        }

        let tokenProvider = DefaultMusicTokenProvider()
        MusicDataRequest.tokenProvider = tokenProvider
        let token = try await tokenProvider.developerToken(options: [])
        developerToken = token
        return token
    }

    @available(macOS 12.0, *)
    private func fetchStorefront(developerToken: String, userToken: String) async throws -> String? {
        guard let url = URL(string: "https://api.music.apple.com/v1/me/storefront") else {
            return nil
        }

        var request = URLRequest(url: url)
        request.addValue("Bearer \(developerToken)", forHTTPHeaderField: "Authorization")
        request.addValue(userToken, forHTTPHeaderField: "Music-User-Token")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            return nil
        }

        let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        let dataArray = json?["data"] as? [[String: Any]]
        return dataArray?.first?["id"] as? String
    }

    @available(macOS 12.0, *)
    private func fetchSubscriptionLabel() async -> String? {
        do {
            let subscription = try await MusicSubscription.current
            if subscription.canPlayCatalogContent {
                return "Apple Music"
            }
            if subscription.canBecomeSubscriber {
                return "Not Subscribed"
            }
        } catch {
            return nil
        }
        return nil
    }
}
