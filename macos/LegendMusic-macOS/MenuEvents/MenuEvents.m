#import "MenuEvents.h"

static NSString *const kMenuCommandTriggeredNotification = @"MenuCommandTriggered";
static NSString *const kMenuCommandUpdateNotification = @"MenuCommandUpdate";

@implementation MenuEvents {
  BOOL hasListeners;
}

RCT_EXPORT_MODULE();

- (instancetype)init {
  self = [super init];
  if (self) {
    // Add generic menu handler
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleMenuCommand:)
                                                 name:kMenuCommandTriggeredNotification
                                               object:nil];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

// Handle generic menu commands
- (void)handleMenuCommand:(NSNotification *)notification {
  if (hasListeners) {
    NSString *commandId = notification.userInfo[@"commandId"];
    if (commandId) {
      [self sendEventWithName:@"onMenuCommand" body:@{@"commandId": commandId}];
    }
  }
}

- (void)postMenuUpdateWithUserInfo:(NSDictionary *)userInfo {
  NSString *commandId = userInfo[@"commandId"];
  if (!commandId) {
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [[NSNotificationCenter defaultCenter] postNotificationName:kMenuCommandUpdateNotification
                                                        object:nil
                                                      userInfo:userInfo];
  });
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onMenuCommand"];
}

+ (BOOL)requiresMainQueueSetup {
  return YES; // Change to YES because we need to access UI elements
}

// Will be called when this module's first listener is added.
- (void)startObserving {
  hasListeners = YES;
}

// Will be called when this module's last listener is removed, or on dealloc.
- (void)stopObserving {
  hasListeners = NO;
}

// Add a method that can be called from JavaScript to check if the module is available
RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@YES);
}

RCT_EXPORT_METHOD(updateMenuItemState:(NSString *)commandId state:(BOOL)state) {
  if (!commandId) {
    return;
  }
  [self postMenuUpdateWithUserInfo:@{ @"commandId": commandId, @"state": @(state) }];
}

RCT_EXPORT_METHOD(setMenuItemEnabled:(NSString *)commandId enabled:(BOOL)enabled) {
  if (!commandId) {
    return;
  }
  [self postMenuUpdateWithUserInfo:@{ @"commandId": commandId, @"enabled": @(enabled) }];
}

RCT_EXPORT_METHOD(updateMenuItemTitle:(NSString *)commandId title:(NSString *)title) {
  if (!commandId || title == nil) {
    return;
  }
  [self postMenuUpdateWithUserInfo:@{ @"commandId": commandId, @"title": title }];
}

RCT_EXPORT_METHOD(updateMenuItemShortcut:(NSString *)commandId
                  key:(NSString *)key
                  modifiers:(nonnull NSNumber *)modifiers) {
  if (!commandId) {
    return;
  }

  NSMutableDictionary *userInfo = [@{ @"commandId": commandId } mutableCopy];
  userInfo[@"keyEquivalent"] = key ?: @"";
  if (modifiers != nil) {
    userInfo[@"modifiers"] = modifiers;
  }

  [self postMenuUpdateWithUserInfo:userInfo];
}

@end
