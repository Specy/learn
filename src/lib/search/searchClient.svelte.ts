// src/lib/search/searchClient.svelte.ts
// Main-thread singleton: owns the search Web Worker, exposes reactive status,
// and falls back to in-thread search when Workers are unavailable. fuse.js is
// only pulled into the main bundle if the fallback actually runs (dynamic import).
import { browser } from '$app/environment';
import { base } from '$app/paths';
import type { SearchContext, SearchResult, WorkerRequest, WorkerResponse } from './types';
import type Fuse from 'fuse.js';
import type { SearchEntry } from './types';

export type SearchStatus = 'idle' | 'syncing' | 'ready' | 'error';

const INDEX_URL = `${base}/search-index.bin`;
const LIMIT = 20;

class SearchClient {
  status = $state<SearchStatus>('idle');
  searching = $state(false);

  #worker: Worker | null = null;
  #seq = 0;
  #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  #syncPromise: Promise<void> | null = null;

  // Main-thread fallback state (only used when Worker is unavailable).
  #mtFuse: Fuse<SearchEntry> | null = null;

  #ensureWorker(): Worker | null {
    if (!browser || typeof Worker === 'undefined') return null;
    if (this.#worker) return this.#worker;
    try {
      this.#worker = new Worker(new URL('./searchWorker.ts', import.meta.url), { type: 'module' });
      this.#worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
        const data = ev.data;
        const p = this.#pending.get(data.id);
        if (!p) return;
        this.#pending.delete(data.id);
        if (data.ok) p.resolve(data.result);
        else p.reject(new Error(data.error));
      };
      this.#worker.onerror = () => {
        // Drop the worker; subsequent calls fall back to the main thread.
        this.#worker = null;
      };
    } catch {
      this.#worker = null;
    }
    return this.#worker;
  }

  #post<T>(msg: WorkerRequest): Promise<T> {
    const w = this.#worker!;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(msg.id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage(msg);
    });
  }

  async #syncFallback(): Promise<void> {
    const { inflateIndex, buildFuse } = await import('./engine');
    this.#mtFuse = buildFuse(await inflateIndex(await fetch(INDEX_URL)));
  }

  /** Warm the index. Idempotent; safe to call on app mount and on modal open. */
  sync(): Promise<void> {
    if (!browser) return Promise.resolve();
    if (this.status === 'ready') return Promise.resolve();
    if (this.#syncPromise) return this.#syncPromise;

    this.status = 'syncing';
    const w = this.#ensureWorker();
    const run = w
      ? this.#post<void>({ id: ++this.#seq, type: 'sync', url: INDEX_URL })
      : this.#syncFallback();

    this.#syncPromise = run
      .then(() => {
        this.status = 'ready';
      })
      .catch((e) => {
        this.status = 'error';
        this.#syncPromise = null; // allow a later retry
        throw e;
      });
    return this.#syncPromise;
  }

  async search(query: string, context: SearchContext, limit = LIMIT): Promise<SearchResult[]> {
    if (!browser || !query.trim()) return [];
    this.searching = true;
    try {
      if (this.status !== 'ready') await this.sync();
      if (this.#worker) {
        return await this.#post<SearchResult[]>({
          id: ++this.#seq,
          type: 'search',
          query,
          context,
          limit
        });
      }
      if (this.#mtFuse) {
        const { runSearch } = await import('./engine');
        return runSearch(this.#mtFuse, query, context, limit);
      }
      return [];
    } catch {
      return [];
    } finally {
      this.searching = false;
    }
  }
}

export const searchClient = new SearchClient();
