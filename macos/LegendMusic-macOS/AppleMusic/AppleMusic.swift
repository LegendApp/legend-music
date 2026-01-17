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
    private var musicPlayer: ApplicationMusicPlayer? {
        if #available(macOS 12.0, *) {
            return ApplicationMusicPlayer.shared
        }
        return nil
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

    @objc func authorize(_ params: NSDictionary,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
            return
        }
        guard let developerToken = params["developerToken"] as? String, !developerToken.isEmpty else {
            reject("missing_token", "Missing Apple Music developer token.", nil)
            return
        }

        Task {
            do {
                let status = await MusicAuthorization.request()
                guard status == .authorized else {
                    throw NSError(domain: "AppleMusic", code: 1, userInfo: [NSLocalizedDescriptionKey: "Apple Music authorization denied"])
                }

                let userToken = try await MusicUserTokenProvider.shared.userToken(forDeveloperToken: developerToken)
                self.developerToken = developerToken
                self.userToken = userToken

                let storefront = try await fetchStorefront(developerToken: developerToken, userToken: userToken)
                let subscription = await fetchSubscriptionLabel()
                let payload: [String: Any] = [
                    "userToken": userToken,
                    "storefront": storefront ?? NSNull(),
                    "user": [
                        "name": "Apple Music",
                        "subscription": subscription ?? NSNull(),
                        "storefront": storefront ?? NSNull(),
                    ]
                ]
                DispatchQueue.main.async {
                    resolve(payload)
                }
            } catch {
                DispatchQueue.main.async {
                    reject("authorize_failed", error.localizedDescription, error)
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
        guard let developerToken = params["developerToken"] as? String, !developerToken.isEmpty else {
            reject("missing_token", "Missing Apple Music developer token.", nil)
            return
        }

        self.developerToken = developerToken
        self.userToken = params["userToken"] as? String
        DispatchQueue.main.async {
            resolve(["success": true])
        }
    }

    @objc func loadTrack(_ params: NSDictionary,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
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
                let request = MusicCatalogResourceRequest<Song>(matching: \Song.id, equalTo: MusicItemID(trackId))
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
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
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
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
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
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
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
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
            return
        }
        guard let player = musicPlayer else {
            reject("unsupported", "Apple Music player is unavailable.", nil)
            return
        }
        player.volume = Float(max(0.0, min(1.0, volume.doubleValue)))
        DispatchQueue.main.async {
            resolve(["success": true])
        }
    }

    @objc func getPlaybackState(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(macOS 12.0, *) else {
            reject("unsupported", "Apple Music requires macOS 12 or newer.", nil)
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
        guard #available(macOS 12.0, *) else {
            return ["error": "unsupported"]
        }
        guard let player = musicPlayer else {
            return ["error": "unavailable"]
        }

        let status = player.state.playbackStatus
        let isPlaying = status == .playing
        let isLoading = status == .waiting
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
