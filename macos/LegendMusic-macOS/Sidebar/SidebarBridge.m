#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(RNSidebar, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(items, NSArray)
RCT_EXPORT_VIEW_PROPERTY(selectedId, NSString)
RCT_EXPORT_VIEW_PROPERTY(onSelectionChange, RCTBubblingEventBlock)

@end
