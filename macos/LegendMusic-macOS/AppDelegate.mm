#import "AppDelegate.h"
#import "WindowManager.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridge.h>
#import <React/RCTLinkingManager.h>
#import <React/RCTCxxBridgeDelegate.h>
#import <objc/runtime.h>

// Forward declaration for notification
@interface NSNotificationCenter (MenuEvents)
- (void)postNotificationName:(NSString *)name object:(id)object userInfo:(NSDictionary *)userInfo;
@end


@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"LegendMusic";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  /**
   *  Use a notification observer to modify the window properties once the window has been created.
   */
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(windowDidBecomeKey:)
                                               name:NSWindowDidBecomeKeyNotification
                                             object:nil];

  [self performSelector:@selector(setupMenuConnections) withObject:nil afterDelay:0.5];

  return [super applicationDidFinishLaunching:notification];
}

- (void)loadReactNativeWindow:(NSDictionary *)launchOptions
{
  RCTPlatformView *rootView = [self.rootViewFactory viewWithModuleName:self.moduleName
                                                     initialProperties:self.initialProps
                                                         launchOptions:launchOptions];

  // Create window with default size - autosave will override if available
  NSRect defaultFrame = NSMakeRect(0, 0, 1280, 720);
  self.window = [[NSWindow alloc] initWithContentRect:defaultFrame
                                           styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskResizable | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable
                                             backing:NSBackingStoreBuffered
                                               defer:NO];
  self.window.title = self.moduleName;
  self.window.autorecalculatesKeyViewLoop = YES;

  // Set frame autosave name BEFORE making the window visible
  // This will automatically restore the saved frame if one exists
  [self.window setFrameAutosaveName:@"MainWindow"];

  NSViewController *rootViewController = [NSViewController new];
  rootViewController.view = rootView;

  // Set the root view frame to match the window's content size
  rootView.frame = self.window.contentView.bounds;
  rootView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;

  self.window.contentViewController = rootViewController;

  // Only center if no saved frame exists
  if (![[NSUserDefaults standardUserDefaults] objectForKey:@"NSWindow Frame MainWindow"]) {
    [self.window center];
  }

  // Now make the window visible - frame should already be restored by autosave
  [self.window makeKeyAndOrderFront:self];
}

// Setup menu item connections
- (void)setupMenuConnections {
  // Get the main menu
  NSMenu *mainMenu = [NSApp mainMenu];
  if (!mainMenu || [mainMenu numberOfItems] <= 0) {
    return;
  }

  // Set up menu items
  [self setupMenuCommand:@"settings" itemTitle:@"Settings…" inMenu:@"LegendMusic"];
//   [self setupMenuCommand:@"checkForUpdates" itemTitle:@"Check for Updates..." inMenu:@"LegendPhotos"];
  [self setupMenuCommand:@"jump" itemTitle:@"Jump" inMenu:@"File"];
}

// Combined method to setup a menu command and connect it to a menu item
- (BOOL)setupMenuCommand:(NSString *)commandId itemTitle:(NSString *)itemTitle inMenu:(NSString *)menuTitle {
  // Create the selector name from the command ID
  NSString *selectorName = [NSString stringWithFormat:@"%@:", commandId];
  SEL selector = NSSelectorFromString(selectorName);

  // Dynamically add the method to AppDelegate
  class_addMethod([self class], selector, imp_implementationWithBlock(^(id _self, id sender) {
    [_self triggerMenuCommand:commandId];
  }), "v@:@");

  // Connect the menu item
  NSMenu *mainMenu = [NSApp mainMenu];

  // Find the menu by title
  NSMenuItem *menuItem = nil;
  for (int i = 0; i < [mainMenu numberOfItems]; i++) {
    NSMenuItem *item = [mainMenu itemAtIndex:i];
    if ([[item title] isEqualToString:menuTitle]) {
      menuItem = item;
      break;
    }
  }

  if (!menuItem) {
    NSLog(@"Menu '%@' not found", menuTitle);
    return NO;
  }

  // Find the submenu
  NSMenu *subMenu = [menuItem submenu];
  if (!subMenu) {
    NSLog(@"Submenu of '%@' not found", menuTitle);
    return NO;
  }

  // Find the menu item
  NSMenuItem *targetItem = [subMenu itemWithTitle:itemTitle];
  if (!targetItem) {
    NSLog(@"Menu item '%@' not found in menu '%@'", itemTitle, menuTitle);
    return NO;
  }

  // Connect the action
  [targetItem setTarget:self];
  [targetItem setAction:selector];

  return YES;
}

// Generic method to trigger menu commands
- (void)triggerMenuCommand:(NSString *)commandId {
  NSDictionary *userInfo = @{@"commandId": commandId};
  [[NSNotificationCenter defaultCenter] postNotificationName:@"MenuCommandTriggered"
                                                      object:nil
                                                    userInfo:userInfo];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
#ifdef RN_FABRIC_ENABLED
  return true;
#else
  return false;
#endif
}



/**
 * Ensures that the window is fully initialized and has become the key window before you attempt to modify its properties
 */
- (void)windowDidBecomeKey:(NSNotification *)notification
{
  NSWindow *window = notification.object;

  // Autosave name should already be set in loadReactNativeWindow

  [window setTitleVisibility:NSWindowTitleHidden];
  [window setTitlebarAppearsTransparent:YES];
  [window setStyleMask:[window styleMask] | NSWindowStyleMaskFullSizeContentView];

  // Set the window delegate to handle close events
  [window setDelegate:self];

  // Hide the close button
  [[window standardWindowButton:NSWindowCloseButton] setHidden:YES];
  // Hide the minimize button
  [[window standardWindowButton:NSWindowMiniaturizeButton] setHidden:YES];
  // Hide the maximize button
  [[window standardWindowButton:NSWindowZoomButton] setHidden:YES];

  // Setup window observers for size and position tracking
  [self performSelector:@selector(setupWindowObservers) withObject:nil afterDelay:1.0];

  // Remove the observer
  [[NSNotificationCenter defaultCenter] removeObserver:self
                                                  name:NSWindowDidBecomeKeyNotification
                                                object:nil];
}


- (void)setupWindowObservers {
  // Get the WindowManager module and setup observers
  RCTBridge *bridge = self.bridge;
  if (bridge) {
    WindowManager *windowManager = [bridge moduleForClass:[WindowManager class]];
    if (windowManager) {
      [windowManager setupMainWindowObservers];
    }
  }
}

@end
