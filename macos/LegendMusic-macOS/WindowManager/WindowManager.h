#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface WindowManager : RCTEventEmitter <RCTBridgeModule>

+ (NSWindow *)getMainWindow;
- (void)setupMainWindowObservers;

@end