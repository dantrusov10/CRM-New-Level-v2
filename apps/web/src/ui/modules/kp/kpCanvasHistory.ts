import type { KpPdfBlock } from "./types";

export type KpHistoryState = {
  past: KpPdfBlock[][];
  present: KpPdfBlock[];
  future: KpPdfBlock[][];
};

export function createHistory(blocks: KpPdfBlock[]): KpHistoryState {
  return { past: [], present: cloneBlocks(blocks), future: [] };
}

function cloneBlocks(blocks: KpPdfBlock[]): KpPdfBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as KpPdfBlock[];
}

export function pushHistory(state: KpHistoryState, next: KpPdfBlock[]): KpHistoryState {
  return {
    past: [...state.past, cloneBlocks(state.present)].slice(-40),
    present: cloneBlocks(next),
    future: [],
  };
}

export function undoHistory(state: KpHistoryState): KpHistoryState | null {
  if (!state.past.length) return null;
  const prev = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: cloneBlocks(prev),
    future: [cloneBlocks(state.present), ...state.future],
  };
}

export function redoHistory(state: KpHistoryState): KpHistoryState | null {
  if (!state.future.length) return null;
  const next = state.future[0];
  return {
    past: [...state.past, cloneBlocks(state.present)],
    present: cloneBlocks(next),
    future: state.future.slice(1),
  };
}
