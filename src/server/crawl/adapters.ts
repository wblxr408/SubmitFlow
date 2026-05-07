import type { SourceAdapter } from './types';
import { NeituiyaAdapter } from './sources/neituiya';
import { NiukeAdapter } from './sources/niuke';
import { ShixisengAdapter } from './sources/shixiseng';
import { YingjieshengAdapter } from './sources/yingjiesheng';
import { Job51Adapter } from './sources/51job';
import { ZhipinAdapter } from './sources/zhipin';
import { CompanyCareersAdapter } from './sources/companycareers';
import { TianyanchaAdapter } from './sources/tianyancha';
import { UniversityAdapter } from './sources/university';

const neituiyaAdapter = new NeituiyaAdapter();
const niukeAdapter = new NiukeAdapter();
const shixisengAdapter = new ShixisengAdapter();
const yingjieshengAdapter = new YingjieshengAdapter();
const job51Adapter = new Job51Adapter();
const zhipinAdapter = new ZhipinAdapter();
const companyCareersAdapter = new CompanyCareersAdapter();
const tianyanchaAdapter = new TianyanchaAdapter();
const universityAdapter = new UniversityAdapter();

const sourceAdapters = new Map<string, SourceAdapter>([
  [neituiyaAdapter.sourceName, neituiyaAdapter],
  [niukeAdapter.sourceName, niukeAdapter],
  [shixisengAdapter.sourceName, shixisengAdapter],
  [yingjieshengAdapter.sourceName, yingjieshengAdapter],
  [job51Adapter.sourceName, job51Adapter],
  [zhipinAdapter.sourceName, zhipinAdapter],
  [companyCareersAdapter.sourceName, companyCareersAdapter],
  [tianyanchaAdapter.sourceName, tianyanchaAdapter],
  [universityAdapter.sourceName, universityAdapter],
]);

export function getSourceAdapter(sourceName: string): SourceAdapter | undefined {
  return sourceAdapters.get(sourceName);
}

export function getSupportedSourceNames(): string[] {
  return [...sourceAdapters.keys()];
}
