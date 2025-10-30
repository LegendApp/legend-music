#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@class AudioPlayer;

#ifdef __cplusplus
extern "C" {
#endif

void AudioPlayerScheduleVisualizerJSIInstallation(
    AudioPlayer *_Nullable player,
    RCTPromiseResolveBlock _Nonnull resolve,
    RCTPromiseRejectBlock _Nonnull reject);

void AudioPlayerUpdateVisualizerJSIState(
    AudioPlayer *_Nullable player,
    const float *_Nonnull bins,
    NSUInteger count,
    float rms,
    NSTimeInterval timestamp);

void AudioPlayerResetVisualizerJSIState(AudioPlayer *_Nullable player);

#ifdef __cplusplus
}
#endif
