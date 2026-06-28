// src/lib/search/searchWorker.ts
// Dedicated Web Worker: owns the warm Fuse index off the main thread.
// RPC by message `id`; `sync` warms the index, `search` queries it.
/// <reference lib="webworker" />
import type Fuse from 'fuse.js';
import { buildFuse, inflateIndex, runSearch } from './engine';
import type { SearchEntry, WorkerRequest, WorkerResponse } from './types';

let fuse: Fuse<SearchEntry> | null = null;

async function doSync(url: string): Promise<void> {
	fuse = buildFuse(await inflateIndex(await fetch(url)));
}

addEventListener('message', async (ev: MessageEvent<WorkerRequest>) => {
	const msg = ev.data;
	const reply = (r: WorkerResponse) => (postMessage as (m: unknown) => void)(r);
	try {
		if (msg.type === 'sync') {
			await doSync(msg.url);
			reply({ id: msg.id, ok: true });
		} else if (msg.type === 'search') {
			const result = fuse ? runSearch(fuse, msg.query, msg.context, msg.limit) : [];
			reply({ id: msg.id, ok: true, result });
		}
	} catch (e) {
		reply({ id: msg.id, ok: false, error: String((e as Error)?.message || e) });
	}
});
