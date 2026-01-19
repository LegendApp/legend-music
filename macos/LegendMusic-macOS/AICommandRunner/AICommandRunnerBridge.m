#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AICommandRunner, NSObject)

RCT_EXTERN_METHOD(getAvailability:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(runCommand:(NSDictionary *)params
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
