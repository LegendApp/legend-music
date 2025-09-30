#import "FileDialogManager.h"

#import <AppKit/AppKit.h>
#import <React/RCTUtils.h>

@implementation FileDialogManager

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(showSaveDialog:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSSavePanel *panel = [NSSavePanel savePanel];
  panel.canCreateDirectories = YES;
  panel.showsTagField = NO;

  NSString *defaultName = [options objectForKey:@"defaultName"];
  if ([defaultName isKindOfClass:[NSString class]] && defaultName.length > 0) {
    panel.nameFieldStringValue = defaultName;
  }

  NSArray *allowedTypes = [options objectForKey:@"allowedFileTypes"];
  if ([allowedTypes isKindOfClass:[NSArray class]] && allowedTypes.count > 0) {
    panel.allowedFileTypes = allowedTypes;
  }

  NSString *directory = [options objectForKey:@"directory"];
  if ([directory isKindOfClass:[NSString class]] && directory.length > 0) {
    NSURL *directoryURL = [NSURL fileURLWithPath:directory isDirectory:YES];
    if (directoryURL != nil) {
      panel.directoryURL = directoryURL;
    }
  }

  [panel beginWithCompletionHandler:^(NSModalResponse result) {
    if (result == NSModalResponseOK) {
      NSURL *selectedURL = panel.URL;
      if (selectedURL != nil) {
        resolve(selectedURL.path);
        return;
      }
    }

    resolve([NSNull null]);
  }];
}

@end
