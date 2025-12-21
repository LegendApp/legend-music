#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(RNSidebarSplitView, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(onSplitViewDidResize, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(sidebarMinWidth, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(contentMinWidth, NSNumber)

@end
