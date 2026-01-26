#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(RNNativeButton, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(sfSymbol, NSString)
RCT_EXPORT_VIEW_PROPERTY(title, NSString)
RCT_EXPORT_VIEW_PROPERTY(disabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(selected, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onPress, RCTBubblingEventBlock)

@end
