#import "AudioPlayer.h"
#import <Accelerate/Accelerate.h>
#import <React/RCTLog.h>
#import <AppKit/AppKit.h>
#import <MediaToolbox/MediaToolbox.h>
#import <math.h>
#import <stdatomic.h>

typedef struct {
    __unsafe_unretained AudioPlayer *audioPlayer;
} VisualizerTapContext;

typedef struct {
    float *data;
    size_t capacity;
    atomic_uint_fast64_t writeOffset;
    atomic_uint_fast64_t readOffset;
} VisualizerRingBuffer;

static inline void VisualizerRingBufferInitialize(VisualizerRingBuffer *ring)
{
    ring->data = NULL;
    ring->capacity = 0;
    atomic_store_explicit(&ring->writeOffset, 0, memory_order_relaxed);
    atomic_store_explicit(&ring->readOffset, 0, memory_order_relaxed);
}

static inline void VisualizerRingBufferReset(VisualizerRingBuffer *ring)
{
    if (!ring) {
        return;
    }
    atomic_store_explicit(&ring->writeOffset, 0, memory_order_release);
    atomic_store_explicit(&ring->readOffset, 0, memory_order_release);
}

static inline void VisualizerRingBufferDeallocate(VisualizerRingBuffer *ring)
{
    if (!ring) {
        return;
    }
    if (ring->data) {
        free(ring->data);
        ring->data = NULL;
    }
    ring->capacity = 0;
    VisualizerRingBufferReset(ring);
}

static inline BOOL VisualizerRingBufferEnsureCapacity(VisualizerRingBuffer *ring, size_t capacity)
{
    if (!ring) {
        return NO;
    }
    if (capacity == 0) {
        capacity = 1;
    }
    if (ring->capacity >= capacity) {
        return YES;
    }

    float *newData = calloc(capacity, sizeof(float));
    if (!newData) {
        return NO;
    }

    if (ring->data) {
        free(ring->data);
    }

    ring->data = newData;
    ring->capacity = capacity;
    VisualizerRingBufferReset(ring);
    return YES;
}

static inline size_t VisualizerRingBufferReadable(const VisualizerRingBuffer *ring)
{
    if (!ring || ring->capacity == 0) {
        return 0;
    }
    uint64_t writeOffset = atomic_load_explicit(&ring->writeOffset, memory_order_acquire);
    uint64_t readOffset = atomic_load_explicit(&ring->readOffset, memory_order_acquire);
    if (writeOffset <= readOffset) {
        return 0;
    }
    return (size_t)(writeOffset - readOffset);
}

static inline size_t VisualizerRingBufferWritable(const VisualizerRingBuffer *ring)
{
    if (!ring || ring->capacity == 0) {
        return 0;
    }
    size_t readable = VisualizerRingBufferReadable(ring);
    if (readable >= ring->capacity) {
        return 0;
    }
    return ring->capacity - readable;
}

static inline size_t VisualizerRingBufferWrite(VisualizerRingBuffer *ring, const float *samples, size_t count)
{
    if (!ring || !ring->data || ring->capacity == 0 || !samples || count == 0) {
        return 0;
    }

    if (count > ring->capacity) {
        samples = samples + (count - ring->capacity);
        count = ring->capacity;
    }

    size_t writable = VisualizerRingBufferWritable(ring);
    if (count > writable) {
        size_t drop = count - writable;
        atomic_fetch_add_explicit(&ring->readOffset, drop, memory_order_release);
    }

    uint64_t writeOffset = atomic_load_explicit(&ring->writeOffset, memory_order_acquire);
    size_t startIndex = (size_t)(writeOffset % ring->capacity);
    size_t firstChunk = MIN(count, ring->capacity - startIndex);
    memcpy(ring->data + startIndex, samples, firstChunk * sizeof(float));
    size_t remaining = count - firstChunk;
    if (remaining > 0) {
        memcpy(ring->data, samples + firstChunk, remaining * sizeof(float));
    }

    atomic_fetch_add_explicit(&ring->writeOffset, count, memory_order_release);
    return count;
}

static inline BOOL VisualizerRingBufferCopy(const VisualizerRingBuffer *ring, float *destination, size_t count)
{
    if (!ring || !ring->data || ring->capacity == 0 || !destination || count == 0) {
        return NO;
    }

    size_t readable = VisualizerRingBufferReadable(ring);
    if (readable < count) {
        return NO;
    }

    uint64_t readOffset = atomic_load_explicit(&ring->readOffset, memory_order_acquire);
    size_t startIndex = (size_t)(readOffset % ring->capacity);
    size_t firstChunk = MIN(count, ring->capacity - startIndex);
    memcpy(destination, ring->data + startIndex, firstChunk * sizeof(float));
    size_t remaining = count - firstChunk;
    if (remaining > 0) {
        memcpy(destination + firstChunk, ring->data, remaining * sizeof(float));
    }
    return YES;
}

static inline void VisualizerRingBufferConsume(VisualizerRingBuffer *ring, size_t count)
{
    if (!ring || count == 0) {
        return;
    }
    atomic_fetch_add_explicit(&ring->readOffset, count, memory_order_release);
}

static const NSUInteger kDefaultVisualizerFFTSize = 1024;
static const NSUInteger kDefaultVisualizerBinCount = 64;
static const float kDefaultVisualizerSmoothing = 0.6f;
static const NSTimeInterval kDefaultVisualizerThrottleSeconds = 1.0 / 30.0;
static const float kVisualizerMinDecibels = -75.0f;
static const float kVisualizerMaxDecibels = -12.0f;
static const float kVisualizerHighFrequencyEmphasisExponent = 0.45f;
static const float kVisualizerResponseGamma = 0.85f;

@interface AudioPlayer ()

@property (nonatomic, assign) BOOL visualizerEnabled;
@property (nonatomic, assign) BOOL visualizerActive;
@property (nonatomic, strong) dispatch_queue_t visualizerQueue;
@property (nonatomic, assign) MTAudioProcessingTapRef visualizerTap;
@property (nonatomic, assign) VisualizerTapContext *visualizerTapContext;
@property (nonatomic, strong) AVAudioMix *visualizerAudioMix;
@property (nonatomic, assign) NSTimeInterval visualizerLastEmitTime;
@property (nonatomic, assign) NSTimeInterval visualizerThrottleInterval;
@property (nonatomic, assign) NSUInteger visualizerFFTSize;
@property (nonatomic, assign) NSUInteger visualizerHopSize;
@property (nonatomic, assign) NSUInteger visualizerBinCount;
@property (nonatomic, assign) float visualizerSmoothingFactor;
@property (nonatomic, assign) FFTSetup visualizerFFTSetup;
@property (nonatomic, assign) vDSP_Length visualizerLog2n;
@property (nonatomic, strong) NSMutableData *visualizerWindow;
@property (nonatomic, strong) NSMutableData *visualizerReal;
@property (nonatomic, strong) NSMutableData *visualizerImag;
@property (nonatomic, strong) NSMutableData *visualizerMagnitudes;
@property (nonatomic, strong) NSMutableData *visualizerSmoothedBins;
@property (nonatomic, strong) NSMutableData *visualizerFrameBuffer;
@property (nonatomic, strong) NSMutableData *visualizerScratchMono;
@property (nonatomic, strong) NSMutableData *visualizerBinStartIndices;
@property (nonatomic, strong) NSMutableData *visualizerBinEndIndices;
@property (nonatomic, strong) NSMutableData *visualizerBinWindowScale;
@property (nonatomic, strong) NSMutableData *visualizerBinEmphasisFactors;
@property (nonatomic, strong) NSMutableData *visualizerGammaVector;
@property (nonatomic, strong) NSMutableData *visualizerBinScratch;
@property (nonatomic, strong) NSMutableData *visualizerPrefixSums;
@property (nonatomic, assign) NSUInteger visualizerCPUOverrunFrames;

- (void)configureVisualizerDefaults;
- (void)installVisualizerTapIfNeeded;
- (void)removeVisualizerTap;
- (void)resetVisualizerProcessingState;
- (void)handleVisualizerBuffer:(AudioBufferList *)bufferList frameCount:(UInt32)frameCount;
- (void)scheduleVisualizerDrain;
- (void)drainVisualizerRingBuffer;
- (void)processVisualizerFrameWithSamples:(const float *)samples;
- (void)rebuildVisualizerFFTResources;
- (void)recalculateVisualizerBinMappingWithSpectrumSize:(NSUInteger)spectrumSize;
- (NSUInteger)validatedFFTSizeFromRequested:(NSUInteger)requested;
- (void)sendVisualizerEventWithRMS:(float)rms bins:(const float *)bins count:(NSUInteger)count;

@end

static void VisualizerTapInit(MTAudioProcessingTapRef tap, void *clientInfo, void **tapStorageOut)
{
    VisualizerTapContext *context = (VisualizerTapContext *)clientInfo;
    if (tapStorageOut && context) {
        *tapStorageOut = context;
    }
}

static void VisualizerTapFinalize(MTAudioProcessingTapRef tap)
{
    VisualizerTapContext *context = (VisualizerTapContext *)MTAudioProcessingTapGetStorage(tap);
    if (context) {
        context->audioPlayer = nil;
        free(context);
    }
}

static void VisualizerTapPrepare(MTAudioProcessingTapRef tap, CMItemCount numberFrames, const AudioStreamBasicDescription *processingFormat)
{
    #pragma unused(tap, numberFrames, processingFormat)
}

static void VisualizerTapUnprepare(MTAudioProcessingTapRef tap)
{
    #pragma unused(tap)
}

static void VisualizerTapProcess(MTAudioProcessingTapRef tap,
                                 CMItemCount numberFrames,
                                 MTAudioProcessingTapFlags flags,
                                 AudioBufferList *bufferListInOut,
                                 CMItemCount *numberFramesOut,
                                 MTAudioProcessingTapFlags *flagsOut)
{
    VisualizerTapContext *context = (VisualizerTapContext *)MTAudioProcessingTapGetStorage(tap);
    if (!context) {
        if (numberFramesOut) {
            *numberFramesOut = 0;
        }
        return;
    }

    MTAudioProcessingTapFlags localFlags = 0;
    CMTimeRange timeRange = kCMTimeRangeZero;
    CMItemCount retrievedFrames = 0;
    OSStatus status = MTAudioProcessingTapGetSourceAudio(
        tap,
        numberFrames,
        bufferListInOut,
        &localFlags,
        &timeRange,
        &retrievedFrames);

    if (status != noErr) {
        if (numberFramesOut) {
            *numberFramesOut = 0;
        }
        if (flagsOut) {
            *flagsOut = 0;
        }
        return;
    }

    if (flagsOut) {
        *flagsOut = localFlags | flags;
    }
    if (numberFramesOut) {
        *numberFramesOut = retrievedFrames;
    }

    AudioPlayer *audioPlayer = context->audioPlayer;
    if (!audioPlayer || !bufferListInOut || retrievedFrames == 0) {
        return;
    }

    [audioPlayer handleVisualizerBuffer:bufferListInOut frameCount:(UInt32)retrievedFrames];
}

@implementation AudioPlayer {
    atomic_flag _visualizerDrainScheduled;
    VisualizerRingBuffer _visualizerRingBuffer;
}

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
        @"onRemoteCommand",
        @"onVisualizerFrame"
    ];
}

- (instancetype)init
{
    self = [super init];
    if (self) {
        atomic_flag_clear(&_visualizerDrainScheduled);
        VisualizerRingBufferInitialize(&_visualizerRingBuffer);
        [self setupPlayer];
        _isPlaying = NO;
        _duration = 0;
        _currentTime = 0;
        _nowPlayingInfo = [NSMutableDictionary dictionary];
        _visualizerQueue = dispatch_queue_create("com.legendmusic.audio.visualizer", DISPATCH_QUEUE_SERIAL);
        [self configureVisualizerDefaults];
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

- (NSUInteger)validatedFFTSizeFromRequested:(NSUInteger)requested
{
    if (requested < 256) {
        requested = 256;
    }
    if (requested > 4096) {
        requested = 4096;
    }

    NSUInteger size = 1;
    while (size < requested) {
        size <<= 1;
    }
    return size;
}

- (void)rebuildVisualizerFFTResources
{
    if (self.visualizerFFTSetup) {
        vDSP_destroy_fftsetup(self.visualizerFFTSetup);
        self.visualizerFFTSetup = NULL;
    }

    self.visualizerFFTSize = [self validatedFFTSizeFromRequested:self.visualizerFFTSize];
    self.visualizerHopSize = MAX(1, self.visualizerFFTSize / 2);
    self.visualizerLog2n = (vDSP_Length)lrintf(log2f((float)self.visualizerFFTSize));
    self.visualizerFFTSetup = vDSP_create_fftsetup(self.visualizerLog2n, kFFTRadix2);

    NSUInteger fftSize = self.visualizerFFTSize;
    NSUInteger spectrumSize = fftSize / 2;

    self.visualizerWindow = [NSMutableData dataWithLength:fftSize * sizeof(float)];
    float *windowPtr = self.visualizerWindow.mutableBytes;
    if (windowPtr && fftSize > 0) {
        vDSP_hann_window(windowPtr, fftSize, vDSP_HANN_NORM);
    }

    self.visualizerFrameBuffer = [NSMutableData dataWithLength:fftSize * sizeof(float)];
    self.visualizerScratchMono = [NSMutableData dataWithLength:fftSize * sizeof(float)];
    self.visualizerReal = [NSMutableData dataWithLength:spectrumSize * sizeof(float)];
    self.visualizerImag = [NSMutableData dataWithLength:spectrumSize * sizeof(float)];
    self.visualizerMagnitudes = [NSMutableData dataWithLength:spectrumSize * sizeof(float)];

    if (self.visualizerBinCount == 0) {
        self.visualizerBinCount = kDefaultVisualizerBinCount;
    }
    self.visualizerSmoothedBins = [NSMutableData dataWithLength:self.visualizerBinCount * sizeof(float)];
    memset(self.visualizerSmoothedBins.mutableBytes, 0, self.visualizerSmoothedBins.length);

    size_t ringCapacity = (size_t)(fftSize * 4);
    if (ringCapacity < (size_t)(fftSize + self.visualizerHopSize * 2)) {
        ringCapacity = (size_t)(fftSize + self.visualizerHopSize * 2);
    }
    if (!VisualizerRingBufferEnsureCapacity(&_visualizerRingBuffer, ringCapacity)) {
        RCTLogError(@"Visualizer: Failed to allocate ring buffer of size %zu", ringCapacity);
    }
    VisualizerRingBufferReset(&_visualizerRingBuffer);

    NSUInteger prefixLength = spectrumSize + 1;
    if (prefixLength == 0) {
        prefixLength = 1;
    }
    self.visualizerPrefixSums = [NSMutableData dataWithLength:prefixLength * sizeof(float)];

    if (self.visualizerBinCount > 0) {
        NSUInteger binBytes = self.visualizerBinCount * sizeof(float);
        self.visualizerBinScratch = [NSMutableData dataWithLength:binBytes];
        self.visualizerBinWindowScale = [NSMutableData dataWithLength:binBytes];
        self.visualizerBinEmphasisFactors = [NSMutableData dataWithLength:binBytes];
        self.visualizerGammaVector = [NSMutableData dataWithLength:binBytes];
    } else {
        self.visualizerBinScratch = nil;
        self.visualizerBinWindowScale = nil;
        self.visualizerBinEmphasisFactors = nil;
        self.visualizerGammaVector = nil;
    }

    [self recalculateVisualizerBinMappingWithSpectrumSize:spectrumSize];
}

- (void)recalculateVisualizerBinMappingWithSpectrumSize:(NSUInteger)spectrumSize
{
    if (self.visualizerBinCount == 0 || spectrumSize <= 1) {
        self.visualizerBinStartIndices = nil;
        self.visualizerBinEndIndices = nil;
        return;
    }

    if (!self.visualizerBinStartIndices) {
        self.visualizerBinStartIndices = [NSMutableData data];
    }
    if (!self.visualizerBinEndIndices) {
        self.visualizerBinEndIndices = [NSMutableData data];
    }
    if (!self.visualizerBinWindowScale) {
        self.visualizerBinWindowScale = [NSMutableData data];
    }
    if (!self.visualizerBinEmphasisFactors) {
        self.visualizerBinEmphasisFactors = [NSMutableData data];
    }
    if (!self.visualizerGammaVector) {
        self.visualizerGammaVector = [NSMutableData data];
    }
    if (!self.visualizerBinScratch) {
        self.visualizerBinScratch = [NSMutableData data];
    }

    [self.visualizerBinStartIndices setLength:(NSUInteger)(self.visualizerBinCount * sizeof(NSUInteger))];
    [self.visualizerBinEndIndices setLength:(NSUInteger)(self.visualizerBinCount * sizeof(NSUInteger))];
    [self.visualizerBinWindowScale setLength:(NSUInteger)(self.visualizerBinCount * sizeof(float))];
    [self.visualizerBinEmphasisFactors setLength:(NSUInteger)(self.visualizerBinCount * sizeof(float))];
    [self.visualizerGammaVector setLength:(NSUInteger)(self.visualizerBinCount * sizeof(float))];
    [self.visualizerBinScratch setLength:(NSUInteger)(self.visualizerBinCount * sizeof(float))];

    NSUInteger *starts = (NSUInteger *)self.visualizerBinStartIndices.mutableBytes;
    NSUInteger *ends = (NSUInteger *)self.visualizerBinEndIndices.mutableBytes;
    float *windowScales = (float *)self.visualizerBinWindowScale.mutableBytes;
    float *emphasisFactors = (float *)self.visualizerBinEmphasisFactors.mutableBytes;
    float *gammaVector = (float *)self.visualizerGammaVector.mutableBytes;

    if (!starts || !ends || !windowScales || !emphasisFactors || !gammaVector) {
        return;
    }

    const float minIndex = 1.0f;
    float maxIndex = (float)(spectrumSize - 1);
    if (maxIndex < minIndex) {
        maxIndex = minIndex;
    }

    // Use only 70% of the spectrum to avoid bunching at the Nyquist end
    maxIndex = maxIndex * 0.70f;
    if (maxIndex < minIndex) {
        maxIndex = minIndex;
    }

    float logMin = logf(minIndex);
    float logMax = logf(maxIndex);
    if (!isfinite(logMin) || !isfinite(logMax) || logMax <= logMin) {
        logMin = 0.0f;
        logMax = logf(MAX(2.0f, maxIndex));
    }

    const float logRange = logMax - logMin;
    NSUInteger previousEnd = 1;
    for (NSUInteger bin = 0; bin < self.visualizerBinCount; bin++) {
        float t0 = (float)bin / (float)self.visualizerBinCount;
        float t1 = (float)(bin + 1) / (float)self.visualizerBinCount;

        float mappedStart = expf(logMin + t0 * logRange);
        float mappedEnd = expf(logMin + t1 * logRange);

        NSUInteger startIndex = (NSUInteger)floorf(mappedStart);
        NSUInteger endIndex = (NSUInteger)ceilf(mappedEnd);

        if (bin == 0) {
            startIndex = 1;
        }

        if (startIndex < previousEnd) {
            startIndex = previousEnd;
        }

        if (startIndex >= spectrumSize) {
            startIndex = spectrumSize - 1;
        }

        if (endIndex <= startIndex) {
            endIndex = startIndex + 1;
        }

        if (endIndex > spectrumSize) {
            endIndex = spectrumSize;
        }

        starts[bin] = startIndex;
        ends[bin] = endIndex;
        previousEnd = endIndex;

        if (windowScales) {
            float windowLength = (float)MAX(1, (long)(endIndex - startIndex));
            windowScales[bin] = windowLength > 0.0f ? (1.0f / windowLength) : 1.0f;
        }

        if (emphasisFactors) {
            float emphasis = powf(((float)(bin + 1) / (float)self.visualizerBinCount), kVisualizerHighFrequencyEmphasisExponent);
            emphasisFactors[bin] = fminf(1.0f, 0.65f + 0.35f * emphasis);
        }

        if (gammaVector) {
            gammaVector[bin] = kVisualizerResponseGamma;
        }
    }
}

- (void)configureVisualizerDefaults
{
    self.visualizerEnabled = NO;
    self.visualizerActive = NO;
    self.visualizerTap = nil;
    self.visualizerTapContext = NULL;
    self.visualizerAudioMix = nil;
    self.visualizerLastEmitTime = 0;
    self.visualizerThrottleInterval = kDefaultVisualizerThrottleSeconds;
    self.visualizerFFTSize = kDefaultVisualizerFFTSize;
    self.visualizerBinCount = kDefaultVisualizerBinCount;
    self.visualizerSmoothingFactor = kDefaultVisualizerSmoothing;
    self.visualizerCPUOverrunFrames = 0;
    self.visualizerBinStartIndices = nil;
    self.visualizerBinEndIndices = nil;
    VisualizerRingBufferReset(&_visualizerRingBuffer);
    [self rebuildVisualizerFFTResources];
}

- (void)resetVisualizerProcessingState
{
    self.visualizerLastEmitTime = 0;
    VisualizerRingBufferReset(&_visualizerRingBuffer);
    if (self.visualizerSmoothedBins.length > 0) {
        memset(self.visualizerSmoothedBins.mutableBytes, 0, self.visualizerSmoothedBins.length);
    }
    self.visualizerCPUOverrunFrames = 0;
    atomic_flag_clear_explicit(&_visualizerDrainScheduled, memory_order_release);
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

#pragma mark - Visualizer

- (void)installVisualizerTapIfNeeded
{
    if (!self.visualizerEnabled || self.visualizerTap || !self.playerItem) {
        return;
    }

    // Only install tap if player item is ready to play
    if (self.playerItem.status != AVPlayerItemStatusReadyToPlay) {
        RCTLogInfo(@"Visualizer: Player item not ready, skipping tap installation");
        return;
    }

    AVAsset *asset = self.playerItem.asset;
    if (!asset) {
        return;
    }

    NSArray<AVAssetTrack *> *audioTracks = [asset tracksWithMediaType:AVMediaTypeAudio];
    AVAssetTrack *track = audioTracks.firstObject;
    if (!track) {
        RCTLogWarn(@"Visualizer: No audio track available to attach tap.");
        return;
    }

    MTAudioProcessingTapCallbacks callbacks;
    memset(&callbacks, 0, sizeof(MTAudioProcessingTapCallbacks));
    callbacks.version = kMTAudioProcessingTapCallbacksVersion_0;

    VisualizerTapContext *context = malloc(sizeof(VisualizerTapContext));
    if (!context) {
        RCTLogError(@"Visualizer: Failed to allocate tap context.");
        return;
    }
    context->audioPlayer = self;

    callbacks.clientInfo = context;
    callbacks.init = VisualizerTapInit;
    callbacks.finalize = VisualizerTapFinalize;
    callbacks.prepare = VisualizerTapPrepare;
    callbacks.unprepare = VisualizerTapUnprepare;
    callbacks.process = VisualizerTapProcess;

    MTAudioProcessingTapRef tap = NULL;
    OSStatus status = MTAudioProcessingTapCreate(
        kCFAllocatorDefault,
        &callbacks,
        kMTAudioProcessingTapCreationFlag_PostEffects,
        &tap);

    if (status != noErr || tap == NULL) {
        free(context);
        RCTLogError(@"Visualizer: Failed to create audio processing tap (status %d).", (int)status);
        return;
    }

    AVMutableAudioMixInputParameters *inputParameters =
        [AVMutableAudioMixInputParameters audioMixInputParametersWithTrack:track];
    inputParameters.audioTapProcessor = tap;

    AVMutableAudioMix *audioMix = [AVMutableAudioMix audioMix];
    audioMix.inputParameters = @[inputParameters];

    self.visualizerTapContext = context;
    self.visualizerTap = tap;
    self.visualizerAudioMix = audioMix;

    // Check if we're actively playing (not just paused mid-track)
    BOOL wasPlaying = (self.player.rate > 0) && self.isPlaying;
    CMTime currentTime = kCMTimeInvalid;

    if (wasPlaying) {
        currentTime = self.player.currentTime;
        [self.player pause];
        // Apply audioMix changes
        self.playerItem.audioMix = audioMix;
        // Resume playback after applying changes
        if (CMTIME_IS_VALID(currentTime)) {
            [self.player seekToTime:currentTime toleranceBefore:kCMTimeZero toleranceAfter:kCMTimeZero completionHandler:^(BOOL finished) {
                [self.player play];
            }];
        } else {
            [self.player play];
        }
    } else {
        // Player is not actively playing, safe to apply audioMix directly
        self.playerItem.audioMix = audioMix;
    }

    self.visualizerActive = self.visualizerEnabled && self.isPlaying;
    [self resetVisualizerProcessingState];
}

- (void)removeVisualizerTap
{
    BOOL wasPlaying = (self.player.rate > 0) && self.isPlaying;
    CMTime currentTime = kCMTimeInvalid;

    if (wasPlaying) {
        currentTime = self.player.currentTime;
        [self.player pause];
        // Remove audioMix
        if (self.playerItem) {
            self.playerItem.audioMix = nil;
        }
        // Resume playback after removal
        if (CMTIME_IS_VALID(currentTime)) {
            [self.player seekToTime:currentTime toleranceBefore:kCMTimeZero toleranceAfter:kCMTimeZero completionHandler:^(BOOL finished) {
                [self.player play];
            }];
        } else {
            [self.player play];
        }
    } else {
        // Player is not actively playing, safe to remove audioMix directly
        if (self.playerItem) {
            self.playerItem.audioMix = nil;
        }
    }

    if (self.visualizerTap) {
        CFRelease(self.visualizerTap);
        self.visualizerTap = NULL;
    }

    if (self.visualizerTapContext) {
        self.visualizerTapContext->audioPlayer = nil;
        self.visualizerTapContext = NULL;
    }

    self.visualizerAudioMix = nil;
    self.visualizerActive = NO;
    [self resetVisualizerProcessingState];
}

- (void)handleVisualizerBuffer:(AudioBufferList *)bufferList frameCount:(UInt32)frameCount
{
    if (!self.visualizerEnabled || !self.visualizerActive || !self.hasListeners) {
        return;
    }

    if (!bufferList || frameCount == 0) {
        return;
    }

    UInt32 numberBuffers = bufferList->mNumberBuffers;
    if (numberBuffers == 0) {
        return;
    }

    size_t requiredScratchSize = (size_t)frameCount * sizeof(float);
    if (self.visualizerScratchMono.length < requiredScratchSize) {
        self.visualizerScratchMono.length = requiredScratchSize;
    }

    float *monoPtr = (float *)self.visualizerScratchMono.mutableBytes;
    if (!monoPtr) {
        return;
    }

    vDSP_vclr(monoPtr, 1, frameCount);

    AudioBuffer buffer = bufferList->mBuffers[0];
    BOOL interleaved = (numberBuffers == 1 && buffer.mNumberChannels > 1);

    if (interleaved) {
        float *samples = (float *)buffer.mData;
        UInt32 channels = MAX(1u, buffer.mNumberChannels);
        if (!samples) {
            return;
        }

        size_t availableFrames = (channels > 0) ? (buffer.mDataByteSize / (sizeof(float) * channels)) : 0;
        size_t framesToProcess = MIN((size_t)frameCount, availableFrames);
        if (framesToProcess == 0) {
            return;
        }

        float addFactor = 1.0f;
        for (UInt32 channel = 0; channel < channels; channel++) {
            vDSP_vsma(samples + channel, channels, &addFactor, monoPtr, 1, monoPtr, 1, framesToProcess);
        }

        float scale = (channels > 0) ? (1.0f / (float)channels) : 1.0f;
        vDSP_vsmul(monoPtr, 1, &scale, monoPtr, 1, framesToProcess);
    } else {
        NSUInteger contributingBuffers = 0;
        for (UInt32 bufferIndex = 0; bufferIndex < numberBuffers; bufferIndex++) {
            AudioBuffer currentBuffer = bufferList->mBuffers[bufferIndex];
            const float *samples = (const float *)currentBuffer.mData;
            if (!samples) {
                continue;
            }

            UInt32 channels = MAX(1u, currentBuffer.mNumberChannels);
            size_t availableFrames = (channels > 0)
                                         ? (currentBuffer.mDataByteSize / (sizeof(float) * channels))
                                         : 0;
            size_t framesToProcess = MIN((size_t)frameCount, availableFrames);
            if (framesToProcess == 0) {
                continue;
            }

            float addFactor = 1.0f;
            if (channels == 1) {
                vDSP_vsma(samples, 1, &addFactor, monoPtr, 1, monoPtr, 1, framesToProcess);
            } else {
                for (UInt32 channel = 0; channel < channels; channel++) {
                    vDSP_vsma(samples + channel, channels, &addFactor, monoPtr, 1, monoPtr, 1, framesToProcess);
                }
            }
            contributingBuffers += 1;
        }

        float scale = (contributingBuffers > 0) ? (1.0f / (float)contributingBuffers) : 1.0f;
        vDSP_vsmul(monoPtr, 1, &scale, monoPtr, 1, frameCount);
    }

    size_t minimumCapacity = MAX((size_t)(self.visualizerFFTSize * 4), (size_t)frameCount + self.visualizerFFTSize);
    if (!VisualizerRingBufferEnsureCapacity(&_visualizerRingBuffer, minimumCapacity)) {
        return;
    }
    VisualizerRingBufferWrite(&_visualizerRingBuffer, monoPtr, frameCount);

    [self scheduleVisualizerDrain];
}

- (void)scheduleVisualizerDrain
{
    if (!self.visualizerQueue || !self.visualizerEnabled) {
        return;
    }

    if (!atomic_flag_test_and_set_explicit(&_visualizerDrainScheduled, memory_order_acq_rel)) {
        dispatch_async(self.visualizerQueue, ^{
            [self drainVisualizerRingBuffer];
            atomic_flag_clear_explicit(&_visualizerDrainScheduled, memory_order_release);
        });
    }
}

- (void)drainVisualizerRingBuffer
{
    if (!self.visualizerEnabled) {
        VisualizerRingBufferReset(&_visualizerRingBuffer);
        return;
    }

    NSUInteger fftSize = self.visualizerFFTSize;
    NSUInteger hopSize = self.visualizerHopSize;
    if (fftSize == 0 || hopSize == 0) {
        return;
    }

    const size_t requiredFrameBytes = (size_t)fftSize * sizeof(float);

    while (VisualizerRingBufferReadable(&_visualizerRingBuffer) >= fftSize) {
        if (self.visualizerFrameBuffer.length < requiredFrameBytes) {
            self.visualizerFrameBuffer.length = requiredFrameBytes;
        }

        float *frameBuffer = (float *)self.visualizerFrameBuffer.mutableBytes;
        if (!frameBuffer) {
            break;
        }

        if (!VisualizerRingBufferCopy(&_visualizerRingBuffer, frameBuffer, fftSize)) {
            break;
        }

        [self processVisualizerFrameWithSamples:frameBuffer];
        VisualizerRingBufferConsume(&_visualizerRingBuffer, hopSize);
    }
}

- (void)processVisualizerFrameWithSamples:(const float *)samples
{
    if (!samples || !self.visualizerEnabled || !self.visualizerFFTSetup) {
        return;
    }

    NSTimeInterval now = CFAbsoluteTimeGetCurrent();
    if (self.visualizerThrottleInterval > 0 && (now - self.visualizerLastEmitTime) < self.visualizerThrottleInterval) {
        return;
    }

    NSUInteger fftSize = self.visualizerFFTSize;
    if (fftSize == 0) {
        return;
    }

    NSTimeInterval processStart = CFAbsoluteTimeGetCurrent();

    if (self.visualizerFrameBuffer.length < fftSize * sizeof(float)) {
        self.visualizerFrameBuffer.length = fftSize * sizeof(float);
    }

    float *frameBuffer = (float *)self.visualizerFrameBuffer.mutableBytes;
    float *windowPtr = (float *)self.visualizerWindow.mutableBytes;
    if (!frameBuffer || !windowPtr) {
        return;
    }

    memcpy(frameBuffer, samples, fftSize * sizeof(float));
    vDSP_vmul(frameBuffer, 1, windowPtr, 1, frameBuffer, 1, fftSize);

    float rms = 0;
    vDSP_rmsqv(frameBuffer, 1, &rms, fftSize);

    DSPSplitComplex splitComplex;
    splitComplex.realp = (float *)self.visualizerReal.mutableBytes;
    splitComplex.imagp = (float *)self.visualizerImag.mutableBytes;
    if (!splitComplex.realp || !splitComplex.imagp) {
        return;
    }

    vDSP_ctoz((DSPComplex *)frameBuffer, 2, &splitComplex, 1, fftSize / 2);
    vDSP_fft_zrip(self.visualizerFFTSetup, &splitComplex, 1, self.visualizerLog2n, kFFTDirection_Forward);

    float scale = 1.0f / (float)fftSize;
    vDSP_vsmul(splitComplex.realp, 1, &scale, splitComplex.realp, 1, fftSize / 2);
    vDSP_vsmul(splitComplex.imagp, 1, &scale, splitComplex.imagp, 1, fftSize / 2);

    float *magnitudes = (float *)self.visualizerMagnitudes.mutableBytes;
    if (!magnitudes) {
        return;
    }
    vDSP_zvabs(&splitComplex, 1, magnitudes, 1, fftSize / 2);

    NSUInteger bins = MIN(self.visualizerBinCount, fftSize / 2);
    if (bins == 0) {
        return;
    }

    if (self.visualizerSmoothedBins.length < bins * sizeof(float)) {
        self.visualizerSmoothedBins.length = bins * sizeof(float);
    }

    float *smoothed = (float *)self.visualizerSmoothedBins.mutableBytes;
    if (!smoothed) {
        return;
    }

    NSUInteger spectrumSize = fftSize / 2;
    float smoothing = fminf(fmaxf(self.visualizerSmoothingFactor, 0.0f), 0.99f);

    if (self.visualizerBinStartIndices.length < bins * sizeof(NSUInteger) ||
        self.visualizerBinEndIndices.length < bins * sizeof(NSUInteger)) {
        [self recalculateVisualizerBinMappingWithSpectrumSize:spectrumSize];
    }

    const NSUInteger *binStarts = (const NSUInteger *)self.visualizerBinStartIndices.bytes;
    const NSUInteger *binEnds = (const NSUInteger *)self.visualizerBinEndIndices.bytes;
    float *windowScales = (float *)self.visualizerBinWindowScale.mutableBytes;
    float *emphasisFactors = (float *)self.visualizerBinEmphasisFactors.mutableBytes;
    float *gammaVector = (float *)self.visualizerGammaVector.mutableBytes;
    if (!self.visualizerBinScratch) {
        self.visualizerBinScratch = [NSMutableData dataWithLength:bins * sizeof(float)];
    } else if (self.visualizerBinScratch.length < bins * sizeof(float)) {
        [self.visualizerBinScratch setLength:bins * sizeof(float)];
    }
    float *binScratch = (float *)self.visualizerBinScratch.mutableBytes;

    if (!binScratch) {
        return;
    }

    if (!self.visualizerPrefixSums || self.visualizerPrefixSums.length < (spectrumSize + 1) * sizeof(float)) {
        self.visualizerPrefixSums = [NSMutableData dataWithLength:(spectrumSize + 1) * sizeof(float)];
    }
    float *prefix = (float *)self.visualizerPrefixSums.mutableBytes;
    if (!prefix) {
        return;
    }
    prefix[0] = 0.0f;
    if (spectrumSize > 0) {
        vDSP_vrsum(magnitudes, 1, prefix + 1, 1, spectrumSize);
    }

    for (NSUInteger bin = 0; bin < bins; bin++) {
        NSUInteger start = binStarts ? binStarts[bin] : bin;
        NSUInteger end = binEnds ? binEnds[bin] : (start + 1);

        if (start >= spectrumSize) {
            start = spectrumSize > 0 ? spectrumSize - 1 : 0;
        }
        if (end <= start) {
            end = MIN(start + 1, spectrumSize);
        }
        if (end > spectrumSize) {
            end = spectrumSize;
        }

        float sum = prefix[end] - prefix[start];
        float scale = 1.0f;
        if (windowScales) {
            scale = windowScales[bin];
        } else {
            NSUInteger windowLength = end > start ? (end - start) : 1;
            scale = windowLength > 0 ? (1.0f / (float)windowLength) : 1.0f;
        }
        binScratch[bin] = sum * scale;
    }

    const float epsilon = 1.0e-7f;
    vDSP_vsadd(binScratch, 1, &epsilon, binScratch, 1, bins);

    float zeroReference = 1.0f;
    vDSP_vdbcon(binScratch, 1, binScratch, 1, bins, &zeroReference);

    float offset = -kVisualizerMinDecibels;
    vDSP_vsadd(binScratch, 1, &offset, binScratch, 1, bins);
    float invRange = kVisualizerMaxDecibels - kVisualizerMinDecibels;
    if (invRange <= 0.0f) {
        invRange = 1.0f;
    }
    float invRangeScalar = 1.0f / invRange;
    vDSP_vsmul(binScratch, 1, &invRangeScalar, binScratch, 1, bins);

    float lower = 0.0f;
    float upper = 1.0f;
    vDSP_vclip(binScratch, 1, &lower, &upper, binScratch, 1, bins);

    if (emphasisFactors) {
        vDSP_vmul(binScratch, 1, emphasisFactors, 1, binScratch, 1, bins);
        vDSP_vclip(binScratch, 1, &lower, &upper, binScratch, 1, bins);
    }

    if (gammaVector) {
        int count = (int)bins;
        vvpowf(binScratch, binScratch, gammaVector, &count);
    }

    float oneMinusSmoothing = 1.0f - smoothing;
    vDSP_vsmul(smoothed, 1, &smoothing, smoothed, 1, bins);
    vDSP_vsmsa(binScratch, 1, &oneMinusSmoothing, smoothed, 1, smoothed, 1, bins);

    NSTimeInterval processDuration = CFAbsoluteTimeGetCurrent() - processStart;
    const NSTimeInterval cpuBudget = 0.004; // ~4ms budget
    if (processDuration > cpuBudget) {
        self.visualizerCPUOverrunFrames += 1;
    } else {
        self.visualizerCPUOverrunFrames = 0;
    }

    if (self.visualizerCPUOverrunFrames >= 3) {
        self.visualizerCPUOverrunFrames = 0;
        NSUInteger newBinCount = MAX(16u, self.visualizerBinCount / 2);
        if (newBinCount < self.visualizerBinCount) {
            self.visualizerBinCount = newBinCount;
            self.visualizerSmoothedBins.length = newBinCount * sizeof(float);
            memset(self.visualizerSmoothedBins.mutableBytes, 0, self.visualizerSmoothedBins.length);
            [self recalculateVisualizerBinMappingWithSpectrumSize:spectrumSize];
        }
        VisualizerRingBufferReset(&_visualizerRingBuffer);
        self.visualizerThrottleInterval = MAX(self.visualizerThrottleInterval, 0.05);
        RCTLogWarn(@"Visualizer processing taking %.2f ms, reducing resolution to %lu bins and throttle %.0f ms",
                   processDuration * 1000.0,
                   (unsigned long)self.visualizerBinCount,
                   self.visualizerThrottleInterval * 1000.0);
        return;
    }

    self.visualizerLastEmitTime = now;
    [self sendVisualizerEventWithRMS:rms bins:smoothed count:bins];
}

- (void)sendVisualizerEventWithRMS:(float)rms bins:(const float *)bins count:(NSUInteger)count
{
    if (!self.hasListeners || !bins || count == 0) {
        return;
    }

    NSMutableArray<NSNumber *> *binArray = [NSMutableArray arrayWithCapacity:count];
    for (NSUInteger index = 0; index < count; index++) {
        [binArray addObject:@(bins[index])];
    }

    NSDictionary *payload = @{
        @"rms": @(rms),
        @"bins": binArray,
        @"timestamp": @(CFAbsoluteTimeGetCurrent())
    };

    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.hasListeners && self.visualizerEnabled && self.visualizerActive) {
            [self sendEventWithName:@"onVisualizerFrame" body:payload];
        }
    });
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
    [self removeVisualizerTap];
    VisualizerRingBufferDeallocate(&_visualizerRingBuffer);
    if (self.visualizerFFTSetup) {
        vDSP_destroy_fftsetup(self.visualizerFFTSetup);
        self.visualizerFFTSetup = NULL;
    }
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

            [self removeVisualizerTap];

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

RCT_EXPORT_METHOD(configureVisualizer:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        BOOL enabled = [[config objectForKey:@"enabled"] boolValue];
        NSNumber *fftSizeValue = config[@"fftSize"];
        NSNumber *binCountValue = config[@"binCount"];
        NSNumber *smoothingValue = config[@"smoothing"];
        NSNumber *throttleMsValue = config[@"throttleMs"];

        BOOL needsFFTRebuild = NO;
        if (fftSizeValue) {
            NSUInteger requestedFFT = [fftSizeValue unsignedIntegerValue];
            requestedFFT = [self validatedFFTSizeFromRequested:requestedFFT];
            if (requestedFFT != self.visualizerFFTSize) {
                self.visualizerFFTSize = requestedFFT;
                needsFFTRebuild = YES;
            }
        }

        if (binCountValue) {
            NSUInteger requestedBins = [binCountValue unsignedIntegerValue];
            requestedBins = MAX(8u, requestedBins);
            requestedBins = MIN(requestedBins, self.visualizerFFTSize / 2);
            if (requestedBins == 0) {
                requestedBins = kDefaultVisualizerBinCount;
            }
            if (requestedBins != self.visualizerBinCount) {
                self.visualizerBinCount = requestedBins;
                needsFFTRebuild = YES;
            }
        }

        if (smoothingValue) {
            float smoothing = [smoothingValue floatValue];
            smoothing = fminf(fmaxf(smoothing, 0.0f), 0.99f);
            self.visualizerSmoothingFactor = smoothing;
        }

        if (throttleMsValue) {
            double throttleMs = [throttleMsValue doubleValue];
            if (throttleMs <= 0) {
                self.visualizerThrottleInterval = 0;
            } else {
                self.visualizerThrottleInterval = throttleMs / 1000.0;
            }
        }

        self.visualizerEnabled = enabled;
        self.visualizerActive = enabled && self.isPlaying;

        if (needsFFTRebuild) {
            [self rebuildVisualizerFFTResources];
        } else {
            [self resetVisualizerProcessingState];
        }

        if (self.visualizerEnabled) {
            [self installVisualizerTapIfNeeded];
        } else {
            [self removeVisualizerTap];
        }

        resolve(@{@"success": @YES});
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

            // Install visualizer tap now that item is ready (but not playing yet)
            // This is the safest time to attach the audioMix
            if (self.visualizerEnabled && !self.visualizerTap) {
                [self installVisualizerTapIfNeeded];
            }

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

        // Start playback first so we do not block waiting on the visualizer tap
        [self.player play];
        self.isPlaying = YES;
        self.visualizerActive = self.visualizerEnabled;

        // Install the visualizer tap after playback has started to avoid stalling the player
        if (self.visualizerEnabled && !self.visualizerTap) {
            __weak typeof(self) weakSelf = self;
            dispatch_async(dispatch_get_main_queue(), ^{
                __strong typeof(weakSelf) strongSelf = weakSelf;
                if (!strongSelf) {
                    return;
                }

                [strongSelf installVisualizerTapIfNeeded];

                // If installing the tap paused the player, resume playback.
                if (strongSelf.isPlaying && strongSelf.player && strongSelf.player.rate == 0.0f) {
                    [strongSelf.player play];
                }
            });
        }

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
        self.visualizerActive = NO;
        [self removeTimeObserver];
        [self updateNowPlayingPlaybackState:NO];
        [self resetVisualizerProcessingState];
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
        self.visualizerActive = NO;
        [self removeTimeObserver];
        [self updateNowPlayingElapsedTime:self.currentTime];
        [self updateNowPlayingPlaybackState:NO];
        [self resetVisualizerProcessingState];
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
