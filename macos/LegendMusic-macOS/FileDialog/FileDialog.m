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
      NSArray *allowedFileTypes = [options objectForKey:@"allowedFileTypes"];

      panel.canChooseFiles = [canChooseFiles boolValue];
      panel.canChooseDirectories = [canChooseDirectories boolValue];
      panel.allowsMultipleSelection = [allowsMultipleSelection boolValue];
      panel.resolvesAliases = YES;
      panel.treatsFilePackagesAsDirectories = YES;

      if ([allowedFileTypes isKindOfClass:[NSArray class]] && allowedFileTypes.count > 0 && panel.canChooseFiles) {
        panel.allowedFileTypes = allowedFileTypes;
        panel.allowsOtherFileTypes = NO;
      }

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
    } @catch (NSException *exception) {
      reject(@"file_dialog_error", exception.reason, nil);
    }
  });
}

RCT_EXPORT_METHOD(revealInFinder:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      if (![path isKindOfClass:[NSString class]] || path.length == 0) {
        resolve(@(NO));
        return;
      }

      NSString *expandedPath = [path stringByExpandingTildeInPath];
      NSURL *inputURL = [NSURL URLWithString:expandedPath];
      NSURL *fileURL = nil;

      if (inputURL && inputURL.isFileURL) {
        fileURL = inputURL;
      } else {
        fileURL = [NSURL fileURLWithPath:expandedPath];
      }

      if (!fileURL || fileURL.path.length == 0) {
        resolve(@(NO));
        return;
      }

      BOOL exists = [[NSFileManager defaultManager] fileExistsAtPath:fileURL.path];
      if (!exists) {
        resolve(@(NO));
        return;
      }

      [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[fileURL]];
      resolve(@(YES));
    } @catch (NSException *exception) {
      reject(@"file_dialog_error", exception.reason, nil);
    }
  });
}

@end
