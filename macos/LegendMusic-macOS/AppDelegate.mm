#import "AppDelegate.h"
#import "WindowManager.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTDevloadingViewSetEnabled.h>
#import <React/RCTBridge.h>
#import <React/RCTLinkingManager.h>
#import <React/RCTCxxBridgeDelegate.h>
#import <React/RCTDevSettings.h>
#import <objc/runtime.h>

static NSString *const kMenuCommandTriggeredNotification = @"MenuCommandTriggered";
static NSString *const kMenuCommandUpdateNotification = @"MenuCommandUpdate";

static inline NSEventModifierFlags LegendMenuSanitizedModifiers(NSNumber *value, NSString *keyEquivalent) {
  if (!value) {
    return 0;
  }

  NSEventModifierFlags allowed =
    NSEventModifierFlagCommand |
    NSEventModifierFlagShift |
    NSEventModifierFlagOption |
    NSEventModifierFlagControl;

  NSEventModifierFlags mask = (NSEventModifierFlags)value.unsignedIntegerValue;
  NSEventModifierFlags sanitized = mask & allowed;

  // If we don't have a key equivalent, clear the modifiers to avoid showing placeholder glyphs
  if (keyEquivalent.length == 0) {
    return 0;
  }

  return sanitized;
}

static inline NSString *LegendMenuSanitizedKeyEquivalent(NSString *keyEquivalent) {
  if (!keyEquivalent || keyEquivalent.length == 0) {
    return @"";
  }

  if (keyEquivalent.length == 1) {
    return [keyEquivalent lowercaseString];
  }

  // Only keep the first character to avoid invalid menu glyphs
  unichar firstChar = [keyEquivalent characterAtIndex:0];
  return [NSString stringWithCharacters:&firstChar length:1].lowercaseString;
}

static inline NSAppearance *LegendDarkAppearance() {
  if (@available(macOS 10.14, *)) {
    return [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
  } else if (@available(macOS 10.10, *)) {
    return [NSAppearance appearanceNamed:NSAppearanceNameVibrantDark];
  }
  return nil;
}

// Forward declaration for notification
@interface NSNotificationCenter (MenuEvents)
- (void)postNotificationName:(NSString *)name object:(id)object userInfo:(NSDictionary *)userInfo;
@end


@interface AppDelegate ()
@property (nonatomic, assign) BOOL mainWindowFrameAdjusted;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMenuItem *> *menuCommandItems;
@end


@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"LegendMusic";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  self.menuCommandItems = [NSMutableDictionary dictionary];

  // Sometimes the "loading bar" gets stuck on and you have to kill the app to fix it;
  // by turning it off here, we avoid that issue
  RCTDevLoadingViewSetEnabled(false);

  /**
   *  Use a notification observer to modify the window properties once the window has been created.
   */
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(windowDidBecomeKey:)
                                               name:NSWindowDidBecomeKeyNotification
                                             object:nil];

  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handleMenuItemUpdate:)
                                               name:kMenuCommandUpdateNotification
                                             object:nil];

  dispatch_async(dispatch_get_main_queue(), ^{
    [self setupMenuConnections];
  });

  [super applicationDidFinishLaunching:notification];

  NSAppearance *darkAppearance = LegendDarkAppearance();
  if (darkAppearance) {
    [NSApp setAppearance:darkAppearance];
  }

#if RCT_DEV_MENU
  RCTDevSettings *devSettings = self.bridge.devSettings;
  if (devSettings) {
    devSettings.isSecondaryClickToShowDevMenuEnabled = NO;
  }
#endif
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
  NSAppearance *darkAppearance = LegendDarkAppearance();
  if (darkAppearance) {
    self.window.appearance = darkAppearance;
  }
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
  [self setupPlaybackMenu];
  [self normalizeMenuKeyEquivalents:mainMenu];
}

- (void)normalizeMenuKeyEquivalents:(NSMenu *)menu {
  for (NSMenuItem *item in menu.itemArray) {
    if (item.submenu) {
      [self normalizeMenuKeyEquivalents:item.submenu];
    }

    if (item.keyEquivalent.length > 0 && item.keyEquivalentModifierMask == 0) {
      item.keyEquivalentModifierMask = NSEventModifierFlagCommand;
    }
  }
}

- (SEL)selectorForCommandId:(NSString *)commandId {
  NSString *selectorName = [NSString stringWithFormat:@"%@:", commandId];
  SEL selector = NSSelectorFromString(selectorName);

  if (!class_respondsToSelector([self class], selector)) {
    class_addMethod([self class], selector, imp_implementationWithBlock(^(id _self, id sender) {
      [_self triggerMenuCommand:commandId];
    }), "v@:@");
  }

  return selector;
}

// Combined method to setup a menu command and connect it to a menu item
- (BOOL)setupMenuCommand:(NSString *)commandId itemTitle:(NSString *)itemTitle inMenu:(NSString *)menuTitle {
  SEL selector = [self selectorForCommandId:commandId];

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
  if (commandId && targetItem) {
    self.menuCommandItems[commandId] = targetItem;
  }

  return YES;
}

- (void)addMenuCommand:(NSString *)commandId
                 title:(NSString *)title
               iconName:(NSString *)iconName
                 toMenu:(NSMenu *)menu {
  if (!menu) {
    return;
  }

  SEL selector = [self selectorForCommandId:commandId];
  NSMenuItem *item = [[NSMenuItem alloc] initWithTitle:title action:selector keyEquivalent:@""];
  [item setTarget:self];

  if (@available(macOS 11.0, *)) {
    if (iconName.length > 0) {
      NSImage *symbolImage = [NSImage imageWithSystemSymbolName:iconName accessibilityDescription:title];
      if (symbolImage) {
        [symbolImage setTemplate:YES];
        item.image = symbolImage;
      }
    }
  }

  [menu addItem:item];
  if (commandId) {
    self.menuCommandItems[commandId] = item;
  }
}

- (void)setupPlaybackMenu {
  NSMenu *mainMenu = [NSApp mainMenu];
  if (!mainMenu) {
    return;
  }

  NSInteger playbackIndex = [mainMenu indexOfItemWithTitle:@"Playback"];
  BOOL playbackExists = playbackIndex >= 0;
  NSMenuItem *playbackMenuItem = playbackExists ? [mainMenu itemAtIndex:playbackIndex] : nil;
  if (!playbackMenuItem) {
    playbackMenuItem = [[NSMenuItem alloc] initWithTitle:@"Playback" action:nil keyEquivalent:@""];
  }

  NSMenu *playbackMenu = [playbackMenuItem submenu];
  if (!playbackMenu) {
    playbackMenu = [[NSMenu alloc] initWithTitle:@"Playback"];
    playbackMenuItem.submenu = playbackMenu;
  }

  NSInteger windowIndex = [mainMenu indexOfItemWithTitle:@"Window"];
  NSInteger desiredIndex = windowIndex >= 0 ? windowIndex : [mainMenu numberOfItems];

  if (!playbackExists || playbackIndex != desiredIndex) {
    if (playbackExists) {
      [mainMenu removeItemAtIndex:playbackIndex];
      if (playbackIndex < desiredIndex) {
        desiredIndex -= 1;
      }
    }

    NSInteger boundedIndex = MIN(desiredIndex, [mainMenu numberOfItems]);
    [mainMenu insertItem:playbackMenuItem atIndex:boundedIndex];
  }

  NSArray<NSString *> *playbackCommandKeys = @[
    @"playbackPrevious",
    @"playbackPlayPause",
    @"playbackNext",
    @"playbackToggleShuffle",
    @"playbackToggleRepeat"
  ];
  [self.menuCommandItems removeObjectsForKeys:playbackCommandKeys];

  while ([playbackMenu numberOfItems] > 0) {
    [playbackMenu removeItemAtIndex:0];
  }

  [self addMenuCommand:@"playbackPrevious" title:@"Previous Track" iconName:@"backward.end.fill" toMenu:playbackMenu];
  [self addMenuCommand:@"playbackPlayPause" title:@"Play" iconName:@"play.fill" toMenu:playbackMenu];
  [self addMenuCommand:@"playbackNext" title:@"Next Track" iconName:@"forward.end.fill" toMenu:playbackMenu];

  [playbackMenu addItem:[NSMenuItem separatorItem]];

  [self addMenuCommand:@"playbackToggleShuffle" title:@"Shuffle" iconName:@"shuffle" toMenu:playbackMenu];
  [self addMenuCommand:@"playbackToggleRepeat" title:@"Repeat Off" iconName:@"repeat" toMenu:playbackMenu];
}

- (void)handleMenuItemUpdate:(NSNotification *)notification {
  NSDictionary *userInfo = notification.userInfo;
  NSString *commandId = userInfo[@"commandId"];
  if (!commandId) {
    return;
  }

  NSMenuItem *menuItem = self.menuCommandItems[commandId];
  if (!menuItem) {
    return;
  }

  NSNumber *stateValue = userInfo[@"state"];
  if (stateValue) {
    menuItem.state = stateValue.boolValue ? NSControlStateValueOn : NSControlStateValueOff;
  }

  NSNumber *enabledValue = userInfo[@"enabled"];
  if (enabledValue) {
    menuItem.enabled = enabledValue.boolValue;
  }

  NSString *title = userInfo[@"title"];
  if (title) {
    menuItem.title = title;
  }

  NSString *keyEquivalentRaw = userInfo[@"keyEquivalent"];
  NSNumber *modifierMaskValue = userInfo[@"modifiers"];
  if (keyEquivalentRaw || modifierMaskValue) {
    NSString *keyEquivalent = LegendMenuSanitizedKeyEquivalent(keyEquivalentRaw ?: menuItem.keyEquivalent);
    menuItem.keyEquivalent = keyEquivalent;
    menuItem.keyEquivalentModifierMask =
      LegendMenuSanitizedModifiers(modifierMaskValue ?: @(menuItem.keyEquivalentModifierMask), keyEquivalent);
  }
}

// Generic method to trigger menu commands
- (void)triggerMenuCommand:(NSString *)commandId {
  NSDictionary *userInfo = @{@"commandId": commandId};
  [[NSNotificationCenter defaultCenter] postNotificationName:kMenuCommandTriggeredNotification
                                                      object:nil
                                                    userInfo:userInfo];
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
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

  if (!self.mainWindowFrameAdjusted && window == self.window) {
    CGFloat titleBarHeight = NSHeight(window.frame) - NSHeight(window.contentLayoutRect);
    if (titleBarHeight > 0.0) {
      NSRect frame = window.frame;
      frame.size.height += titleBarHeight;
      frame.origin.y -= titleBarHeight;
      [window setFrame:frame display:NO animate:NO];
    }
    self.mainWindowFrameAdjusted = YES;
  }

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
