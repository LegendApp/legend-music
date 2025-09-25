#import "ContextMenuManager.h"

#import <AppKit/AppKit.h>
#import <React/RCTUtils.h>

@interface ContextMenuManager () <NSMenuDelegate>
@property (nonatomic, copy) RCTPromiseResolveBlock pendingResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock pendingReject;
@property (nonatomic, strong) NSMenu *activeMenu;
@end

@implementation ContextMenuManager

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(showMenu:(NSArray<NSDictionary *> *)items
                  location:(NSDictionary *)location
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![items isKindOfClass:[NSArray class]] || items.count == 0) {
    resolve([NSNull null]);
    return;
  }

  if (self.pendingResolve) {
    self.pendingResolve([NSNull null]);
    self.pendingResolve = nil;
    self.pendingReject = nil;
  }

  self.pendingResolve = resolve;
  self.pendingReject = reject;

  NSMenu *menu = [[NSMenu alloc] initWithTitle:@"ContextMenu"];
  menu.autoenablesItems = NO;
  menu.delegate = self;

  for (NSDictionary *item in items) {
    if (![item isKindOfClass:[NSDictionary class]]) {
      continue;
    }

    NSString *title = item[@"title"];
    if (![title isKindOfClass:[NSString class]]) {
      title = @"";
    }

    NSString *identifier = item[@"id"] ?: item[@"commandId"];
    if (![identifier isKindOfClass:[NSString class]]) {
      identifier = title;
    }

    NSNumber *enabledNumber = item[@"enabled"];
    BOOL enabled = enabledNumber ? [enabledNumber boolValue] : YES;

    NSMenuItem *menuItem = [[NSMenuItem alloc] initWithTitle:title
                                                      action:@selector(handleMenuItem:)
                                               keyEquivalent:@""];
    menuItem.target = self;
    menuItem.representedObject = identifier;
    menuItem.enabled = enabled;

    [menu addItem:menuItem];
  }

  if (menu.numberOfItems == 0) {
    if (self.pendingResolve) {
      self.pendingResolve([NSNull null]);
    }
    self.pendingResolve = nil;
    self.pendingReject = nil;
    return;
  }

  self.activeMenu = menu;

  NSWindow *window = [NSApp keyWindow] ?: [NSApp mainWindow];
  if (!window) {
    if (self.pendingReject) {
      self.pendingReject(@"no_window", @"No active window available for context menu", nil);
    }
    self.pendingResolve = nil;
    self.pendingReject = nil;
    self.activeMenu = nil;
    return;
  }

  NSView *targetView = window.contentView;
  if (!targetView) {
    if (self.pendingReject) {
      self.pendingReject(@"no_view", @"No content view available for context menu", nil);
    }
    self.pendingResolve = nil;
    self.pendingReject = nil;
    self.activeMenu = nil;
    return;
  }

  double x = 0;
  double y = 0;
  if ([location isKindOfClass:[NSDictionary class]]) {
    NSNumber *xNumber = location[@"x"] ?: location[@"pageX"];
    NSNumber *yNumber = location[@"y"] ?: location[@"pageY"];
    if ([xNumber isKindOfClass:[NSNumber class]]) {
      x = [xNumber doubleValue];
    }
    if ([yNumber isKindOfClass:[NSNumber class]]) {
      y = [yNumber doubleValue];
    }
  }

  NSPoint point = NSMakePoint(x, y);
  NSRect bounds = targetView.bounds;
  point.y = bounds.size.height - point.y;

  [menu popUpMenuPositioningItem:nil atLocation:point inView:targetView];
}

- (void)handleMenuItem:(NSMenuItem *)sender
{
  if (!self.pendingResolve) {
    return;
  }

  id identifier = sender.representedObject;
  if (identifier && ![identifier isKindOfClass:[NSString class]]) {
    identifier = [[identifier description] copy];
  }

  self.pendingResolve(identifier ?: [NSNull null]);
  self.pendingResolve = nil;
  self.pendingReject = nil;

  self.activeMenu.delegate = nil;
  self.activeMenu = nil;
}

- (void)menuDidClose:(NSMenu *)menu
{
  if (menu != self.activeMenu) {
    return;
  }

  if (self.pendingResolve) {
    self.pendingResolve([NSNull null]);
  }

  self.pendingResolve = nil;
  self.pendingReject = nil;
  self.activeMenu.delegate = nil;
  self.activeMenu = nil;
}

@end
