#import "AudioPlayer.h"
#import <React/RCTLog.h>
#import <AppKit/AppKit.h>
#import <math.h>

@implementation AudioPlayer

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[
        @"onLoadSuccess",
        @"onLoadError",
        @"onPlaybackStateChanged",
        @"onProgress",
        @"onCompletion",
        @"onRemoteCommand"
    ];
}

- (instancetype)init
{
    self = [super init];
    if (self) {
        [self setupPlayer];
        _isPlaying = NO;
        _duration = 0;
        _currentTime = 0;
        _nowPlayingInfo = [NSMutableDictionary dictionary];
        [self setupRemoteCommands];
    }
    return self;
}

- (void)setupPlayer
{
    self.player = [[AVPlayer alloc] init];

    // Configure player for spatial audio - macOS handles this automatically
    if (@available(macOS 12.0, *)) {
        // Enable spatial audio processing
        self.player.audiovisualBackgroundPlaybackPolicy = AVPlayerAudiovisualBackgroundPlaybackPolicyAutomatic;
    }

    // Set up player observers
    [self setupPlayerObservers];

    RCTLogInfo(@"Audio player configured - spatial audio handled automatically by macOS");
}

- (void)setupPlayerObservers
{
    // Add observer for player item status changes
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(playerItemDidReachEnd:)
                                                 name:AVPlayerItemDidPlayToEndTimeNotification
                                               object:nil];

    // Add observer for player item failed to play
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(playerItemFailedToPlay:)
                                                 name:AVPlayerItemFailedToPlayToEndTimeNotification
                                               object:nil];
}

#pragma mark - Remote Commands & Now Playing

- (void)setupRemoteCommands
{
    if (@available(macOS 10.12.2, *)) {
        [self teardownRemoteCommands];

        MPRemoteCommandCenter *commandCenter = [MPRemoteCommandCenter sharedCommandCenter];
        NSMutableArray<MPRemoteCommand *> *commands = [NSMutableArray array];

        MPRemoteCommand *playCommand = commandCenter.playCommand;
        playCommand.enabled = YES;
        [playCommand addTarget:self action:@selector(handlePlayCommand:)];
        [commands addObject:playCommand];

        MPRemoteCommand *pauseCommand = commandCenter.pauseCommand;
        pauseCommand.enabled = YES;
        [pauseCommand addTarget:self action:@selector(handlePauseCommand:)];
        [commands addObject:pauseCommand];

        MPRemoteCommand *toggleCommand = commandCenter.togglePlayPauseCommand;
        toggleCommand.enabled = YES;
        [toggleCommand addTarget:self action:@selector(handleTogglePlayPauseCommand:)];
        [commands addObject:toggleCommand];

        MPRemoteCommand *nextCommand = commandCenter.nextTrackCommand;
        nextCommand.enabled = YES;
        [nextCommand addTarget:self action:@selector(handleNextTrackCommand:)];
        [commands addObject:nextCommand];

        MPRemoteCommand *previousCommand = commandCenter.previousTrackCommand;
        previousCommand.enabled = YES;
        [previousCommand addTarget:self action:@selector(handlePreviousTrackCommand:)];
        [commands addObject:previousCommand];

        self.remoteCommandTargets = commands;
    }
}

- (void)teardownRemoteCommands
{
    if (@available(macOS 10.12.2, *)) {
        if (self.remoteCommandTargets.count == 0) {
            return;
        }

        for (MPRemoteCommand *command in self.remoteCommandTargets) {
            [command removeTarget:self];
            command.enabled = NO;
        }

        self.remoteCommandTargets = nil;
    }
}

- (void)sendRemoteCommandEvent:(NSString *)command
{
    if (!command) {
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.hasListeners) {
            [self sendEventWithName:@"onRemoteCommand" body:@{ @"command": command }];
        }
    });
}

- (MPRemoteCommandHandlerStatus)handlePlayCommand:(__unused MPRemoteCommandEvent *)event
{
    [self sendRemoteCommandEvent:@"play"];
    return MPRemoteCommandHandlerStatusSuccess;
}

- (MPRemoteCommandHandlerStatus)handlePauseCommand:(__unused MPRemoteCommandEvent *)event
{
    [self sendRemoteCommandEvent:@"pause"];
    return MPRemoteCommandHandlerStatusSuccess;
}

- (MPRemoteCommandHandlerStatus)handleTogglePlayPauseCommand:(__unused MPRemoteCommandEvent *)event
{
    [self sendRemoteCommandEvent:@"toggle"];
    return MPRemoteCommandHandlerStatusSuccess;
}

- (MPRemoteCommandHandlerStatus)handleNextTrackCommand:(__unused MPRemoteCommandEvent *)event
{
    [self sendRemoteCommandEvent:@"next"];
    return MPRemoteCommandHandlerStatusSuccess;
}

- (MPRemoteCommandHandlerStatus)handlePreviousTrackCommand:(__unused MPRemoteCommandEvent *)event
{
    [self sendRemoteCommandEvent:@"previous"];
    return MPRemoteCommandHandlerStatusSuccess;
}

- (void)updateNowPlayingPlaybackState:(BOOL)isPlaying
{
    if (@available(macOS 10.12.2, *)) {
        dispatch_async(dispatch_get_main_queue(), ^{
            self.nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = @(isPlaying ? 1.0 : 0.0);
            self.nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(self.currentTime);

            MPNowPlayingInfoCenter *center = [MPNowPlayingInfoCenter defaultCenter];
            center.nowPlayingInfo = [self.nowPlayingInfo copy];

            if ([center respondsToSelector:@selector(setPlaybackState:)]) {
                center.playbackState = isPlaying ? MPNowPlayingPlaybackStatePlaying : MPNowPlayingPlaybackStatePaused;
            }
        });
    }
}

- (void)updateNowPlayingElapsedTime:(NSTimeInterval)elapsedTime
{
    if (@available(macOS 10.12.2, *)) {
        dispatch_async(dispatch_get_main_queue(), ^{
            self.nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(elapsedTime);
            MPNowPlayingInfoCenter *center = [MPNowPlayingInfoCenter defaultCenter];
            center.nowPlayingInfo = [self.nowPlayingInfo copy];
        });
    }
}

- (void)updateNowPlayingDuration:(NSTimeInterval)duration
{
    if (@available(macOS 10.12.2, *)) {
        dispatch_async(dispatch_get_main_queue(), ^{
            self.nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = @(duration);
            MPNowPlayingInfoCenter *center = [MPNowPlayingInfoCenter defaultCenter];
            center.nowPlayingInfo = [self.nowPlayingInfo copy];
        });
    }
}

- (void)startObserving
{
    self.hasListeners = YES;

    // Resume progress updates if playback is active and we do not yet observe time
    if (self.isPlaying && self.player && !self.timeObserver) {
        [self addTimeObserver];
    }
}

- (void)stopObserving
{
    self.hasListeners = NO;

    // Clean up progress timer when no more listeners
    [self removeTimeObserver];
}

- (void)dealloc
{
    [self removeTimeObserver];
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self teardownRemoteCommands];
}

#pragma mark - Player Observers

- (void)playerItemDidReachEnd:(NSNotification *)notification
{
    dispatch_async(dispatch_get_main_queue(), ^{
        self.isPlaying = NO;
        [self removeTimeObserver];
        self.currentTime = self.duration;
        [self updateNowPlayingElapsedTime:self.currentTime];
        [self updateNowPlayingPlaybackState:NO];
        [self sendEventWithName:@"onPlaybackStateChanged" body:@{@"isPlaying": @NO}];
        [self sendEventWithName:@"onCompletion" body:@{}];
    });
}

- (void)playerItemFailedToPlay:(NSNotification *)notification
{
    dispatch_async(dispatch_get_main_queue(), ^{
        self.isPlaying = NO;
        [self removeTimeObserver];
        [self updateNowPlayingPlaybackState:NO];
        [self sendEventWithName:@"onPlaybackStateChanged" body:@{@"isPlaying": @NO}];
        [self sendEventWithName:@"onLoadError" body:@{@"error": @"Playback failed"}];
    });
}

#pragma mark - Exported Methods

RCT_EXPORT_METHOD(loadTrack:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            // Stop current playback
            if (self.player.rate > 0) {
                [self.player pause];
                self.isPlaying = NO;
            }

            // Create URL from file path
            NSURL *fileURL;
            if ([filePath hasPrefix:@"file://"]) {
                fileURL = [NSURL URLWithString:filePath];
            } else {
                fileURL = [NSURL fileURLWithPath:filePath];
            }

            if (!fileURL) {
                reject(@"INVALID_URL", @"Invalid file path", nil);
                return;
            }

            // Check if file exists
            if (![[NSFileManager defaultManager] fileExistsAtPath:[fileURL path]]) {
                reject(@"FILE_NOT_FOUND", @"Audio file not found", nil);
                return;
            }

            // Create player item
            self.playerItem = [AVPlayerItem playerItemWithURL:fileURL];
            if (!self.playerItem) {
                reject(@"FILE_LOAD_ERROR", @"Failed to create player item", nil);
                return;
            }

            // Replace current item
            [self.player replaceCurrentItemWithPlayerItem:self.playerItem];

            // Wait for the item to be ready
            [self.playerItem addObserver:self forKeyPath:@"status" options:NSKeyValueObservingOptionNew context:nil];
            [self.playerItem addObserver:self forKeyPath:@"duration" options:NSKeyValueObservingOptionNew context:nil];

            // Store resolve/reject for later use
            self.loadResolve = resolve;
            self.loadReject = reject;

        } @catch (NSException *exception) {
            RCTLogError(@"Exception in loadTrack: %@", exception.reason);
            reject(@"EXCEPTION", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(getTrackInfo:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        @autoreleasepool {
            NSURL *fileURL;
            if ([filePath hasPrefix:@"file://"]) {
                fileURL = [NSURL URLWithString:filePath];
            } else {
                fileURL = [NSURL fileURLWithPath:filePath];
            }

            if (!fileURL) {
                reject(@"INVALID_URL", @"Invalid file path", nil);
                return;
            }

            if (![[NSFileManager defaultManager] fileExistsAtPath:fileURL.path]) {
                reject(@"FILE_NOT_FOUND", @"Audio file not found", nil);
                return;
            }

            NSError *error = nil;
            AVAudioFile *audioFile = [[AVAudioFile alloc] initForReading:fileURL error:&error];
            if (error || audioFile == nil) {
                reject(@"FILE_READ_ERROR", error.localizedDescription ?: @"Failed to read audio file", error);
                return;
            }

            double sampleRate = audioFile.processingFormat.sampleRate;
            double durationSeconds = 0;
            if (sampleRate > 0) {
                durationSeconds = (double)audioFile.length / sampleRate;
            }

            resolve(@{
                @"durationSeconds": @(durationSeconds),
                @"sampleRate": @(sampleRate),
                @"frameCount": @(audioFile.length)
            });
        }
    });
}

RCT_EXPORT_METHOD(updateNowPlayingInfo:(NSDictionary *)info)
{
    if (!info) {
        return;
    }

    if (@available(macOS 10.12.2, *)) {
        dispatch_async(dispatch_get_main_queue(), ^{
            id titleValue = info[@"title"];
            if ([titleValue isKindOfClass:[NSString class]]) {
                self.nowPlayingInfo[MPMediaItemPropertyTitle] = titleValue;
            } else if (titleValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPMediaItemPropertyTitle];
            }

            id artistValue = info[@"artist"];
            if ([artistValue isKindOfClass:[NSString class]]) {
                self.nowPlayingInfo[MPMediaItemPropertyArtist] = artistValue;
            } else if (artistValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPMediaItemPropertyArtist];
            }

            id albumValue = info[@"album"];
            if ([albumValue isKindOfClass:[NSString class]]) {
                self.nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = albumValue;
            } else if (albumValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPMediaItemPropertyAlbumTitle];
            }

            id durationValue = info[@"duration"];
            if ([durationValue isKindOfClass:[NSNumber class]]) {
                NSNumber *duration = (NSNumber *)durationValue;
                self.duration = duration.doubleValue;
                self.nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = duration;
            } else if (durationValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPMediaItemPropertyPlaybackDuration];
            }

            id elapsedValue = info[@"elapsedTime"];
            if ([elapsedValue isKindOfClass:[NSNumber class]]) {
                NSNumber *elapsed = (NSNumber *)elapsedValue;
                self.currentTime = elapsed.doubleValue;
                self.nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsed;
            } else if (elapsedValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPNowPlayingInfoPropertyElapsedPlaybackTime];
            }

            id playbackRateValue = info[@"playbackRate"];
            if ([playbackRateValue isKindOfClass:[NSNumber class]]) {
                self.nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = playbackRateValue;
            } else if (playbackRateValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPNowPlayingInfoPropertyPlaybackRate];
            }

            id artworkValue = info[@"artwork"];
            if ([artworkValue isKindOfClass:[NSString class]] && [(NSString *)artworkValue length] > 0) {
                NSString *artworkPath = (NSString *)artworkValue;
                NSURL *artworkURL = nil;
                if ([artworkPath hasPrefix:@"file://"]) {
                    artworkURL = [NSURL URLWithString:artworkPath];
                } else {
                    artworkURL = [NSURL fileURLWithPath:artworkPath];
                }

                if (artworkURL) {
                    NSImage *image = [[NSImage alloc] initWithContentsOfURL:artworkURL];
                    if (image) {
                        MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:image.size
                                                                                     requestHandler:^NSImage * _Nonnull(CGSize size) {
                            return image;
                        }];
                        self.nowPlayingInfo[MPMediaItemPropertyArtwork] = artwork;
                    }
                }
            } else if (artworkValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPMediaItemPropertyArtwork];
            }

            id isPlayingValue = info[@"isPlaying"];
            MPNowPlayingInfoCenter *center = [MPNowPlayingInfoCenter defaultCenter];

            if ([isPlayingValue isKindOfClass:[NSNumber class]]) {
                BOOL playing = ((NSNumber *)isPlayingValue).boolValue;
                if ([center respondsToSelector:@selector(setPlaybackState:)]) {
                    center.playbackState = playing ? MPNowPlayingPlaybackStatePlaying : MPNowPlayingPlaybackStatePaused;
                }
                self.nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = @(playing ? 1.0 : 0.0);
            } else if (isPlayingValue == (id)kCFNull) {
                [self.nowPlayingInfo removeObjectForKey:MPNowPlayingInfoPropertyPlaybackRate];
            }

            center.nowPlayingInfo = [self.nowPlayingInfo copy];
        });
    }
}

RCT_EXPORT_METHOD(clearNowPlayingInfo)
{
    if (@available(macOS 10.12.2, *)) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self.nowPlayingInfo removeAllObjects];
            self.currentTime = 0;
            self.duration = 0;

            MPNowPlayingInfoCenter *center = [MPNowPlayingInfoCenter defaultCenter];
            center.nowPlayingInfo = nil;
            if ([center respondsToSelector:@selector(setPlaybackState:)]) {
                center.playbackState = MPNowPlayingPlaybackStateStopped;
            }
        });
    }
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary<NSKeyValueChangeKey,id> *)change context:(void *)context
{
    if ([keyPath isEqualToString:@"status"]) {
        AVPlayerItem *item = (AVPlayerItem *)object;
        if (item.status == AVPlayerItemStatusReadyToPlay) {
            // Get duration if it is numeric; indefinite durations report NaN
            CMTime duration = item.duration;
            if (CMTIME_IS_NUMERIC(duration)) {
                double seconds = CMTimeGetSeconds(duration);
                if (isfinite(seconds)) {
                    self.duration = seconds;
                }
            }
            self.currentTime = 0;

            [self updateNowPlayingDuration:self.duration];
            [self updateNowPlayingElapsedTime:self.currentTime];

            // Remove observers
            [item removeObserver:self forKeyPath:@"status"];
            [item removeObserver:self forKeyPath:@"duration"];

            // Send success event
            [self sendEventWithName:@"onLoadSuccess" body:@{@"duration": @(self.duration)}];
            if (self.loadResolve) {
                self.loadResolve(@{@"success": @YES});
                self.loadResolve = nil;
                self.loadReject = nil;
            }
        } else if (item.status == AVPlayerItemStatusFailed) {
            NSError *error = item.error;
            RCTLogError(@"Error loading audio file: %@", error.localizedDescription);

            // Remove observers
            [item removeObserver:self forKeyPath:@"status"];
            [item removeObserver:self forKeyPath:@"duration"];

            [self sendEventWithName:@"onLoadError" body:@{@"error": error.localizedDescription ?: @"Unknown error"}];
            if (self.loadReject) {
                self.loadReject(@"FILE_LOAD_ERROR", error.localizedDescription ?: @"Unknown error", error);
                self.loadResolve = nil;
                self.loadReject = nil;
            }
        }
    } else if ([keyPath isEqualToString:@"duration"]) {
        AVPlayerItem *item = (AVPlayerItem *)object;
        CMTime duration = item.duration;
        if (CMTIME_IS_NUMERIC(duration)) {
            double seconds = CMTimeGetSeconds(duration);
            if (isfinite(seconds)) {
                self.duration = seconds;
                [self updateNowPlayingDuration:self.duration];
            }
        }
    }
}

RCT_EXPORT_METHOD(play:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.playerItem) {
            reject(@"NO_FILE", @"No audio file loaded", nil);
            return;
        }

        if (self.player.rate > 0) {
            resolve(@{@"success": @YES});
            return;
        }

        // Ensure remote command handlers stay connected when starting playback
        [self setupRemoteCommands];

        [self.player play];
        self.isPlaying = YES;

        if (self.hasListeners) {
            [self addTimeObserver];
        }
        [self updateNowPlayingPlaybackState:YES];
        [self sendEventWithName:@"onPlaybackStateChanged" body:@{@"isPlaying": @YES}];
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.player) {
            reject(@"NO_PLAYER", @"No audio player available", nil);
            return;
        }

        [self.player pause];
        self.isPlaying = NO;
        [self removeTimeObserver];
        [self updateNowPlayingPlaybackState:NO];
        [self sendEventWithName:@"onPlaybackStateChanged" body:@{@"isPlaying": @NO}];
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.player) {
            reject(@"NO_PLAYER", @"No audio player available", nil);
            return;
        }

        [self.player pause];
        [self.player seekToTime:kCMTimeZero];
        self.isPlaying = NO;
        self.currentTime = 0;
        [self removeTimeObserver];
        [self updateNowPlayingElapsedTime:self.currentTime];
        [self updateNowPlayingPlaybackState:NO];
        [self sendEventWithName:@"onPlaybackStateChanged" body:@{@"isPlaying": @NO}];
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(seek:(double)seconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.player || !self.playerItem) {
            reject(@"NO_PLAYER", @"No audio player available", nil);
            return;
        }

        // Clamp seek time to valid range, guarding against NaN when duration is still indefinite
        if (!isfinite(seconds)) {
            reject(@"INVALID_TIME", @"Seek time must be a finite number", nil);
            return;
        }

        double targetSeconds = seconds < 0 ? 0 : seconds;
        double durationSeconds = self.duration;

        if (!isfinite(durationSeconds) || durationSeconds <= 0) {
            CMTime itemDuration = self.playerItem.duration;
            if (CMTIME_IS_NUMERIC(itemDuration)) {
                double computedDuration = CMTimeGetSeconds(itemDuration);
                if (isfinite(computedDuration)) {
                    durationSeconds = computedDuration;
                }
            }
        }

        if (isfinite(durationSeconds) && durationSeconds > 0) {
            targetSeconds = MIN(targetSeconds, durationSeconds);
        }

        CMTime seekTime = CMTimeMakeWithSeconds(targetSeconds, NSEC_PER_SEC);
        if (!CMTIME_IS_VALID(seekTime)) {
            reject(@"INVALID_TIME", @"Computed seek time is invalid", nil);
            return;
        }

        double desiredTime = targetSeconds;

        [self.player seekToTime:seekTime
               toleranceBefore:kCMTimeZero
                toleranceAfter:kCMTimeZero
          completionHandler:^(BOOL finished) {
            double resolvedTime = desiredTime;
            CMTime currentTime = self.player.currentTime;
            if (CMTIME_IS_VALID(currentTime)) {
                double computed = CMTimeGetSeconds(currentTime);
                if (isfinite(computed)) {
                    resolvedTime = computed;
                }
            }

            BOOL reachedTarget = finished;
            if (!reachedTarget && isfinite(resolvedTime) && isfinite(desiredTime)) {
                reachedTarget = fabs(resolvedTime - desiredTime) <= 0.2;
            }

            double commitTime = isfinite(resolvedTime) ? resolvedTime : desiredTime;
            if (isfinite(commitTime)) {
                self.currentTime = commitTime;
                [self updateNowPlayingElapsedTime:self.currentTime];
            }

            if (!reachedTarget) {
                RCTLogWarn(@"AVPlayer seek reported unfinished completion (target: %f, actual: %f)", desiredTime, resolvedTime);
            }

            resolve(@{@"success": @(reachedTarget)});
        }];
    });
}

RCT_EXPORT_METHOD(setVolume:(double)volume
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.player) {
            reject(@"NO_PLAYER", @"No audio player available", nil);
            return;
        }

        float clampedVolume = MAX(0.0f, MIN(1.0f, (float)volume));
        self.player.volume = clampedVolume;
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(getCurrentState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        CMTime currentTime = self.player.currentTime;
        if (CMTIME_IS_VALID(currentTime)) {
            self.currentTime = CMTimeGetSeconds(currentTime);
        }

        resolve(@{
            @"isPlaying": @(self.isPlaying),
            @"currentTime": @(self.currentTime),
            @"duration": @(self.duration),
            @"volume": @(self.player ? self.player.volume : 0.5f)
        });
    });
}

#pragma mark - Time Observer

- (void)addTimeObserver
{
    [self removeTimeObserver];

    __weak typeof(self) weakSelf = self;
    // Throttle updates: emit every 2s on a background queue to minimize CPU impact
    dispatch_queue_t backgroundQueue = dispatch_get_global_queue(QOS_CLASS_BACKGROUND, 0);
    CMTime interval = CMTimeMakeWithSeconds(1.0, NSEC_PER_SEC);
    self.timeObserver = [self.player addPeriodicTimeObserverForInterval:interval
                                                                   queue:backgroundQueue
                                                              usingBlock:^(CMTime time) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (strongSelf && strongSelf.hasListeners && strongSelf.isPlaying && CMTIME_IS_VALID(time)) {
            NSTimeInterval newTime = CMTimeGetSeconds(time);

            // Only send updates if time has changed significantly (avoid redundant events)
            if (fabs(newTime - strongSelf.currentTime) >= 0.5) {
                strongSelf.currentTime = newTime;
                [strongSelf updateNowPlayingElapsedTime:strongSelf.currentTime];

                // Dispatch event sending back to main queue
                dispatch_async(dispatch_get_main_queue(), ^{
                    [strongSelf sendEventWithName:@"onProgress" body:@{
                        @"currentTime": @(strongSelf.currentTime),
                        @"duration": @(strongSelf.duration)
                    }];
                });
            }
        }
    }];
}

- (void)removeTimeObserver
{
    if (self.timeObserver) {
        [self.player removeTimeObserver:self.timeObserver];
        self.timeObserver = nil;
    }
}

@end
