import type { DeviceCapabilityProfile } from '../../shared/types.ts';

const CANDIDATE_CANVAS_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
] as const;

export interface DeviceProfileOverrides {
  hardwareConcurrency?: number;
  deviceMemoryGB?: number;
  crossOriginIsolated?: boolean;
  supportsOffscreenCanvas?: boolean;
  supportsWebCodecs?: boolean;
  supportsWebAudio?: boolean;
  supportsCompressionStream?: boolean;
  supportsOPFS?: boolean;
  availableStorageQuotaMB?: number;
  supportedCanvasEncodeMimes?: readonly string[];
}

export class DeviceProfiler {
  static computeSafeMemoryCapMB(deviceMemoryGB: number): number {
    const safeGB = Number.isFinite(deviceMemoryGB) && deviceMemoryGB > 0 ? deviceMemoryGB : 8;
    return Math.round(Math.min(1536, Math.max(256, safeGB * 220)));
  }

  static async probeCanvasEncodeMimes(): Promise<string[]> {
    const g = globalThis as Record<string, unknown>;

    // Prefer OffscreenCanvas.convertToBlob when available
    if (typeof g.OffscreenCanvas === 'function') {
      const supported: string[] = [];
      try {
        const canvas = new (g.OffscreenCanvas as new (w: number, h: number) => {
          getContext: (type: string) => { fillRect: (x: number, y: number, w: number, h: number) => void } | null;
          convertToBlob: (opts?: { type?: string; quality?: number }) => Promise<Blob>;
        })(2, 2);
        const ctx = canvas.getContext('2d');
        ctx?.fillRect(0, 0, 2, 2);
        for (const mime of CANDIDATE_CANVAS_MIMES) {
          try {
            const blob = await canvas.convertToBlob({ type: mime, quality: 0.8 });
            if (blob && blob.type === mime) {
              supported.push(mime);
            }
          } catch {
            // MIME not supported for encoding
          }
        }
        if (supported.length > 0) return supported;
      } catch {
        // Fall through to HTMLCanvasElement probe
      }
    }

    // Fallback to DOM HTMLCanvasElement.toDataURL check
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const supported: string[] = [];
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        for (const mime of CANDIDATE_CANVAS_MIMES) {
          try {
            const dataUrl = canvas.toDataURL(mime);
            if (dataUrl.startsWith(`data:${mime}`)) {
              supported.push(mime);
            }
          } catch {
            // Ignore unsupported MIME
          }
        }
        if (supported.length > 0) return supported;
      } catch {
        // Ignore DOM errors
      }
    }

    // Non-DOM / Node fallback defaults
    return ['image/png', 'image/jpeg', 'image/webp'];
  }

  static detectSync(overrides?: DeviceProfileOverrides): DeviceCapabilityProfile {
    const g = globalThis as Record<string, unknown>;
    const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Record<string, unknown>;

    const rawCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0
      ? nav.hardwareConcurrency
      : 4;
    const rawMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0
      ? nav.deviceMemory
      : 8;

    const hardwareConcurrency = overrides?.hardwareConcurrency ?? rawCores;
    const deviceMemoryGB = overrides?.deviceMemoryGB ?? rawMemory;

    const crossOriginIsolated =
      overrides?.crossOriginIsolated ??
      Boolean(g.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined');

    const supportsOffscreenCanvas =
      overrides?.supportsOffscreenCanvas ?? typeof g.OffscreenCanvas === 'function';

    const supportsWebCodecs =
      overrides?.supportsWebCodecs ??
      (typeof g.VideoEncoder === 'function' && typeof g.VideoDecoder === 'function');

    const supportsWebAudio =
      overrides?.supportsWebAudio ??
      (typeof g.AudioContext === 'function' ||
        typeof g.webkitAudioContext === 'function' ||
        typeof g.OfflineAudioContext === 'function');

    const supportsCompressionStream =
      overrides?.supportsCompressionStream ??
      (typeof g.CompressionStream === 'function' && typeof g.DecompressionStream === 'function');

    const storage = nav.storage as Record<string, unknown> | undefined;
    const supportsOPFS =
      overrides?.supportsOPFS ?? Boolean(storage && typeof storage.getDirectory === 'function');

    const availableStorageQuotaMB = overrides?.availableStorageQuotaMB ?? 2048;
    const safeBrowserMemoryCapMB = DeviceProfiler.computeSafeMemoryCapMB(deviceMemoryGB);
    const supportedCanvasEncodeMimes = overrides?.supportedCanvasEncodeMimes ?? [
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    return {
      hardwareConcurrency,
      deviceMemoryGB,
      crossOriginIsolated,
      supportsOffscreenCanvas,
      supportsWebCodecs,
      supportsWebAudio,
      supportsCompressionStream,
      supportsOPFS,
      availableStorageQuotaMB,
      safeBrowserMemoryCapMB,
      supportedCanvasEncodeMimes,
    };
  }

  static async detect(overrides?: DeviceProfileOverrides): Promise<DeviceCapabilityProfile> {
    const base = DeviceProfiler.detectSync(overrides);
    const nav = (typeof navigator !== 'undefined' ? navigator : {}) as {
      storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> };
    };

    let availableStorageQuotaMB = overrides?.availableStorageQuotaMB ?? base.availableStorageQuotaMB;
    if (overrides?.availableStorageQuotaMB === undefined && nav.storage?.estimate) {
      try {
        const estimate = await nav.storage.estimate();
        if (typeof estimate.quota === 'number') {
          const remainingBytes = Math.max(0, estimate.quota - (estimate.usage ?? 0));
          availableStorageQuotaMB = Math.round(remainingBytes / (1024 * 1024));
        }
      } catch {
        // Keep safe default
      }
    }

    const supportedCanvasEncodeMimes =
      overrides?.supportedCanvasEncodeMimes ?? (await DeviceProfiler.probeCanvasEncodeMimes());

    return {
      ...base,
      availableStorageQuotaMB,
      supportedCanvasEncodeMimes,
    };
  }
}
