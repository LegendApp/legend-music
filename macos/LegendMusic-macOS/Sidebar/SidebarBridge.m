#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(LMSidebar, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(items, NSArray)
RCT_EXPORT_VIEW_PROPERTY(selectedId, NSString)
RCT_EXPORT_VIEW_PROPERTY(contentInsetTop, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(onSidebarSelectionChange, RCTBubblingEventBlock)

@end
