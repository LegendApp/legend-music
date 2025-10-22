#import <React/RCTViewManager.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RNDragDrop, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(allowedFileTypes, NSArray)
RCT_EXPORT_VIEW_PROPERTY(onDragEnter, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onDragLeave, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onDrop, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onTrackDragEnter, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onTrackDragLeave, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onTrackDragHover, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onTrackDrop, RCTDirectEventBlock)

@end
