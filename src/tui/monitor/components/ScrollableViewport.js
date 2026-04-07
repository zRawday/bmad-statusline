import React from 'react';
import { Box, Text } from 'ink';

const e = React.createElement;

function ScrollableViewport({ items, height, scrollOffset }) {
  if (!items || items.length === 0) {
    return e(Box, { flexDirection: 'column' });
  }

  const visible = items.slice(scrollOffset, scrollOffset + height);
  const above = scrollOffset;
  const below = Math.max(0, items.length - scrollOffset - height);

  const children = [];

  children.push(
    above > 0
      ? e(Text, { key: 'ind-above', dimColor: true }, `\u25B2 ${above} more`)
      : e(Text, { key: 'ind-above' }, ' '),
  );

  // Clone each visible item with:
  //  - scroll-offset key: forces React to unmount/remount on every scroll,
  //    so Ink redraws each line from scratch (no stale content)
  //  - wrap='truncate': prevents long lines from wrapping to multiple
  //    terminal rows, which would desync Ink's line position tracking
  // No Box wrapper — nested Text elements (tree dirs, indicator spans)
  // render incorrectly inside a constrained Box.
  for (let i = 0; i < height; i++) {
    if (i < visible.length) {
      children.push(
        React.cloneElement(visible[i], { key: `r${scrollOffset}-${i}`, wrap: 'truncate' }),
      );
    } else {
      children.push(e(Text, { key: `r${scrollOffset}-${i}` }, ' '));
    }
  }

  children.push(
    below > 0
      ? e(Text, { key: 'ind-below', dimColor: true }, `\u25BC ${below} more`)
      : e(Text, { key: 'ind-below' }, ' '),
  );

  return e(Box, { flexDirection: 'column', height: height + 2 }, ...children);
}

export default ScrollableViewport;
