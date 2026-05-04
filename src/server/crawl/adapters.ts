import type { SourceAdapter } from './types';
import { NeituiyaAdapter } from './sources/neituiya';
import { NiukeAdapter } from './sources/niuke';

const neituiyaAdapter = new NeituiyaAdapter();
const niukeAdapter = new NiukeAdapter();

const sourceAdapters = new Map<string, SourceAdapter>([
  [neituiyaAdapter.sourceName, neituiyaAdapter],
  [niukeAdapter.sourceName, niukeAdapter],
]);

export function getSourceAdapter(sourceName: string): SourceAdapter | undefined {
  return sourceAdapters.get(sourceName);
}

export function getSupportedSourceNames(): string[] {
  return [...sourceAdapters.keys()];
}
