#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(RNTrackDragSource, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(trackPayload, NSArray)
RCT_EXPORT_VIEW_PROPERTY(onDragStart, RCTDirectEventBlock)

@end
