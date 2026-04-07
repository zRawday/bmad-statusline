// SelectWithPreview.js — Custom select with try-before-you-buy (onHighlight callback)

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

const e = React.createElement;

export function SelectWithPreview({ options, defaultValue, onChange, onHighlight, isActive }) {
  const defaultIndex = Math.max(0, options.findIndex(o => o.value === defaultValue));
  const [index, setIndex] = useState(defaultIndex);

  useEffect(() => {
    if (onHighlight && options[defaultIndex]) {
      onHighlight(options[defaultIndex].value);
    }
  }, []);

  useInput((input, key) => {
    if (key.upArrow) {
      const next = Math.max(0, index - 1);
      if (next !== index) {
        setIndex(next);
        if (onHighlight) onHighlight(options[next].value);
      }
    }
    if (key.downArrow) {
      const next = Math.min(options.length - 1, index + 1);
      if (next !== index) {
        setIndex(next);
        if (onHighlight) onHighlight(options[next].value);
      }
    }
    if (key.return) {
      if (onChange) onChange(options[index].value);
    }
  }, { isActive });

  return e(Box, { flexDirection: 'column' },
    ...options.map((opt, i) =>
      e(Text, { key: opt.value },
        i === index ? '> ' : '  ',
        opt.label
      )
    )
  );
}
