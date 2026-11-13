export type WasmModuleId = 'ffmpeg-wasm' | 'imagemagick-wasm';

export interface WasmModuleDescriptor {
  id: WasmModuleId;
  label: string;
  version: string;
  cdnUrl: string;
  wasmUrl: string;
  estimatedSizeMB: number;
  requiresCrossOriginIsolation: boolean;
}

export interface WasmLoadStatus {
  id: WasmModuleId;
  cached: boolean;
  loaded: boolean;
  sizeMB: number;
  error?: string;
}

const WASM_CACHE_NAME = 'omniconvert-wasm-cache-v1';

export const WASM_MODULES: Record<WasmModuleId, WasmModuleDescriptor> = {
  'ffmpeg-wasm': {
    id: 'ffmpeg-wasm',
    label: 'FFmpeg WebAssembly Core',
    version: '0.12.6',
    cdnUrl: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmUrl: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    estimatedSizeMB: 31.2,
    requiresCrossOriginIsolation: true,
  },
  'imagemagick-wasm': {
    id: 'imagemagick-wasm',
    label: 'ImageMagick WebAssembly',
    version: '0.0.30',
    cdnUrl: 'https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.30/dist/index.js',
    wasmUrl: 'https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.30/dist/magick.wasm',
    estimatedSizeMB: 17.5,
    requiresCrossOriginIsolation: false,
  },
};

export class WasmLoaderError extends Error {
  readonly shouldEscalateToServer: boolean;

  constructor(message: string, shouldEscalateToServer = true) {
    super(message);
    this.name = 'WasmLoaderError';
    this.shouldEscalateToServer = shouldEscalateToServer;
  }
}

export class LazyWasmLoader {
  private readonly loadedBuffers = new Map<WasmModuleId, ArrayBuffer>();

  async isCached(id: WasmModuleId): Promise<boolean> {
    if (this.loadedBuffers.has(id)) return true;
    if (typeof caches === 'undefined') return false;
    try {
      const cache = await caches.open(WASM_CACHE_NAME);
      const match = await cache.match(WASM_MODULES[id].wasmUrl);
      return Boolean(match);
    } catch {
      return false;
    }
  }

  async getAllStatuses(): Promise<WasmLoadStatus[]> {
    const ids: WasmModuleId[] = ['ffmpeg-wasm', 'imagemagick-wasm'];
    return Promise.all(
      ids.map(async (id) => ({
        id,
        cached: await this.isCached(id),
        loaded: this.loadedBuffers.has(id),
        sizeMB: WASM_MODULES[id].estimatedSizeMB,
      })),
    );
  }

  async loadModuleBinary(
    id: WasmModuleId,
    options?: {
      signal?: AbortSignal;
      onProgress?: (percent: number, stage: string) => void;
    },
  ): Promise<ArrayBuffer> {
    const existing = this.loadedBuffers.get(id);
    if (existing) {
      options?.onProgress?.(100, `${WASM_MODULES[id].label} ready from memory`);
      return existing;
    }

    const desc = WASM_MODULES[id];
    options?.onProgress?.(5, `Checking CacheStorage for ${desc.label}...`);

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(WASM_CACHE_NAME);
        const cachedResp = await cache.match(desc.wasmUrl);
        if (cachedResp && cachedResp.ok) {
          options?.onProgress?.(65, `Hydrating ${desc.label} from browser CacheStorage...`);
          const buf = await cachedResp.arrayBuffer();
          this.loadedBuffers.set(id, buf);
          options?.onProgress?.(100, `${desc.label} loaded from cache`);
          return buf;
        }
      } catch {
        // Continue to network fetch
      }
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new WasmLoaderError(
        `${desc.label} is not cached and browser is offline.`,
        true,
      );
    }

    options?.onProgress?.(15, `Fetching ${desc.label} (${desc.estimatedSizeMB} MB) on demand...`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const onExternalAbort = () => controller.abort();
      options?.signal?.addEventListener('abort', onExternalAbort, { once: true });

      const resp = await fetch(desc.wasmUrl, { signal: controller.signal, mode: 'cors' });
      clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', onExternalAbort);

      if (!resp.ok) {
        throw new WasmLoaderError(
          `WASM CDN returned HTTP ${resp.status} for ${desc.label}`,
          true,
        );
      }

      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open(WASM_CACHE_NAME);
          await cache.put(desc.wasmUrl, resp.clone());
        } catch {
          // CacheStorage quota exceeded or unavailable; non-fatal
        }
      }

      const buf = await resp.arrayBuffer();
      this.loadedBuffers.set(id, buf);
      options?.onProgress?.(100, `${desc.label} cached & ready`);
      return buf;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError' && options?.signal?.aborted) {
        throw err;
      }
      if (err instanceof WasmLoaderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new WasmLoaderError(
        `Unable to load ${desc.label} (${msg}); escalating to Server Fallback.`,
        true,
      );
    }
  }

  async clearCache(): Promise<void> {
    this.loadedBuffers.clear();
    if (typeof caches !== 'undefined') {
      await caches.delete(WASM_CACHE_NAME);
    }
  }
}
