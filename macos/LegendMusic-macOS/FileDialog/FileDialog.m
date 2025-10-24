#import "FileDialog.h"

#import <AppKit/AppKit.h>

@implementation FileDialog

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (NSURL *)urlFromString:(id)value
{
  if (![value isKindOfClass:[NSString class]]) {
    return nil;
  }

  NSString *stringValue = (NSString *)value;
  if (stringValue.length == 0) {
    return nil;
  }

  NSURL *URL = [NSURL URLWithString:stringValue];
  if (URL && URL.isFileURL) {
    return URL;
  }

  return [NSURL fileURLWithPath:stringValue isDirectory:YES];
}

- (NSArray<NSString *> *)pathsFromUrls:(NSArray<NSURL *> *)urls
{
  NSMutableArray<NSString *> *paths = [NSMutableArray arrayWithCapacity:urls.count];
  for (NSURL *URL in urls) {
    if (URL.path.length > 0) {
      [paths addObject:URL.path];
    }
  }
  return [paths copy];
}

RCT_EXPORT_METHOD(open:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      NSOpenPanel *panel = [NSOpenPanel openPanel];
      NSNumber *canChooseFiles = options[@"canChooseFiles"] ?: @(YES);
      NSNumber *canChooseDirectories = options[@"canChooseDirectories"] ?: @(NO);
      NSNumber *allowsMultipleSelection = options[@"allowsMultipleSelection"] ?: @(NO);
      id directoryURLValue = options[@"directoryURL"];

      panel.canChooseFiles = [canChooseFiles boolValue];
      panel.canChooseDirectories = [canChooseDirectories boolValue];
      panel.allowsMultipleSelection = [allowsMultipleSelection boolValue];
      panel.resolvesAliases = YES;
      panel.treatsFilePackagesAsDirectories = YES;

      NSURL *directoryURL = [self urlFromString:directoryURLValue];
      if (directoryURL) {
        panel.directoryURL = directoryURL;
      }

      NSInteger result = [panel runModal];
      if (result == NSModalResponseOK) {
        resolve([self pathsFromUrls:panel.URLs]);
      } else {
        resolve(nil);
      }
    } @catch (NSException *exception) {
      reject(@"file_dialog_error", exception.reason, nil);
    }
  });
}

RCT_EXPORT_METHOD(save:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      NSSavePanel *panel = [NSSavePanel savePanel];
      id directoryURLValue = options[@"directoryURL"];
      NSString *suggestedFileName = options[@"suggestedFileName"];

      if ([directoryURLValue isKindOfClass:[NSString class]]) {
        NSURL *directoryURL = [self urlFromString:directoryURLValue];
        if (directoryURL) {
          panel.directoryURL = directoryURL;
        }
      }

      if ([suggestedFileName isKindOfClass:[NSString class]] && suggestedFileName.length > 0) {
        panel.nameFieldStringValue = suggestedFileName;
      }

      NSInteger result = [panel runModal];
      if (result == NSModalResponseOK) {
        NSURL *URL = panel.URL;
        resolve(URL.path.length > 0 ? URL.path : nil);
      } else {
        resolve(nil);
      }
    } @catch (NSException *exception) {
      reject(@"file_dialog_error", exception.reason, nil);
    }
  });
}

@end
