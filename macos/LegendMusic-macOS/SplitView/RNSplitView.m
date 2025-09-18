#import "RNSplitView.h"
#import <React/RCTView.h>
#import <React/RCTLog.h>

static const CGFloat kMinimumPrimarySize = 220.0;
static const CGFloat kMinimumSecondarySize = 320.0;

@interface RNSplitView () <NSSplitViewDelegate>

@property (nonatomic, assign) BOOL initialDividerPositionSet;

@end

@implementation RNSplitView {
    CGFloat _lastDividerPosition;
}

@synthesize dividerThickness = _dividerThickness;

- (instancetype)init
{
    self = [super init];
    if (self) {
        self.delegate = self;
        self.dividerStyle = NSSplitViewDividerStylePaneSplitter;
        self.isVertical = YES;
        self.dividerThickness = 6.0;

        // Default to vertical split view
        self.vertical = YES;

        // Allow the split view to resize with its container managed by React Native
        self.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;

        // Manage layout manually to avoid constraint conflicts
        self.arrangesAllSubviews = NO;
        self.initialDividerPositionSet = NO;
        _lastDividerPosition = 0.0f;
    }
    return self;
}

- (void)setIsVertical:(BOOL)isVertical
{
    _isVertical = isVertical;
    self.vertical = isVertical;
}

- (void)setDividerThickness:(CGFloat)dividerThickness
{
    _dividerThickness = MAX(1.0, dividerThickness);
    [self setNeedsDisplayInRect:self.bounds];
    [self adjustSubviews];
}

- (CGFloat)dividerThickness
{
    return _dividerThickness;
}

// MARK: - NSSplitViewDelegate

- (void)drawDividerInRect:(NSRect)rect
{
    [[NSColor colorWithCalibratedWhite:0.85 alpha:0.9] setFill];
    NSRectFill(rect);

    CGFloat inset = rect.size.width > 2.0 ? rect.size.width * 0.3 : 0.0;
    NSRect highlightRect = NSInsetRect(rect, inset, 0.0);
    [[NSColor colorWithCalibratedWhite:1.0 alpha:0.45] setFill];
    NSRectFill(highlightRect);

    [[NSColor colorWithCalibratedWhite:0.35 alpha:0.6] setFill];
    NSRect bottomLine = NSMakeRect(rect.origin.x, rect.origin.y, rect.size.width, 1.0);
    NSRectFill(bottomLine);
    NSRect topLine = NSMakeRect(rect.origin.x, NSMaxY(rect) - 1.0, rect.size.width, 1.0);
    NSRectFill(topLine);
}

- (void)setPosition:(CGFloat)position ofDividerAtIndex:(NSInteger)dividerIndex
{
    CGFloat totalSize = self.isVertical ? self.bounds.size.width : self.bounds.size.height;
    if (totalSize > 0) {
        position = [self clampedDividerPosition:position totalSize:totalSize];
    }

    [super setPosition:position ofDividerAtIndex:dividerIndex];
    _lastDividerPosition = position;
}

- (void)splitViewDidResizeSubviews:(NSNotification *)notification
{
    if (self.subviews.count >= 1) {
        NSView *firstSubview = self.subviews.firstObject;
        if (firstSubview) {
            _lastDividerPosition = self.isVertical ? firstSubview.frame.size.width : firstSubview.frame.size.height;
        }
    }

    if (self.onSplitViewDidResize) {
        NSArray<NSView *> *subviews = self.subviews;
        NSMutableArray *sizes = [NSMutableArray array];

        for (NSView *subview in subviews) {
            if (self.isVertical) {
                [sizes addObject:@(subview.frame.size.width)];
            } else {
                [sizes addObject:@(subview.frame.size.height)];
            }
        }

        self.onSplitViewDidResize(@{
            @"sizes": sizes,
            @"isVertical": @(self.isVertical)
        });
    }
}

- (BOOL)splitView:(NSSplitView *)splitView canCollapseSubview:(NSView *)subview
{
    return NO; // Prevent collapsing subviews
}

- (CGFloat)splitView:(NSSplitView *)splitView constrainMinCoordinate:(CGFloat)proposedMinimumPosition ofSubviewAt:(NSInteger)dividerIndex
{
    return MAX(proposedMinimumPosition, kMinimumPrimarySize);
}

- (CGFloat)splitView:(NSSplitView *)splitView constrainMaxCoordinate:(CGFloat)proposedMaximumPosition ofSubviewAt:(NSInteger)dividerIndex
{
    CGFloat totalSize = self.isVertical ? self.frame.size.width : self.frame.size.height;
    if (totalSize <= 0) {
        return proposedMaximumPosition;
    }

    CGFloat maxAllowed = totalSize - kMinimumSecondarySize;
    maxAllowed = MAX(kMinimumPrimarySize, maxAllowed);

    return MIN(proposedMaximumPosition, maxAllowed);
}

- (void)splitView:(NSSplitView *)splitView resizeSubviewsWithOldSize:(NSSize)oldSize
{
    CGFloat totalSize = self.isVertical ? self.bounds.size.width : self.bounds.size.height;
    if (totalSize <= 0 || self.subviews.count < 2) {
        [splitView adjustSubviews];
        return;
    }

    CGFloat desiredPosition = _lastDividerPosition;
    if (desiredPosition <= 0) {
        desiredPosition = totalSize * 0.3;
    }

    desiredPosition = [self clampedDividerPosition:desiredPosition totalSize:totalSize];
    [super setPosition:desiredPosition ofDividerAtIndex:0];
    _lastDividerPosition = desiredPosition;
}

- (void)insertReactSubview:(NSView *)subview atIndex:(NSInteger)atIndex
{
    // Override to properly add subviews to the split view
    [super insertReactSubview:subview atIndex:atIndex];

    // Ensure the subview doesn't have conflicting constraints
    subview.translatesAutoresizingMaskIntoConstraints = YES;
    subview.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;

    [self adjustSubviews];

    if (self.subviews.count >= 2) {
        self.initialDividerPositionSet = NO;
        [self setInitialDividerPositionIfNeeded];
    }
}

- (void)layout
{
    [super layout];

    [self setInitialDividerPositionIfNeeded];
}

- (void)reactSetFrame:(NSRect)frame
{
    [super reactSetFrame:frame];
    [self setInitialDividerPositionIfNeeded];
}

- (void)setInitialDividerPositionIfNeeded
{
    if (self.initialDividerPositionSet || self.subviews.count < 2) {
        return;
    }

    CGFloat totalSize = self.isVertical ? self.bounds.size.width : self.bounds.size.height;
    if (totalSize <= 0) {
        return;
    }

    CGFloat preferred = totalSize * 0.3;
    preferred = [self clampedDividerPosition:preferred totalSize:totalSize];

    [super setPosition:preferred ofDividerAtIndex:0];
    _lastDividerPosition = preferred;
    self.initialDividerPositionSet = YES;
}

- (CGFloat)clampedDividerPosition:(CGFloat)proposed totalSize:(CGFloat)totalSize
{
    CGFloat minPrimary = kMinimumPrimarySize;
    CGFloat maxPrimary = totalSize - kMinimumSecondarySize;
    maxPrimary = MAX(minPrimary, maxPrimary);

    if (proposed <= 0) {
        proposed = minPrimary;
    }

    if (proposed >= totalSize) {
        proposed = maxPrimary;
    }

    return MIN(MAX(proposed, minPrimary), maxPrimary);
}

@end

@implementation RNSplitViewManager

RCT_EXPORT_MODULE(RNSplitView)

- (NSView *)view
{
    return [[RNSplitView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(isVertical, BOOL)
RCT_EXPORT_VIEW_PROPERTY(dividerThickness, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(onSplitViewDidResize, RCTBubblingEventBlock)

@end
