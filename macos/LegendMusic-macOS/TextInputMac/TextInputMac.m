#import "TextInputMac.h"
#import <React/RCTView.h>
#import <React/RCTLog.h>
#import <React/RCTConvert.h>
#import <React/RCTUIManager.h>

// Single-line text field
@interface TextInputMacTextField : NSTextField

@end

@implementation TextInputMacTextField

- (instancetype)init
{
    self = [super init];
    if (self) {
        self.focusRingType = NSFocusRingTypeNone;
        self.bezeled = NO;
        self.bordered = NO;
        self.drawsBackground = NO;
        self.cell.scrollable = YES;
        self.cell.wraps = NO;
    }
    return self;
}

@end

// Multiline text view
@interface TextInputMacTextView : NSTextView

@property (nonatomic, copy) NSString *placeholderString;
@property (nonatomic, strong) NSColor *placeholderColor;

@end

@implementation TextInputMacTextView

- (instancetype)initWithFrame:(NSRect)frameRect
{
    self = [super initWithFrame:frameRect];
    if (self) {
        self.drawsBackground = NO;
        self.backgroundColor = [NSColor clearColor];
        self.textContainerInset = NSMakeSize(0, 0);
        self.textContainer.lineFragmentPadding = 0;
        self.richText = NO;
        self.allowsUndo = YES;
        self.automaticQuoteSubstitutionEnabled = NO;
        self.automaticDashSubstitutionEnabled = NO;
    }
    return self;
}

- (BOOL)becomeFirstResponder
{
    BOOL result = [super becomeFirstResponder];
    [self setNeedsDisplay:YES];
    return result;
}

- (BOOL)resignFirstResponder
{
    BOOL result = [super resignFirstResponder];
    [self setNeedsDisplay:YES];
    return result;
}

- (void)drawRect:(NSRect)dirtyRect
{
    [super drawRect:dirtyRect];

    if (self.string.length == 0 && self.placeholderString.length > 0 && self.window.firstResponder != self) {
        NSColor *color = self.placeholderColor ?: [NSColor placeholderTextColor];
        NSDictionary *attributes = @{
            NSFontAttributeName: self.font ?: [NSFont systemFontOfSize:13],
            NSForegroundColorAttributeName: color
        };
        NSRect placeholderRect = NSInsetRect(self.bounds, self.textContainerInset.width, self.textContainerInset.height);
        [self.placeholderString drawInRect:placeholderRect withAttributes:attributes];
    }
}

@end

@interface TextInputMacView : RCTView <NSTextFieldDelegate, NSTextViewDelegate>

@property (nonatomic, strong) TextInputMacTextField *textField;
@property (nonatomic, strong) NSScrollView *scrollView;
@property (nonatomic, strong) TextInputMacTextView *textView;
@property (nonatomic, copy) RCTBubblingEventBlock onChangeText;
@property (nonatomic, copy) RCTBubblingEventBlock onSubmit;
@property (nonatomic, copy) RCTBubblingEventBlock onFocus;
@property (nonatomic, copy) RCTBubblingEventBlock onBlur;
@property (nonatomic, assign) BOOL hasSetDefaultText;
@property (nonatomic, assign) BOOL multiline;
@property (nonatomic, strong) NSColor *storedTextColor;
@property (nonatomic, strong) NSFont *storedFont;
@property (nonatomic, copy) NSString *storedPlaceholder;
@property (nonatomic, strong) NSColor *storedPlaceholderColor;

@end

@implementation TextInputMacView

- (instancetype)init
{
    self = [super init];
    if (self) {
        _multiline = NO;
        _storedFont = [NSFont systemFontOfSize:13];
        [self setupSingleLine];
    }
    return self;
}

- (void)setupSingleLine
{
    // Remove multiline views if they exist
    [_scrollView removeFromSuperview];
    _scrollView = nil;
    _textView = nil;

    _textField = [[TextInputMacTextField alloc] init];
    _textField.delegate = self;
    if (_storedTextColor) {
        _textField.textColor = _storedTextColor;
    }
    if (_storedFont) {
        _textField.font = _storedFont;
    }
    if (_storedPlaceholder) {
        [self applyPlaceholderToTextField];
    }

    [self addSubview:_textField];

    _textField.translatesAutoresizingMaskIntoConstraints = NO;
    [NSLayoutConstraint activateConstraints:@[
        [_textField.topAnchor constraintEqualToAnchor:self.topAnchor],
        [_textField.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
        [_textField.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
        [_textField.trailingAnchor constraintEqualToAnchor:self.trailingAnchor]
    ]];
}

- (void)setupMultiline
{
    // Remove single-line field if it exists
    [_textField removeFromSuperview];
    _textField = nil;

    _scrollView = [[NSScrollView alloc] init];
    _scrollView.hasVerticalScroller = YES;
    _scrollView.hasHorizontalScroller = NO;
    _scrollView.autohidesScrollers = YES;
    _scrollView.borderType = NSNoBorder;
    _scrollView.drawsBackground = NO;

    _textView = [[TextInputMacTextView alloc] initWithFrame:NSZeroRect];
    _textView.delegate = self;
    _textView.minSize = NSMakeSize(0, 0);
    _textView.maxSize = NSMakeSize(CGFLOAT_MAX, CGFLOAT_MAX);
    _textView.verticallyResizable = YES;
    _textView.horizontallyResizable = NO;
    _textView.autoresizingMask = NSViewWidthSizable;
    _textView.textContainer.containerSize = NSMakeSize(CGFLOAT_MAX, CGFLOAT_MAX);
    _textView.textContainer.widthTracksTextView = YES;

    if (_storedFont) {
        _textView.font = _storedFont;
    }
    if (_storedPlaceholder) {
        _textView.placeholderString = _storedPlaceholder;
    }
    if (_storedPlaceholderColor) {
        _textView.placeholderColor = _storedPlaceholderColor;
    }

    _scrollView.documentView = _textView;

    // Apply text color after textView is fully set up
    if (_storedTextColor) {
        [self applyTextColorToTextView];
    }
    [self addSubview:_scrollView];

    _scrollView.translatesAutoresizingMaskIntoConstraints = NO;
    [NSLayoutConstraint activateConstraints:@[
        [_scrollView.topAnchor constraintEqualToAnchor:self.topAnchor],
        [_scrollView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
        [_scrollView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
        [_scrollView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor]
    ]];
}

- (void)setMultilineEnabled:(BOOL)multiline
{
    if (_multiline == multiline) {
        return;
    }
    _multiline = multiline;

    if (multiline) {
        [self setupMultiline];
    } else {
        [self setupSingleLine];
    }
}

#pragma mark - NSTextFieldDelegate (single-line)

- (void)controlTextDidChange:(NSNotification *)notification
{
    if (notification.object == self.textField && self.onChangeText) {
        NSString *text = self.textField.stringValue ?: @"";
        self.onChangeText(@{@"text": text});
    }
}

- (void)controlTextDidBeginEditing:(NSNotification *)notification
{
    if (notification.object == self.textField && self.onFocus) {
        self.onFocus(@{});
    }
}

- (void)controlTextDidEndEditing:(NSNotification *)notification
{
    if (notification.object == self.textField && self.onBlur) {
        self.onBlur(@{});
    }
}

- (BOOL)control:(NSControl *)control textView:(NSTextView *)textView doCommandBySelector:(SEL)commandSelector
{
    if (commandSelector == @selector(insertNewline:)) {
        if (self.onSubmit) {
            NSString *text = self.textField.stringValue ?: @"";
            self.onSubmit(@{@"text": text});
        }
        return YES;
    }
    return NO;
}

#pragma mark - NSTextViewDelegate (multiline)

- (void)textDidChange:(NSNotification *)notification
{
    if (notification.object == self.textView && self.onChangeText) {
        NSString *text = self.textView.string ?: @"";
        self.onChangeText(@{@"text": text});
    }
}

- (void)textDidBeginEditing:(NSNotification *)notification
{
    if (notification.object == self.textView && self.onFocus) {
        self.onFocus(@{});
    }
}

- (void)textDidEndEditing:(NSNotification *)notification
{
    if (notification.object == self.textView && self.onBlur) {
        self.onBlur(@{});
    }
}

#pragma mark - Property setters

- (void)applyPlaceholderToTextField
{
    if (_storedPlaceholder && _textField) {
        if (_storedPlaceholderColor) {
            NSMutableAttributedString *attrPlaceholder = [[NSMutableAttributedString alloc]
                initWithString:_storedPlaceholder
                attributes:@{
                    NSForegroundColorAttributeName: _storedPlaceholderColor,
                    NSFontAttributeName: _storedFont ?: [NSFont systemFontOfSize:13]
                }];
            _textField.placeholderAttributedString = attrPlaceholder;
        } else {
            _textField.placeholderString = _storedPlaceholder;
        }
    }
}

- (void)setPlaceholder:(NSString *)placeholder
{
    _storedPlaceholder = placeholder;
    if (_multiline) {
        _textView.placeholderString = placeholder;
        [_textView setNeedsDisplay:YES];
    } else {
        [self applyPlaceholderToTextField];
    }
}

- (void)setPlaceholderTextColor:(NSColor *)color
{
    _storedPlaceholderColor = color;
    if (_multiline) {
        _textView.placeholderColor = color;
        [_textView setNeedsDisplay:YES];
    } else {
        [self applyPlaceholderToTextField];
    }
}

- (void)setText:(NSString *)text
{
    if (_multiline) {
        _textView.string = text ?: @"";
    } else {
        _textField.stringValue = text ?: @"";
    }
}

- (void)setDefaultText:(NSString *)text
{
    if (!self.hasSetDefaultText) {
        [self setText:text];
        self.hasSetDefaultText = YES;
    }
}

- (void)setTextColor:(NSColor *)color
{
    _storedTextColor = color;
    if (_multiline) {
        [self applyTextColorToTextView];
    } else if (_textField) {
        _textField.textColor = color;
    }
}

- (void)applyTextColorToTextView
{
    if (!_textView || !_storedTextColor) {
        return;
    }
    _textView.textColor = _storedTextColor;
    _textView.insertionPointColor = _storedTextColor;

    // Set typing attributes so new text uses this color
    NSMutableDictionary *attrs = [_textView.typingAttributes mutableCopy] ?: [NSMutableDictionary dictionary];
    attrs[NSForegroundColorAttributeName] = _storedTextColor;
    if (_storedFont) {
        attrs[NSFontAttributeName] = _storedFont;
    }
    _textView.typingAttributes = attrs;

    // Update existing text color
    if (_textView.string.length > 0) {
        NSRange fullRange = NSMakeRange(0, _textView.string.length);
        [_textView.textStorage addAttribute:NSForegroundColorAttributeName value:_storedTextColor range:fullRange];
    }
}

- (void)setFontSize:(CGFloat)fontSize
{
    _storedFont = [NSFont systemFontOfSize:fontSize];
    if (_multiline) {
        _textView.font = _storedFont;
        // Update typing attributes with new font
        if (_storedTextColor) {
            [self applyTextColorToTextView];
        }
    } else if (_textField) {
        _textField.font = _storedFont;
    }
}

- (void)setSecureTextEntry:(BOOL)secure
{
    // Only supported for single-line
    if (!_multiline && secure) {
        NSSecureTextFieldCell *secureCell = [[NSSecureTextFieldCell alloc] initTextCell:_textField.stringValue];
        secureCell.scrollable = YES;
        secureCell.wraps = NO;
        _textField.cell = secureCell;
    }
}

- (void)setEditable:(BOOL)editable
{
    if (_multiline) {
        _textView.editable = editable;
    } else {
        _textField.editable = editable;
    }
}

- (void)setSelectable:(BOOL)selectable
{
    if (_multiline) {
        _textView.selectable = selectable;
    } else {
        _textField.selectable = selectable;
    }
}

- (NSString *)text
{
    if (_multiline) {
        return _textView.string;
    }
    return _textField.stringValue;
}

- (void)focus
{
    if (_multiline) {
        [self.window makeFirstResponder:_textView];
    } else {
        [self.window makeFirstResponder:_textField];
    }
}

- (void)blur
{
    NSResponder *firstResponder = self.window.firstResponder;
    if (firstResponder == _textField || firstResponder == _textView ||
        [firstResponder isKindOfClass:[NSTextView class]]) {
        [self.window makeFirstResponder:nil];
    }
}

- (NSSize)intrinsicContentSize
{
    if (_multiline) {
        return NSMakeSize(NSViewNoIntrinsicMetric, 64);
    }
    return NSMakeSize(NSViewNoIntrinsicMetric, 22);
}

@end

@implementation TextInputMacManager

RCT_EXPORT_MODULE(TextInputMac)

- (NSView *)view
{
    return [[TextInputMacView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(onChangeText, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSubmit, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onFocus, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onBlur, RCTBubblingEventBlock)

RCT_CUSTOM_VIEW_PROPERTY(placeholder, NSString, TextInputMacView)
{
    [view setPlaceholder:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(placeholderTextColor, NSColor, TextInputMacView)
{
    [view setPlaceholderTextColor:[RCTConvert NSColor:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(defaultText, NSString, TextInputMacView)
{
    [view setDefaultText:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(text, NSString, TextInputMacView)
{
    [view setText:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(textColor, NSColor, TextInputMacView)
{
    [view setTextColor:[RCTConvert NSColor:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(fontSize, CGFloat, TextInputMacView)
{
    [view setFontSize:[RCTConvert CGFloat:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(secureTextEntry, BOOL, TextInputMacView)
{
    [view setSecureTextEntry:[RCTConvert BOOL:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(editable, BOOL, TextInputMacView)
{
    [view setEditable:[RCTConvert BOOL:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(selectable, BOOL, TextInputMacView)
{
    [view setSelectable:[RCTConvert BOOL:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(multiline, BOOL, TextInputMacView)
{
    [view setMultilineEnabled:[RCTConvert BOOL:json]];
}

RCT_EXPORT_METHOD(focus:(nonnull NSNumber *)reactTag)
{
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, NSView *> *viewRegistry) {
        TextInputMacView *view = (TextInputMacView *)viewRegistry[reactTag];
        if (view && [view isKindOfClass:[TextInputMacView class]]) {
            [view focus];
        }
    }];
}

RCT_EXPORT_METHOD(blur:(nonnull NSNumber *)reactTag)
{
    [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, NSView *> *viewRegistry) {
        TextInputMacView *view = (TextInputMacView *)viewRegistry[reactTag];
        if (view && [view isKindOfClass:[TextInputMacView class]]) {
            [view blur];
        }
    }];
}

@end
