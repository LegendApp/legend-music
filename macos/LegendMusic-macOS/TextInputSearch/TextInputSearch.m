#import "TextInputSearch.h"
#import <React/RCTView.h>
#import <React/RCTLog.h>
#import <React/RCTConvert.h>
#import <React/RCTUIManager.h>

@interface TextInputSearchView : NSSearchField

@end

@implementation TextInputSearchView

- (instancetype)init
{
    self = [super init];
    if (self) {
        self.focusRingType = NSFocusRingTypeNone;
    }
    return self;
}

- (BOOL)performKeyEquivalent:(NSEvent *)event
{
    // Disable up/down arrow key handling
    if (event.keyCode == 126 || event.keyCode == 125) { // Up arrow: 126, Down arrow: 125
        return YES; // Return YES to indicate we handled the event (blocking it)
    }

    return [super performKeyEquivalent:event];
}

- (void)keyDown:(NSEvent *)event
{
    // Intercept up/down arrow keys and don't process them
    if (event.keyCode == 126 || event.keyCode == 125) { // Up arrow: 126, Down arrow: 125
        return; // Don't call super, effectively disabling these keys
    }

    [super keyDown:event];
}

@end

@interface TextInputSearchRCTView : RCTView <NSTextFieldDelegate>

@property (nonatomic, strong) TextInputSearchView *textField;
@property (nonatomic, copy) RCTBubblingEventBlock onChangeText;
@property (nonatomic, assign) BOOL hasSetDefaultText;

@end

@implementation TextInputSearchRCTView

- (instancetype)init
{
    self = [super init];
    if (self) {
        _textField = [[TextInputSearchView alloc] init];
        _textField.delegate = self;

        [self addSubview:_textField];

        // Set up constraints to fill the container
        _textField.translatesAutoresizingMaskIntoConstraints = NO;
        [NSLayoutConstraint activateConstraints:@[
            [_textField.topAnchor constraintEqualToAnchor:self.topAnchor],
            [_textField.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
            [_textField.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
            [_textField.trailingAnchor constraintEqualToAnchor:self.trailingAnchor]
        ]];
    }
    return self;
}

- (void)controlTextDidChange:(NSNotification *)notification
{
    if (notification.object == self.textField && self.onChangeText) {
        NSString *text = self.textField.stringValue ?: @"";
        self.onChangeText(@{@"text": text});
    }
}

- (void)setPlaceholder:(NSString *)placeholder
{
    if (placeholder) {
        self.textField.placeholderString = placeholder;
    }
}

- (void)setText:(NSString *)text
{
    self.textField.stringValue = text ?: @"";
}

- (void)setDefaultText:(NSString *)text
{
    if (!self.hasSetDefaultText) {
        self.textField.stringValue = text ?: @"";
        self.hasSetDefaultText = YES;
    }
}

- (NSString *)text
{
    return self.textField.stringValue;
}

- (void)focus
{
    [self.window makeFirstResponder:self.textField];
}

@end

@implementation TextInputSearchManager

RCT_EXPORT_MODULE(TextInputSearch)

- (NSView *)view
{
    return [[TextInputSearchRCTView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(onChangeText, RCTBubblingEventBlock)
RCT_CUSTOM_VIEW_PROPERTY(placeholder, NSString, TextInputSearchRCTView)
{
    [view setPlaceholder:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(defaultText, NSString, TextInputSearchRCTView)
{
    [view setDefaultText:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(text, NSString, TextInputSearchRCTView)
{
    [view setText:[RCTConvert NSString:json]];
}

RCT_EXPORT_METHOD(focus:(nonnull NSNumber *)reactTag)
{
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, NSView *> *viewRegistry) {
        TextInputSearchRCTView *view = (TextInputSearchRCTView *)viewRegistry[reactTag];
        if (view && [view isKindOfClass:[TextInputSearchRCTView class]]) {
            [view focus];
        }
    }];
}

@end
