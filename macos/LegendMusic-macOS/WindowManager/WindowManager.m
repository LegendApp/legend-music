#import "WindowManager.h"
#import <React/RCTRootView.h>
#import <React/RCTBridge.h>
#import <AppKit/AppKit.h>

@interface WindowManager() <NSWindowDelegate>
@property (nonatomic, strong) NSWindow *secondWindow;
@property (nonatomic, strong) RCTRootView *rootView;
@end

@implementation WindowManager

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onWindowClosed", @"onMainWindowMoved", @"onMainWindowResized"];
}

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(openWindow:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.secondWindow) {
    [self.secondWindow makeKeyAndOrderFront:nil];
    resolve(@{@"success": @YES});
    return;
  }

  // Get options with defaults
  NSString *title = options[@"title"] ?: @"New Window";
  CGFloat width = options[@"width"] ? [options[@"width"] floatValue] : 400;
  CGFloat height = options[@"height"] ? [options[@"height"] floatValue] : 300;

  // Create a window with specified dimensions
  NSRect frame = NSMakeRect(0, 0, width, height);
  NSUInteger styleMask = NSWindowStyleMaskTitled |
                        NSWindowStyleMaskClosable |
                        NSWindowStyleMaskResizable |
                        NSWindowStyleMaskMiniaturizable;

  self.secondWindow = [[NSWindow alloc] initWithContentRect:frame
                                               styleMask:styleMask
                                                 backing:NSBackingStoreBuffered
                                                   defer:NO];

  // Set this property to prevent application exit when the window closes
  [self.secondWindow setReleasedWhenClosed:NO];

  [self.secondWindow setTitle:title];
  [self.secondWindow center];


  // Create a RCTRootView with the name of the component to render
  RCTBridge *bridge = self.bridge;
  if (!bridge) {
    reject(@"no_bridge", @"RCTBridge not available", nil);
    return;
  }

  self.rootView = [[RCTRootView alloc] initWithBridge:bridge
                                          moduleName:@"SettingsWindow"
                                   initialProperties:nil];

  [self.secondWindow setContentView:self.rootView];

  // Set window delegate to track close events
  [self.secondWindow setDelegate:self];

  // Show the window
  [self.secondWindow makeKeyAndOrderFront:nil];

  resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(closeWindow:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject) {
  if (self.secondWindow) {
    [self.secondWindow orderOut:nil]; // Hide the window

    // Don't call [self.secondWindow close] directly, as it might trigger app exit
    // Just hide it and mark as closed via the event
    [self sendEventWithName:@"onWindowClosed" body:@{}];

    self.rootView = nil;
    self.secondWindow = nil;

    resolve(@{@"success": @YES});
  } else {
    resolve(@{@"success": @NO, @"message": @"No window to close"});
  }
}

// Window delegate method to detect when window is closed by the system close button
- (void)windowWillClose:(NSNotification *)notification {
  if (notification.object == self.secondWindow) {
    // This will be called when the user clicks the window's close button
    [self sendEventWithName:@"onWindowClosed" body:@{}];
    self.rootView = nil;
    self.secondWindow = nil;
  }
}

// Explicitly tell the system not to terminate the app when this window closes
- (BOOL)windowShouldClose:(NSWindow *)window {
  if (window == self.secondWindow) {
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
  
  // Save to NSUserDefaults for persistence
  [self saveWindowFrame:frameDict];
  
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
  
  // Save to NSUserDefaults for persistence
  [self saveWindowFrame:frameDict];
  
  [self sendEventWithName:@"onMainWindowResized" body:frameDict];
}

- (void)saveWindowFrame:(NSDictionary *)frameDict {
  NSLog(@"Saving window frame: %@", frameDict);
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  [defaults setObject:frameDict forKey:@"mainWindowFrame"];
  [defaults synchronize];
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end