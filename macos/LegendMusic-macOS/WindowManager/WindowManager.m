#import "WindowManager.h"
#import <React/RCTRootView.h>
#import <React/RCTBridge.h>
#import <AppKit/AppKit.h>
#import <CoreImage/CoreImage.h>
#import <QuartzCore/QuartzCore.h>

static inline NSAppearance *LegendDarkAppearance() {
  if (@available(macOS 10.14, *)) {
    return [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
  } else if (@available(macOS 10.10, *)) {
    return [NSAppearance appearanceNamed:NSAppearanceNameVibrantDark];
  }
  return nil;
}

static void LegendApplyTitleVisibility(NSWindow *window, NSString *value) {
  if (![value isKindOfClass:[NSString class]] || value.length == 0) {
    return;
  }

  if ([value isEqualToString:@"hidden"]) {
    window.titleVisibility = NSWindowTitleHidden;
  } else if ([value isEqualToString:@"visible"]) {
    window.titleVisibility = NSWindowTitleVisible;
  }
}

static void LegendApplyToolbarStyle(NSWindow *window, NSString *value) {
  if (![value isKindOfClass:[NSString class]] || value.length == 0) {
    return;
  }

  if (@available(macOS 11.0, *)) {
    if ([value isEqualToString:@"automatic"]) {
      window.toolbarStyle = NSWindowToolbarStyleAutomatic;
    } else if ([value isEqualToString:@"expanded"]) {
      window.toolbarStyle = NSWindowToolbarStyleExpanded;
    } else if ([value isEqualToString:@"preference"]) {
      window.toolbarStyle = NSWindowToolbarStylePreference;
    } else if ([value isEqualToString:@"unified"]) {
      window.toolbarStyle = NSWindowToolbarStyleUnified;
    } else if ([value isEqualToString:@"unifiedCompact"]) {
      window.toolbarStyle = NSWindowToolbarStyleUnifiedCompact;
    }
  }
}

@interface WindowManager() <NSWindowDelegate>
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSWindow *> *windows;
@property (nonatomic, strong) NSMutableDictionary<NSString *, RCTRootView *> *rootViews;
@property (nonatomic, strong) NSMutableDictionary<NSString *, CIFilter *> *windowBlurFilters;
- (nullable NSDictionary *)initialPropsFromOptions:(NSDictionary *)options;
@end

@implementation WindowManager

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (NSDictionary *)constantsToExport
{
  return @{
    @"STYLE_MASK_BORDERLESS": @(NSWindowStyleMaskBorderless),
    @"STYLE_MASK_TITLED": @(NSWindowStyleMaskTitled),
    @"STYLE_MASK_CLOSABLE": @(NSWindowStyleMaskClosable),
    @"STYLE_MASK_MINIATURIZABLE": @(NSWindowStyleMaskMiniaturizable),
    @"STYLE_MASK_RESIZABLE": @(NSWindowStyleMaskResizable),
    @"STYLE_MASK_UNIFIED_TITLE_AND_TOOLBAR": @(NSWindowStyleMaskUnifiedTitleAndToolbar),
    @"STYLE_MASK_FULL_SCREEN": @(NSWindowStyleMaskFullScreen),
    @"STYLE_MASK_FULL_SIZE_CONTENT_VIEW": @(NSWindowStyleMaskFullSizeContentView),
    @"STYLE_MASK_UTILITY_WINDOW": @(NSWindowStyleMaskUtilityWindow),
    @"STYLE_MASK_DOC_MODAL_WINDOW": @(NSWindowStyleMaskDocModalWindow),
    @"STYLE_MASK_NONACTIVATING_PANEL": @(NSWindowStyleMaskNonactivatingPanel),
    @"WINDOW_LEVEL_NORMAL": @(NSNormalWindowLevel),
    @"WINDOW_LEVEL_FLOATING": @(NSFloatingWindowLevel),
    @"WINDOW_LEVEL_MODAL_PANEL": @(NSModalPanelWindowLevel),
    @"WINDOW_LEVEL_MAIN_MENU": @(NSMainMenuWindowLevel),
    @"WINDOW_LEVEL_STATUS": @(NSStatusWindowLevel),
    @"WINDOW_LEVEL_SCREEN_SAVER": @(NSScreenSaverWindowLevel)
  };
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _windows = [NSMutableDictionary new];
    _rootViews = [NSMutableDictionary new];
    _windowBlurFilters = [NSMutableDictionary new];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onWindowClosed", @"onMainWindowMoved", @"onMainWindowResized", @"onWindowFocused"];
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(openWindow:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *identifier = options[@"identifier"];
  NSString *moduleName = options[@"moduleName"];
  NSAppearance *darkAppearance = LegendDarkAppearance();

  if (![moduleName isKindOfClass:[NSString class]] || moduleName.length == 0) {
    moduleName = identifier;
  }

  if (![identifier isKindOfClass:[NSString class]] || identifier.length == 0) {
    identifier = moduleName ?: @"default";
  }

  NSString *title = options[@"title"] ?: moduleName ?: @"New Window";

  NSDictionary *windowStyle = options[@"windowStyle"];
  NSNumber *maskNumber = windowStyle[@"mask"];
  NSNumber *transparentTitlebar = windowStyle[@"titlebarAppearsTransparent"];
  NSString *titleVisibility = windowStyle[@"titleVisibility"];
  NSString *toolbarStyle = windowStyle[@"toolbarStyle"];
  NSNumber *levelNumber = options[@"level"];
  BOOL transparentBackground = [options[@"transparentBackground"] boolValue];
  NSNumber *hasShadowNumber = options[@"hasShadow"];
  BOOL shouldApplyHasShadow = hasShadowNumber != nil;
  BOOL hasShadow = shouldApplyHasShadow ? [hasShadowNumber boolValue] : NO;

  NSNumber *animateFrameChangeNumber = options[@"animateFrameChange"];
  BOOL animateFrameChange = animateFrameChangeNumber ? [animateFrameChangeNumber boolValue] : NO;
  NSNumber *frameAnimationDurationNumber = options[@"frameAnimationDurationMs"];
  NSTimeInterval frameAnimationDuration = frameAnimationDurationNumber ? ([frameAnimationDurationNumber doubleValue] / 1000.0) : 0;

  NSNumber *widthNumber = windowStyle[@"width"] ?: options[@"width"];
  NSNumber *heightNumber = windowStyle[@"height"] ?: options[@"height"];
  CGFloat width = widthNumber ? [widthNumber floatValue] : 400;
  CGFloat height = heightNumber ? [heightNumber floatValue] : 300;

  NSNumber *originX = options[@"x"];
  NSNumber *originY = options[@"y"];

  NSWindow *existingWindow = self.windows[identifier];
  if (existingWindow) {
    RCTRootView *existingRootView = self.rootViews[identifier];
    NSRect frame = [existingWindow frame];
    CGFloat newWidth = frame.size.width;
    CGFloat newHeight = frame.size.height;

    BOOL hasWidth = widthNumber != nil;
    BOOL hasHeight = heightNumber != nil;

    if (hasWidth) {
      newWidth = width;
    }

    if (hasHeight) {
      newHeight = height;
    }

    NSPoint origin = frame.origin;
    if (originX) {
      origin.x = [originX doubleValue];
    }

    if (originY) {
      origin.y = [originY doubleValue];
    }

    NSRect newFrame = NSMakeRect(origin.x, origin.y, newWidth, newHeight);
    if (animateFrameChange && frameAnimationDuration > 0) {
      [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
        context.duration = frameAnimationDuration;
        context.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
        [[existingWindow animator] setFrame:newFrame display:YES];
      } completionHandler:nil];
    } else {
      [existingWindow setFrame:newFrame display:YES animate:animateFrameChange];
    }

    if (maskNumber) {
      [existingWindow setStyleMask:[maskNumber unsignedIntegerValue]];
    }

    if (transparentTitlebar != nil) {
      [existingWindow setTitlebarAppearsTransparent:[transparentTitlebar boolValue]];
    }
    LegendApplyTitleVisibility(existingWindow, titleVisibility);
    LegendApplyToolbarStyle(existingWindow, toolbarStyle);

    if (levelNumber) {
      [existingWindow setLevel:[levelNumber integerValue]];
      [existingWindow orderFrontRegardless];
    }

    if (shouldApplyHasShadow) {
      [existingWindow setHasShadow:hasShadow];
      if (hasShadow) {
        [existingWindow invalidateShadow];
      }
    }

    if (transparentBackground) {
      [existingWindow setOpaque:NO];
      [existingWindow setBackgroundColor:[NSColor clearColor]];
      NSView *contentView = existingWindow.contentView;
      contentView.wantsLayer = YES;
      contentView.layer.backgroundColor = [NSColor clearColor].CGColor;
      contentView.layer.masksToBounds = NO;
      existingRootView.backgroundColor = [NSColor clearColor];
    }

    existingWindow.title = title;

    if (darkAppearance) {
      existingWindow.appearance = darkAppearance;
    }

    existingWindow.delegate = self;

    NSDictionary *initialProps = [self initialPropsFromOptions:options];
    if (existingRootView && initialProps) {
      existingRootView.appProperties = initialProps;
    }

    [existingWindow makeKeyAndOrderFront:nil];
    resolve(@{@"success": @YES});
    return;
  }

  NSUInteger styleMask = maskNumber ? [maskNumber unsignedIntegerValue] : (NSWindowStyleMaskTitled |
                        NSWindowStyleMaskClosable |
                        NSWindowStyleMaskResizable |
                        NSWindowStyleMaskMiniaturizable);

  NSRect frame = NSMakeRect(0, 0, width, height);

  NSWindow *window = [[NSWindow alloc] initWithContentRect:frame
                                               styleMask:styleMask
                                                 backing:NSBackingStoreBuffered
                                                   defer:NO];

  if (darkAppearance) {
    window.appearance = darkAppearance;
  }

  [window setReleasedWhenClosed:NO];
  [window setTitle:title];
  if (transparentTitlebar != nil) {
    [window setTitlebarAppearsTransparent:[transparentTitlebar boolValue]];
  }
  LegendApplyTitleVisibility(window, titleVisibility);
  LegendApplyToolbarStyle(window, toolbarStyle);

  if (levelNumber) {
    [window setLevel:[levelNumber integerValue]];
  }

  if (shouldApplyHasShadow) {
    [window setHasShadow:hasShadow];
    if (hasShadow) {
      [window invalidateShadow];
    }
  }

  if (transparentBackground) {
    [window setOpaque:NO];
    [window setBackgroundColor:[NSColor clearColor]];
    window.contentView.wantsLayer = YES;
    window.contentView.layer.masksToBounds = NO;
  }

  if (originX || originY) {
    NSRect currentFrame = [window frame];
    NSPoint origin = currentFrame.origin;
    if (originX) {
      origin.x = [originX doubleValue];
    }
    if (originY) {
      origin.y = [originY doubleValue];
    }
    [window setFrameOrigin:origin];
  } else {
    [window center];
  }

  RCTBridge *bridge = self.bridge;
  if (!bridge) {
    reject(@"no_bridge", @"RCTBridge not available", nil);
    return;
  }

  NSDictionary *initialProps = [self initialPropsFromOptions:options];

  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                   moduleName:moduleName
                                            initialProperties:initialProps];

  [window setContentView:rootView];
  if (transparentBackground) {
    rootView.backgroundColor = [NSColor clearColor];
    window.contentView.wantsLayer = YES;
    window.contentView.layer.backgroundColor = [NSColor clearColor].CGColor;
    window.contentView.layer.masksToBounds = NO;
  }
  rootView.wantsLayer = YES;
  rootView.layerUsesCoreImageFilters = YES;
  if (!rootView.layer) {
    rootView.layer = [CALayer layer];
  }
  rootView.layer.masksToBounds = NO;
  [window setDelegate:self];

  self.windows[identifier] = window;
  self.rootViews[identifier] = rootView;

  [window makeKeyAndOrderFront:nil];
  if (levelNumber) {
    [window orderFrontRegardless];
  }

  resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(closeWindow:(NSString *)identifier
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *targetIdentifier = identifier;
  if (![targetIdentifier isKindOfClass:[NSString class]] || targetIdentifier.length == 0) {
    targetIdentifier = @"default";
  }

  NSWindow *window = self.windows[targetIdentifier];
  if (!window) {
    resolve(@{@"success": @NO, @"message": @"No window to close"});
    return;
  }

  [window orderOut:nil];
  [self handleWindowClosedForIdentifier:targetIdentifier];

  resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(closeFrontmostWindow:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSWindow *window = [NSApp keyWindow] ?: [NSApp mainWindow];
  if (!window) {
    resolve(@{@"success": @NO, @"message": @"No window to close"});
    return;
  }

  [window performClose:nil];
  resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(setWindowBlur:(NSString *)identifier
                  radius:(nonnull NSNumber *)radiusNumber
                  duration:(nonnull NSNumber *)durationNumber
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *targetIdentifier = identifier;
  if (![targetIdentifier isKindOfClass:[NSString class]] || targetIdentifier.length == 0) {
    targetIdentifier = @"default";
  }

  NSWindow *window = self.windows[targetIdentifier];
  if (!window) {
    reject(@"window_not_found", @"Target window not found for blur animation", nil);
    return;
  }

  RCTRootView *rootView = self.rootViews[targetIdentifier];
  NSView *contentView = window.contentView ?: rootView;
  if (!contentView) {
    reject(@"no_content_view", @"Window does not have a content view to blur", nil);
    return;
  }

  contentView.wantsLayer = YES;
  contentView.layerUsesCoreImageFilters = YES;
  if (!contentView.layer) {
    contentView.layer = [CALayer layer];
  }
  contentView.layer.masksToBounds = NO;

  CIFilter *blurFilter = self.windowBlurFilters[targetIdentifier];
  if (!blurFilter) {
    blurFilter = [CIFilter filterWithName:@"CIGaussianBlur"];
    if (!blurFilter) {
      reject(@"filter_unavailable", @"CIGaussianBlur filter could not be created", nil);
      return;
    }
    blurFilter.name = @"legendOverlayBlur";
    [blurFilter setDefaults];
    [blurFilter setValue:@(0.0) forKey:kCIInputRadiusKey];
    self.windowBlurFilters[targetIdentifier] = blurFilter;

    NSMutableArray *filters = [NSMutableArray arrayWithArray:contentView.layer.filters ?: @[]];
    [filters addObject:blurFilter];
    contentView.layer.filters = filters;
  } else {
    BOOL filterAttached = NO;
    NSArray *existingFilters = contentView.layer.filters;
    if (existingFilters) {
      for (id existingFilter in existingFilters) {
        if ([existingFilter isKindOfClass:[CIFilter class]] && [[existingFilter name] isEqualToString:@"legendOverlayBlur"]) {
          filterAttached = YES;
          break;
        }
      }
    }
    if (!filterAttached) {
      NSMutableArray *filters = [NSMutableArray arrayWithArray:existingFilters ?: @[]];
      [filters addObject:blurFilter];
      contentView.layer.filters = filters;
    }
  }

  NSNumber *targetRadiusNumber = radiusNumber ?: @(0.0);
  CGFloat targetRadius = [targetRadiusNumber doubleValue];
  NSNumber *currentRadiusNumber = [blurFilter valueForKey:kCIInputRadiusKey] ?: @(0.0);
  CGFloat currentRadius = [currentRadiusNumber doubleValue];

  double durationMs = [durationNumber doubleValue];
  double durationSeconds = durationMs / 1000.0;

  if (durationSeconds <= 0.0) {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [blurFilter setValue:@(targetRadius) forKey:kCIInputRadiusKey];
    [CATransaction commit];
    [contentView.layer removeAnimationForKey:@"legendOverlayBlurAnimation"];
    resolve(@{@"success": @YES});
    return;
  }

  [contentView.layer removeAnimationForKey:@"legendOverlayBlurAnimation"];
  CABasicAnimation *animation = [CABasicAnimation animationWithKeyPath:@"filters.legendOverlayBlur.inputRadius"];
  animation.fromValue = @(currentRadius);
  animation.toValue = @(targetRadius);
  animation.duration = durationSeconds;
  animation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
  animation.fillMode = kCAFillModeForwards;
  animation.removedOnCompletion = NO;

  [CATransaction begin];
  [CATransaction setCompletionBlock:^{
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    [blurFilter setValue:@(targetRadius) forKey:kCIInputRadiusKey];
    [CATransaction commit];
    resolve(@{@"success": @YES});
  }];
  [contentView.layer addAnimation:animation forKey:@"legendOverlayBlurAnimation"];
  [CATransaction commit];
}

// Window delegate method to detect when window is closed by the system close button
- (void)windowWillClose:(NSNotification *)notification {
  NSWindow *closingWindow = notification.object;
  NSString *identifier = [self identifierForWindow:closingWindow];
  if (!identifier) {
    return;
  }

  [self handleWindowClosedForIdentifier:identifier];
}

// Explicitly tell the system not to terminate the app when this window closes
- (BOOL)windowShouldClose:(NSWindow *)window {
  NSString *identifier = [self identifierForWindow:window];
  if (identifier) {
    return YES; // Allow window to close
  }
  return NO; // Don't close other windows
}

#pragma mark - Main Window Management

+ (NSWindow *)getMainWindow {
  // Get the main window from the app delegate
  NSApplication *app = [NSApplication sharedApplication];
  NSArray *windows = [app windows];

  for (NSWindow *window in windows) {
    // The main window is typically the first window that's not a panel or sheet
    if ([window isKindOfClass:[NSWindow class]] && ![window isSheet] && ![window isKindOfClass:[NSPanel class]]) {
      return window;
    }
  }

  // Fallback to the key window if no main window found
  return [app keyWindow];
}

RCT_EXPORT_METHOD(getMainWindowFrame:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject) {
  NSWindow *mainWindow = [WindowManager getMainWindow];
  if (!mainWindow) {
    reject(@"no_main_window", @"Main window not found", nil);
    return;
  }

  NSRect frame = [mainWindow frame];
  NSDictionary *frameDict = @{
    @"x": @(frame.origin.x),
    @"y": @(frame.origin.y),
    @"width": @(frame.size.width),
    @"height": @(frame.size.height)
  };

  resolve(frameDict);
}

RCT_EXPORT_METHOD(setMainWindowFrame:(NSDictionary *)frameDict
                   resolver:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject) {
  NSWindow *mainWindow = [WindowManager getMainWindow];
  if (!mainWindow) {
    reject(@"no_main_window", @"Main window not found", nil);
    return;
  }

  CGFloat x = [frameDict[@"x"] doubleValue];
  CGFloat y = [frameDict[@"y"] doubleValue];
  CGFloat width = [frameDict[@"width"] doubleValue];
  CGFloat height = [frameDict[@"height"] doubleValue];

  NSRect newFrame = NSMakeRect(x, y, width, height);
  [mainWindow setFrame:newFrame display:YES animate:NO];

  resolve(@{@"success": @YES});
}

- (void)setupMainWindowObservers {
  NSWindow *mainWindow = [WindowManager getMainWindow];
  if (!mainWindow) {
    return;
  }

  // Set up notification observers for window events
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(mainWindowDidMove:)
                                               name:NSWindowDidMoveNotification
                                             object:mainWindow];

  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(mainWindowDidResize:)
                                               name:NSWindowDidResizeNotification
                                             object:mainWindow];

  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(mainWindowDidBecomeKey:)
                                               name:NSWindowDidBecomeKeyNotification
                                             object:mainWindow];
}

- (void)mainWindowDidMove:(NSNotification *)notification {
  NSWindow *window = notification.object;
  NSRect frame = [window frame];

  NSDictionary *frameDict = @{
    @"x": @(frame.origin.x),
    @"y": @(frame.origin.y),
    @"width": @(frame.size.width),
    @"height": @(frame.size.height)
  };

  // No need to manually save - setFrameAutosaveName handles persistence

  [self sendEventWithName:@"onMainWindowMoved" body:frameDict];
}

- (void)mainWindowDidResize:(NSNotification *)notification {
  NSWindow *window = notification.object;
  NSRect frame = [window frame];

  NSDictionary *frameDict = @{
    @"x": @(frame.origin.x),
    @"y": @(frame.origin.y),
    @"width": @(frame.size.width),
    @"height": @(frame.size.height)
  };

  // No need to manually save - setFrameAutosaveName handles persistence

  [self sendEventWithName:@"onMainWindowResized" body:frameDict];
}

- (void)mainWindowDidBecomeKey:(NSNotification *)notification {
  NSWindow *window = notification.object;
  if (!window) {
    return;
  }

  NSWindow *mainWindow = [WindowManager getMainWindow];
  if (window != mainWindow) {
    return;
  }

  [self sendEventWithName:@"onWindowFocused" body:@{ @"identifier": @"main", @"moduleName": @"Legend Music" }];
}


#pragma mark - Helpers

- (nullable NSString *)identifierForWindow:(NSWindow *)window {
  __block NSString *foundIdentifier = nil;
  [self.windows enumerateKeysAndObjectsUsingBlock:^(NSString * _Nonnull key, NSWindow * _Nonnull obj, BOOL * _Nonnull stop) {
    if (obj == window) {
      foundIdentifier = key;
      *stop = YES;
    }
  }];

  return foundIdentifier;
}

- (void)handleWindowClosedForIdentifier:(NSString *)identifier {
  NSString *moduleName = @"";
  RCTRootView *rootView = self.rootViews[identifier];
  if (rootView && [rootView.moduleName length] > 0) {
    moduleName = rootView.moduleName;
  }

  CIFilter *blurFilter = self.windowBlurFilters[identifier];
  if (blurFilter) {
    NSWindow *window = self.windows[identifier];
    NSView *contentView = window.contentView ?: rootView;
    if (contentView.layer) {
      [contentView.layer removeAnimationForKey:@"legendOverlayBlurAnimation"];
      NSArray *existingFilters = contentView.layer.filters ?: @[];
      NSMutableArray *remainingFilters = [NSMutableArray array];
      for (id filter in existingFilters) {
        if ([filter isKindOfClass:[CIFilter class]] && [[filter name] isEqualToString:@"legendOverlayBlur"]) {
          continue;
        }
        [remainingFilters addObject:filter];
      }
      contentView.layer.filters = remainingFilters;
    }
    [self.windowBlurFilters removeObjectForKey:identifier];
  }
  [self.windowBlurFilters removeObjectForKey:identifier];

  [self.windows removeObjectForKey:identifier];
  [self.rootViews removeObjectForKey:identifier];

  [self sendEventWithName:@"onWindowClosed" body:@{ @"identifier": identifier ?: @"", @"moduleName": moduleName ?: @"" }];
}

- (nullable NSDictionary *)initialPropsFromOptions:(NSDictionary *)options {
  id initialPropsCandidate = options[@"initialProperties"];
  if ([initialPropsCandidate isKindOfClass:[NSDictionary class]]) {
    return initialPropsCandidate;
  }
  return nil;
}

- (void)windowDidBecomeKey:(NSNotification *)notification {
  NSWindow *keyWindow = notification.object;
  NSString *identifier = [self identifierForWindow:keyWindow];
  if (!identifier) {
    return;
  }

  NSString *moduleName = @"";
  RCTRootView *rootView = self.rootViews[identifier];
  if (rootView && [rootView.moduleName length] > 0) {
    moduleName = rootView.moduleName;
  }

  [self sendEventWithName:@"onWindowFocused" body:@{ @"identifier": identifier, @"moduleName": moduleName ?: @"" }];
}


- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end
