## Plan
Stop storing `thumbnailKey`; derive it on demand at playback and simplify cache handling.

## Steps
- [ ] Add plan describing removal of stored thumbnail keys and derive-on-demand flow.
- [ ] Remove thumbnailKey persistence from caches/types and derive URIs when hydrating queue/library.
- [ ] Update runtime thumbnail resolution to compute keys on demand without saving, and tidy related helpers.
