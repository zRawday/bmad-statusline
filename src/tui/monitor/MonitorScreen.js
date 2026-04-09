// MonitorScreen.js — Monitor: tabs, badges, file tree, bash sections, scroll, reorder

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ShortcutBar } from '../components/ShortcutBar.js';
import LlmBadge from './components/LlmBadge.js';
import SessionTabs from './components/SessionTabs.js';
import { pollSessions, groupSessionsByProject, computeDisplayState, filterReadOnly, findFirstSelectable, findNextSelectable, mergeChronology, generateCsv, writeCsvExport, STORY_WORKFLOWS, formatStoryTitle, resolveProjectColor } from './monitor-utils.js';
import { MonitorDetailScreen } from './MonitorDetailScreen.js';
import { ExportPrompt } from './components/ExportPrompt.js';
import ScrollableViewport from './components/ScrollableViewport.js';
import { renderFileSection } from './components/FileTreeSection.js';
import { renderBashSection } from './components/BashSection.js';

const e = React.createElement;

function useSessionPolling(cachePath, pollInterval = 1500) {
  const [sessions, setSessions] = useState([]);
  const lastJson = useRef('');
  useEffect(() => {
    lastJson.current = '';
    function poll() {
      const next = pollSessions(cachePath);
      const json = JSON.stringify(next);
      if (json !== lastJson.current) {
        lastJson.current = json;
        setSessions(next);
      }
    }
    poll();
    const id = setInterval(poll, pollInterval);
    return () => clearInterval(id);
  }, [cachePath, pollInterval]);
  return sessions;
}

function getShortcuts(navMode, detailMode, toggleState, reorderMode, reorderGrabbed, { hasSubAgents, canScroll } = {}) {
  if (reorderMode) {
    if (reorderGrabbed) {
      return [
        { key: '\u25C4\u25BA', label: 'move', color: 'cyan' },
        { key: 'Enter', label: 'drop', color: 'green' },
        { key: 'Esc', label: 'cancel' },
      ];
    }
    return [
      { key: '\u25C4\u25BA', label: 'navigate', color: 'cyan' },
      { key: 'Enter', label: 'grab', color: 'green' },
      { key: 'Esc', label: 'back' },
    ];
  }
  if (detailMode === 'detail') {
    const detail = [
      { key: '\u2191\u2193', label: 'navigate', color: 'cyan' },
      { key: 'Enter', label: 'open', color: 'green' },
    ];
    if (hasSubAgents) detail.push({ key: 'f', label: 'Subagents', color: 'magenta', checked: toggleState.showSubAgents });
    detail.push({ key: 'b', label: 'Bash', color: 'magenta', checked: toggleState.showBash });
    detail.push({ key: 's', label: 'sort', color: 'magenta', checked: toggleState.sortMode === 'alpha' });
    detail.push({ key: 't', label: 'time', color: 'magenta', checked: toggleState.timeFormat === 'relative' });
    detail.push({ key: 'Esc', label: 'back' });
    return detail;
  }
  const shortcuts = [];
  if (navMode === 'multi-project') {
    shortcuts.push({ key: '\u25C4\u25BA', label: 'projects', color: 'cyan' });
    shortcuts.push({ key: 'Tab', label: 'sessions', color: 'cyan' });
    shortcuts.push({ key: 'r', label: 'reorder projects', color: 'cyan' });
    shortcuts.push({ key: 'R', label: 'reorder sessions', color: 'cyan' });
  } else if (navMode === 'single-project') {
    shortcuts.push({ key: '\u25C4\u25BA', label: 'sessions', color: 'cyan' });
    shortcuts.push({ key: 'R', label: 'reorder sessions', color: 'cyan' });
  }
  shortcuts.push({ key: 'd', label: 'detail', color: 'yellow' });
  if (canScroll) shortcuts.push({ key: '\u2191\u2193', label: 'scroll', color: 'cyan' });
  shortcuts.push({ key: 'c', label: 'timeline', color: 'yellow' });
  shortcuts.push({ key: 'e', label: 'export', color: 'green' });
  if (hasSubAgents) shortcuts.push({ key: 'f', label: 'Subagents', color: 'magenta', checked: toggleState.showSubAgents });
  shortcuts.push({ key: 'b', label: 'Bash', color: 'magenta', checked: toggleState.showBash });
  shortcuts.push({ key: 'Esc', label: 'home' });
  return shortcuts;
}

export function MonitorScreen({ config, navigate, goBack, isActive, paths, pollInterval }) {
  const sessions = useSessionPolling(paths.cachePath, pollInterval);
  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  const [reorderMode, setReorderMode] = useState(null);
  const [reorderCursor, setReorderCursor] = useState(0);
  const [reorderGrabbed, setReorderGrabbed] = useState(false);
  const [reorderSnapshot, setReorderSnapshot] = useState(null);
  const [projectOrder, setProjectOrder] = useState(null);
  const [sessionOrders, setSessionOrders] = useState({});
  const [detailMode, setDetailMode] = useState('normal'); // 'normal' | 'detail'
  const [cursorIndex, setCursorIndex] = useState(-1);
  const [detailItem, setDetailItem] = useState(null);
  const [exportMode, setExportMode] = useState(null); // null | 'prompt' | 'confirm'
  const [confirmPath, setConfirmPath] = useState('');
  const [timeFormat, setTimeFormat] = useState('absolute');
  const [sortMode, setSortMode] = useState('chrono');
  const [showSubAgents, setShowSubAgents] = useState(true);
  const [showBash, setShowBash] = useState(false);

  // Derived state — session grouping and navigation
  const groups = groupSessionsByProject(sessions);
  const naturalKeys = [...groups.keys()];
  const projectKeys = projectOrder
    ? projectOrder.filter(k => groups.has(k)).concat(naturalKeys.filter(k => !projectOrder.includes(k)))
    : naturalKeys;
  const clampedProjectIndex = Math.min(activeProjectIndex, Math.max(0, projectKeys.length - 1));
  const activeProject = projectKeys[clampedProjectIndex];
  const projectSessions = groups.get(activeProject) || [];
  const orderedSessions = sessionOrders[activeProject]
    ? sessionOrders[activeProject].map(id => projectSessions.find(s => s.sessionId === id)).filter(Boolean)
    : projectSessions;
  const clampedSessionIndex = Math.min(activeSessionIndex, Math.max(0, orderedSessions.length - 1));
  const currentSession = orderedSessions[clampedSessionIndex] || null;
  const mode = projectKeys.length > 1 ? 'multi-project'
    : orderedSessions.length > 1 ? 'single-project'
    : 'single-session';

  // Ordered groups map for SessionTabs
  const orderedGroups = new Map();
  for (const k of projectKeys) {
    const pSessions = groups.get(k) || [];
    const ordered = sessionOrders[k]
      ? sessionOrders[k].map(id => pSessions.find(s => s.sessionId === id)).filter(Boolean)
      : pSessions;
    orderedGroups.set(k, ordered);
  }

  // Build section content from current session
  const rawWrites = currentSession ? (currentSession.writes || []) : [];
  const rawReads = currentSession ? (currentSession.reads || []) : [];
  const rawCommands = currentSession ? (currentSession.commands || []) : [];
  const rawReadOnly = filterReadOnly(rawReads, rawWrites);

  // Sub-agent filtering
  const noAgent = entry => entry.agent_id === null || entry.agent_id === undefined;
  const writes = showSubAgents ? rawWrites : rawWrites.filter(noAgent);
  const readOnly = showSubAgents ? rawReadOnly : rawReadOnly.filter(noAgent);
  const commands = showSubAgents ? rawCommands : rawCommands.filter(noAgent);

  // Apply sortMode to entries before rendering (Task 5.8)
  const sortEntries = (arr, key) => {
    if (sortMode === 'alpha') return [...arr].sort((a, b) => (a[key] || '').localeCompare(b[key] || ''));
    return arr; // chrono = natural order from hook
  };
  const sortedWrites = sortEntries(writes, 'path');
  const sortedReadOnly = sortEntries(readOnly, 'path');
  const sortedCommands = sortEntries(commands, 'cmd');

  // Detect sub-agent activity from raw (unfiltered) data
  const hasAgent = entry => entry.agent_id !== null && entry.agent_id !== undefined;
  const hasSubAgents = rawWrites.some(hasAgent) || rawReads.some(hasAgent) || rawCommands.some(hasAgent);

  const writesResult = renderFileSection('EDITED FILES', sortedWrites);
  const readsResult = renderFileSection('READ FILES', sortedReadOnly);
  const bashResult = showBash ? renderBashSection(sortedCommands) : { elements: [], items: [] };

  // Concatenate sections with spacers between non-empty ones
  const sectionPairs = [writesResult, readsResult, bashResult];
  const allItems = [];
  const items = [];
  for (let i = 0; i < sectionPairs.length; i++) {
    const section = sectionPairs[i];
    if (section.items.length === 0) continue;
    if (allItems.length > 0) {
      allItems.push({ text: ' ', selectable: false, type: 'spacer' });
      items.push(e(Text, { key: `section-sep-${i}` }, ' '));
    }
    allItems.push(...section.items);
    items.push(...section.elements);
  }

  const rows = (stdout && stdout.rows) || 24;

  // Dynamic header/footer row count for sticky layout
  // All spacers render as Text(' ') = 1 row — count them
  const showTabs = sessions.length > 0 && mode !== 'single-session';
  let headerRows = 2; // title + spacer after title
  if (showTabs) {
    headerRows += mode === 'multi-project' ? 3 : 1; // SessionTabs (multi: project+spacer+session)
    headerRows += 1; // spacer after tabs
  }
  headerRows += 1; // spacer before badge
  if (currentSession) headerRows += 1; // LlmBadge
  const footerRows = 2; // spacer after viewport + shortcuts

  // Always reserve 2 rows for ScrollableViewport indicator placeholders
  const rawAvailable = rows - headerRows - footerRows;
  const viewportHeight = Math.max(1, rawAvailable - 2);
  const effectiveScrollOffset = Math.min(scrollOffset, Math.max(0, items.length - viewportHeight));

  // Reset scroll and detail state when active session changes
  const sessionId = currentSession ? currentSession.sessionId : null;
  useEffect(() => {
    setScrollOffset(0);
    setDetailMode('normal');
    setCursorIndex(-1);
    setDetailItem(null);
    setExportMode(null);
    setConfirmPath('');
  }, [sessionId]);

  // Auto-scroll cursor into view
  useEffect(() => {
    if (detailMode === 'detail' && cursorIndex >= 0) {
      if (cursorIndex < scrollOffset) setScrollOffset(cursorIndex);
      else if (cursorIndex >= scrollOffset + viewportHeight)
        setScrollOffset(cursorIndex - viewportHeight + 1);
    }
  }, [cursorIndex, detailMode]);

  // Clamp scroll offset when items shrink
  useEffect(() => {
    const maxOffset = Math.max(0, items.length - viewportHeight);
    if (scrollOffset > maxOffset) setScrollOffset(maxOffset);
  }, [items.length, viewportHeight]);

  // Clamp cursor index when items shrink (e.g., sub-agent toggle in detail mode)
  useEffect(() => {
    if (detailMode === 'detail' && cursorIndex >= allItems.length) {
      const first = findFirstSelectable(allItems);
      setCursorIndex(first >= 0 ? first : -1);
    }
  }, [allItems.length, detailMode]);

  useInput((input, key) => {
    if (reorderMode) return;

    // Detail mode input handling
    if (detailMode === 'detail') {
      if (key.escape) { setDetailMode('normal'); setCursorIndex(-1); return; }
      if (key.upArrow) { setCursorIndex(prev => findNextSelectable(allItems, prev, -1)); return; }
      if (key.downArrow) { setCursorIndex(prev => findNextSelectable(allItems, prev, 1)); return; }
      if (key.return && allItems[cursorIndex]?.selectable) { setDetailItem(allItems[cursorIndex]); return; }
      // Toggle keys in detail cursor mode
      if (input === 'f') { setShowSubAgents(prev => !prev); return; }
      if (input === 'b') { setShowBash(prev => !prev); return; }
      if (input === 's') { setSortMode(prev => prev === 'chrono' ? 'alpha' : 'chrono'); return; }
      if (input === 't') { setTimeFormat(prev => prev === 'absolute' ? 'relative' : 'absolute'); return; }
      return;
    }

    // Normal mode
    if (key.escape) { goBack(); return; }
    if (input === 'd') { const first = findFirstSelectable(allItems); if (first >= 0) { setDetailMode('detail'); setCursorIndex(first); } return; }
    if (input === 'c' && currentSession) { setDetailItem({ type: 'chronology', text: 'timeline', selectable: false, data: null }); return; }
    if (input === 'e' && currentSession) { setExportMode('prompt'); return; }

    // Scroll
    if (key.upArrow) { setScrollOffset(prev => Math.max(0, prev - 1)); return; }
    if (key.downArrow) { setScrollOffset(prev => Math.min(Math.max(0, items.length - viewportHeight), prev + 1)); return; }

    // Tab navigation
    if (mode === 'multi-project') {
      if (key.leftArrow) {
        setActiveProjectIndex(prev => (prev - 1 + projectKeys.length) % projectKeys.length);
        setActiveSessionIndex(0);
      } else if (key.rightArrow) {
        setActiveProjectIndex(prev => (prev + 1) % projectKeys.length);
        setActiveSessionIndex(0);
      }
      if (key.tab && orderedSessions.length > 0) {
        setActiveSessionIndex(prev => (prev + 1) % orderedSessions.length);
      }
    } else if (mode === 'single-project' && orderedSessions.length > 0) {
      if (key.leftArrow) setActiveSessionIndex(prev => (prev - 1 + orderedSessions.length) % orderedSessions.length);
      if (key.rightArrow) setActiveSessionIndex(prev => (prev + 1) % orderedSessions.length);
    }

    // Toggle keys in normal mode
    if (input === 'f') { setShowSubAgents(prev => !prev); return; }
    if (input === 'b') { setShowBash(prev => !prev); return; }

    // Reorder triggers — initialize order arrays so we can swap in them
    if (input === 'r' && projectKeys.length > 1) {
      if (!projectOrder) setProjectOrder([...projectKeys]);
      setReorderCursor(0);
      setReorderGrabbed(false);
      setReorderMode('projects');
    }
    if (input === 'R' && orderedSessions.length > 1) {
      if (!sessionOrders[activeProject]) {
        setSessionOrders(prev => ({ ...prev, [activeProject]: orderedSessions.map(s => s.sessionId) }));
      }
      setReorderCursor(0);
      setReorderGrabbed(false);
      setReorderMode('sessions');
    }
  }, { isActive: isActive && !reorderMode && !detailItem && !exportMode });

  // Export handlers
  function handleExport(mode) {
    try {
      const csv = generateCsv(mode, writes, readOnly, commands);
      const filePath = writeCsvExport(paths.outputFolder, mode, csv);
      setExportMode('confirm');
      setConfirmPath(filePath);
    } catch (err) {
      setExportMode('confirm');
      setConfirmPath('Error: ' + String(err.message || err || 'export failed'));
    }
  }

  // Confirmation dismiss — any key returns to normal
  useInput(() => {
    setExportMode(null);
    setConfirmPath('');
  }, { isActive: isActive && exportMode === 'confirm' });

  // Reorder input handler — inline tab reorder
  useInput((input, key) => {
    const items = reorderMode === 'projects' ? projectOrder : (sessionOrders[activeProject] || []);
    const maxIdx = items.length - 1;
    // Clamp cursor if items shrank (e.g. session disappeared during reorder)
    const cursor = Math.min(reorderCursor, maxIdx);
    if (cursor !== reorderCursor) setReorderCursor(cursor);
    if (maxIdx < 0) { setReorderMode(null); return; }

    if (reorderGrabbed) {
      if (key.leftArrow && cursor > 0) {
        const newItems = [...items];
        [newItems[cursor - 1], newItems[cursor]] = [newItems[cursor], newItems[cursor - 1]];
        if (reorderMode === 'projects') setProjectOrder(newItems);
        else setSessionOrders(prev => ({ ...prev, [activeProject]: newItems }));
        setReorderCursor(prev => prev - 1);
      } else if (key.rightArrow && cursor < maxIdx) {
        const newItems = [...items];
        [newItems[cursor], newItems[cursor + 1]] = [newItems[cursor + 1], newItems[cursor]];
        if (reorderMode === 'projects') setProjectOrder(newItems);
        else setSessionOrders(prev => ({ ...prev, [activeProject]: newItems }));
        setReorderCursor(prev => prev + 1);
      } else if (key.return) {
        // Drop — save and return to navigate
        setReorderGrabbed(false);
        setReorderSnapshot(null);
      } else if (key.escape) {
        // Cancel — revert to pre-grab state
        if (reorderSnapshot) {
          if (reorderMode === 'projects') setProjectOrder(reorderSnapshot);
          else setSessionOrders(prev => ({ ...prev, [activeProject]: reorderSnapshot }));
        }
        setReorderGrabbed(false);
        setReorderSnapshot(null);
      }
    } else {
      // Navigate mode
      if (key.leftArrow) {
        setReorderCursor(prev => Math.max(0, prev - 1));
      } else if (key.rightArrow) {
        setReorderCursor(prev => Math.min(maxIdx, prev + 1));
      } else if (key.return) {
        // Grab
        setReorderSnapshot([...items]);
        setReorderGrabbed(true);
      } else if (key.escape) {
        // Exit reorder
        setReorderMode(null);
      }
    }
  }, { isActive: isActive && !!reorderMode });

  // Detail page overlay
  if (detailItem) {
    const getDetailEntries = (item) => {
      if (item.type === 'chronology') return mergeChronology(writes, readOnly, commands);
      if (item.type === 'file' && item.data.op) return writes.filter(w => w.path === item.data.path);
      if (item.type === 'file' && !item.data.op) return readOnly.filter(r => r.path === item.data.path);
      if (item.type === 'command') return item.data.entries;
      return [];
    };
    const detailEntries = getDetailEntries(detailItem);
    return e(Box, { flexDirection: 'column', height: '100%' },
      e(MonitorDetailScreen, {
        item: detailItem,
        entries: detailEntries,
        onBack: () => setDetailItem(null),
        isActive: isActive,
        sortMode,
        timeFormat,
        onToggleSort: () => setSortMode(prev => prev === 'chrono' ? 'alpha' : 'chrono'),
        onToggleTime: () => setTimeFormat(prev => prev === 'absolute' ? 'relative' : 'absolute'),
      }),
    );
  }

  // Build display items with cursor prefix in detail mode
  const displayItems = detailMode === 'detail'
    ? items.map((el, i) => e(Box, { key: `d-${i}` },
        e(Text, { color: i === cursorIndex ? 'cyan' : undefined, bold: i === cursorIndex },
          i === cursorIndex ? '❯ ' : '  '),
        el
      ))
    : items;

  // Badge props — computed outside render to keep JSX clean
  const badgeProps = currentSession ? {
    state: computeDisplayState(currentSession),
    workflow: currentSession.workflow || currentSession.skill,
    startedAt: currentSession.started_at,
    contextLabel: STORY_WORKFLOWS.includes(currentSession.workflow) && currentSession.story
      ? formatStoryTitle(currentSession.story)
      : !STORY_WORKFLOWS.includes(currentSession.workflow) && currentSession.document_name
        ? currentSession.document_name
        : '',
  } : { state: 'inactive', workflow: '', startedAt: '', contextLabel: '' };

  return e(Box, { flexDirection: 'column', height: rows },
    // Sticky top: title + session count
    e(Text, { bold: true, color: 'cyan' }, 'MONITOR',
      activeProject && projectKeys.length === 1 ? e(Text, { color: resolveProjectColor(activeProject, config) }, `  ${activeProject}  `) : '  ',
      e(Text, { dimColor: true }, `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`)),
    e(Text, null, ' '),
    // Tabs — stable wrapper Box avoids yoga insertChild on root (prevents x-offset bug)
    e(Box, { flexDirection: 'column', display: showTabs ? 'flex' : 'none' },
      e(SessionTabs, {
        groups: orderedGroups, activeProject, activeSessionIndex: clampedSessionIndex, config, mode,
        reorderTarget: reorderMode, reorderCursor, reorderGrabbed,
      }),
      e(Text, null, ' '),
    ),
    e(Text, null, ' '),
    // Badge — stable wrapper Box (same pattern)
    e(Box, { display: currentSession ? 'flex' : 'none' },
      e(LlmBadge, badgeProps),
    ),
    // Content — hidden during reorder
    reorderMode
      ? null
      : sessions.length === 0
        ? e(Text, { dimColor: true }, 'No active BMAD session')
        : displayItems.length === 0
          ? null
          : e(ScrollableViewport, { items: displayItems, height: viewportHeight, scrollOffset: effectiveScrollOffset }),
    e(Text, null, ' '),
    // Sticky bottom — shortcut bar or export prompt/confirmation
    exportMode === 'prompt'
      ? e(ExportPrompt, { onSelect: handleExport, onCancel: () => setExportMode(null), isActive })
      : exportMode === 'confirm'
        ? e(Text, { dimColor: true }, confirmPath.startsWith('Error:') ? confirmPath : 'Exported: ' + confirmPath)
        : e(ShortcutBar, { actions: getShortcuts(mode, detailMode, { showSubAgents, showBash, sortMode, timeFormat }, reorderMode, reorderGrabbed, { hasSubAgents, canScroll: items.length > viewportHeight }) }),
  );
}
