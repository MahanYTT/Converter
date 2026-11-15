import type {
  ConversionEngineId,
  ConversionOptions,
  ConversionRouteRule,
  DeviceCapabilityProfile,
  ExecutionTier,
  RoutingDecision,
  ServerQueueLane,
} from '../../shared/types.ts';
import {
  findConversionRule,
  getFormatById,
  inspectFileMagicBytes,
} from './format-catalog.ts';

const TIER_PRIORITY: readonly ExecutionTier[] = [
  'LOCAL_NATIVE',
  'LOCAL_PURE_JS',
  'LOCAL_WASM',
  'SERVER_FALLBACK',
] as const;

const DEFAULT_SERVER_ENGINE_BY_LANE: Record<ServerQueueLane, ConversionEngineId> = {
  fast: 'server-sharp-magick',
  document: 'server-libreoffice',
  media: 'server-ffmpeg',
};

const TARGET_MIME_BY_FORMAT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

export interface FileRoutingMeta {
  name: string;
  sizeBytes: number;
  headerBytes?: Uint8Array;
}

export class ConversionRouter {
  static normalizeFormatId(format: string): string {
    const clean = format.trim().toLowerCase().replace(/^\./, '');
    const def = getFormatById(clean);
    return def ? def.id : clean;
  }

  static synthesizeFallbackRule(sourceFormat: string, targetFormat: string): ConversionRouteRule {
    const srcDef = getFormatById(sourceFormat);
    const tgtDef = getFormatById(targetFormat);
    const category = srcDef?.category ?? tgtDef?.category ?? 'document';

    let serverLane: ServerQueueLane = 'fast';
    let serverEngine: ConversionEngineId = 'server-sharp-magick';

    if (category === 'video' || category === 'audio') {
      serverLane = 'media';
      serverEngine = 'server-ffmpeg';
    } else if (category === 'document' || category === 'ebook') {
      serverLane = 'document';
      serverEngine = 'server-libreoffice';
    } else if (category === 'archive') {
      serverLane = 'fast';
      serverEngine = 'server-archive-7z';
    } else if (category === 'data') {
      serverLane = 'fast';
      serverEngine = 'server-data-engine';
    }

    return {
      sourceFormat,
      targetFormat,
      supportedTiers: ['SERVER_FALLBACK'],
      enginesByTier: { SERVER_FALLBACK: serverEngine },
      memoryMultiplier: 3.0,
      maxLocalFileSizeMB: 0,
      serverLane,
      notes: `Preparing high-precision conversion...`,
    };
  }

  private static isTierCapableOnDevice(
    tier: ExecutionTier,
    engine: ConversionEngineId,
    targetFormat: string,
    sizeMB: number,
    estimatedPeakMemoryMB: number,
    rule: ConversionRouteRule,
    device: DeviceCapabilityProfile,
    forceLocal: boolean,
  ): { ok: boolean; skipReason?: string; warning?: string } {
    if (tier === 'SERVER_FALLBACK') {
      return { ok: true };
    }

    // Check API support for LOCAL_NATIVE
    if (tier === 'LOCAL_NATIVE') {
      if (engine === 'canvas-2d') {
        // OffscreenCanvas or DOM canvas must be available; in Node tests OffscreenCanvas may be mocked/false
        if (!device.supportsOffscreenCanvas && typeof document === 'undefined') {
          return { ok: false, skipReason: 'Browser OffscreenCanvas API is unavailable on this device' };
        }
        const targetMime = TARGET_MIME_BY_FORMAT[targetFormat];
        if (targetMime && !device.supportedCanvasEncodeMimes.includes(targetMime)) {
          return {
            ok: false,
            skipReason: `Browser canvas encoder does not support native ${targetFormat.toUpperCase()} encoding`,
          };
        }
      } else if (engine === 'web-audio-pcm') {
        if (!device.supportsWebAudio) {
          return { ok: false, skipReason: 'WebAudio API is unavailable in this environment' };
        }
      } else if (engine === 'compression-stream') {
        if (!device.supportsCompressionStream) {
          return { ok: false, skipReason: 'Browser CompressionStream API is unavailable' };
        }
      } else if (engine === 'web-codecs') {
        if (!device.supportsWebCodecs) {
          return { ok: false, skipReason: 'WebCodecs API is unavailable in this browser' };
        }
      }
    }

    // Check Cross-Origin Isolation (SharedArrayBuffer) for heavy WASM video/media (> 60 MB)
    if (
      tier === 'LOCAL_WASM' &&
      rule.requiresCrossOriginIsolation &&
      !device.crossOriginIsolated &&
      sizeMB > 60
    ) {
      if (forceLocal) {
        return {
          ok: true,
          warning: `SharedArrayBuffer (Cross-Origin Isolation) is disabled; single-threaded WASM processing of ${sizeMB.toFixed(1)} MB may be slow.`,
        };
      }
      return {
        ok: false,
        skipReason: `File (${sizeMB.toFixed(1)} MB) requires multi-threaded WASM (SharedArrayBuffer / COOP+COEP), which is unavailable in this context`,
      };
    }

    // Check max local file size limit
    if (rule.maxLocalFileSizeMB > 0 && sizeMB > rule.maxLocalFileSizeMB) {
      if (forceLocal) {
        return {
          ok: true,
          warning: `File (${sizeMB.toFixed(1)} MB) exceeds recommended local limit (${rule.maxLocalFileSizeMB} MB).`,
        };
      }
      return {
        ok: false,
        skipReason: `File size (${sizeMB.toFixed(1)} MB) exceeds local engine ceiling (${rule.maxLocalFileSizeMB} MB)`,
      };
    }

    // Check device RAM budget
    if (estimatedPeakMemoryMB > device.safeBrowserMemoryCapMB) {
      if (forceLocal) {
        return {
          ok: true,
          warning: `Estimated peak RAM (${estimatedPeakMemoryMB.toFixed(0)} MB) exceeds safe browser budget (${device.safeBrowserMemoryCapMB} MB).`,
        };
      }
      return {
        ok: false,
        skipReason: `Estimated peak memory (${estimatedPeakMemoryMB.toFixed(0)} MB) exceeds device safe browser RAM budget (${device.safeBrowserMemoryCapMB} MB)`,
      };
    }

    return { ok: true };
  }

  route(
    fileMeta: FileRoutingMeta,
    sourceFormat: string,
    targetFormat: string,
    options: ConversionOptions,
    device: DeviceCapabilityProfile,
  ): RoutingDecision {
    const warnings: string[] = [];
    let resolvedSource = ConversionRouter.normalizeFormatId(sourceFormat);
    const resolvedTarget = ConversionRouter.normalizeFormatId(targetFormat);

    // Inspect magic bytes when available to catch spoofed/mismatched extensions
    if (fileMeta.headerBytes && fileMeta.headerBytes.length > 0) {
      const inspection = inspectFileMagicBytes(fileMeta.headerBytes, fileMeta.name);
      if (inspection.isSpoofedOrMismatched && inspection.detectedFormatId) {
        warnings.push(
          inspection.warningMessage ??
            `Extension mismatch detected: using verified ${inspection.detectedFormatId.toUpperCase()} signature.`,
        );
        if (inspection.confidence === 'high') {
          resolvedSource = inspection.detectedFormatId;
        }
      }
    }

    const rule =
      findConversionRule(resolvedSource, resolvedTarget) ??
      ConversionRouter.synthesizeFallbackRule(resolvedSource, resolvedTarget);

    const sizeMB = Math.max(0, fileMeta.sizeBytes) / (1024 * 1024);
    const estimatedPeakMemoryMB = Number((sizeMB * rule.memoryMultiplier).toFixed(2));
    const mode = options.forceExecutionMode ?? 'AUTO';

    const serverEngine =
      rule.enginesByTier.SERVER_FALLBACK ?? DEFAULT_SERVER_ENGINE_BY_LANE[rule.serverLane];

    // 1. User explicitly forces SERVER_ONLY
    if (mode === 'SERVER_ONLY') {
      return {
        sourceFormat: resolvedSource,
        targetFormat: resolvedTarget,
        selectedTier: 'SERVER_FALLBACK',
        selectedEngine: serverEngine,
        isLocal: false,
        requiresUpload: true,
        fallbackTier: null,
        fallbackEngine: null,
        estimatedPeakMemoryMB,
        serverLane: rule.serverLane,
        reason: `High-precision conversion explicitly selected.`,
        warnings,
      };
    }

    const forceLocal = mode === 'LOCAL_ONLY';
    const orderedTiers = TIER_PRIORITY.filter((t) => rule.supportedTiers.includes(t));
    const skipReasons: string[] = [];

    for (const tier of orderedTiers) {
      if (forceLocal && tier === 'SERVER_FALLBACK') {
        continue;
      }

      const engine = rule.enginesByTier[tier] ?? (tier === 'SERVER_FALLBACK' ? serverEngine : undefined);
      if (!engine) continue;

      const check = ConversionRouter.isTierCapableOnDevice(
        tier,
        engine,
        resolvedTarget,
        sizeMB,
        estimatedPeakMemoryMB,
        rule,
        device,
        forceLocal,
      );

      if (!check.ok) {
        if (check.skipReason) skipReasons.push(check.skipReason);
        continue;
      }

      if (check.warning) {
        warnings.push(check.warning);
      }

      const isLocal = tier !== 'SERVER_FALLBACK';
      const hasServerFallback = !forceLocal && rule.supportedTiers.includes('SERVER_FALLBACK');

      let reason: string;
      if (tier === 'LOCAL_NATIVE') {
        reason = `Processing securely on your device (hardware accelerated) — 0 KB uploaded.`;
      } else if (tier === 'LOCAL_PURE_JS') {
        reason = `Processing securely on your device — 0 KB uploaded.`;
      } else if (tier === 'LOCAL_WASM') {
        reason = `Processing securely on your device (advanced engine) — 0 KB uploaded.`;
      } else {
        reason =
          skipReasons.length > 0
            ? `Preparing high-precision conversion...`
            : rule.notes ?? `Preparing high-precision conversion...`;
      }

      if (!isLocal && skipReasons.length > 0) {
        warnings.push(...skipReasons);
      }

      return {
        sourceFormat: resolvedSource,
        targetFormat: resolvedTarget,
        selectedTier: tier,
        selectedEngine: engine,
        isLocal,
        requiresUpload: !isLocal,
        fallbackTier: isLocal && hasServerFallback ? 'SERVER_FALLBACK' : null,
        fallbackEngine: isLocal && hasServerFallback ? serverEngine : null,
        estimatedPeakMemoryMB,
        serverLane: rule.serverLane,
        reason,
        warnings,
      };
    }

    // If LOCAL_ONLY was forced on a server-only format pair (e.g. docx -> pdf)
    if (forceLocal) {
      throw new Error(
        `Local-only execution requested, but ${resolvedSource.toUpperCase()} -> ${resolvedTarget.toUpperCase()} has no compatible local browser engine.`,
      );
    }

    return {
      sourceFormat: resolvedSource,
      targetFormat: resolvedTarget,
      selectedTier: 'SERVER_FALLBACK',
      selectedEngine: serverEngine,
      isLocal: false,
      requiresUpload: true,
      fallbackTier: null,
      fallbackEngine: null,
      estimatedPeakMemoryMB,
      serverLane: rule.serverLane,
      reason:
        skipReasons.length > 0
          ? `Preparing high-precision conversion...`
          : `Preparing high-precision conversion...`,
      warnings: [...warnings, ...skipReasons],
    };
  }

  escalateFailedLocalJobToServer(previousDecision: RoutingDecision, error: Error): RoutingDecision {
    const serverEngine =
      previousDecision.fallbackEngine ??
      DEFAULT_SERVER_ENGINE_BY_LANE[previousDecision.serverLane] ??
      'server-sharp-magick';

    const detail = error.message || 'Unknown local worker error';
    return {
      ...previousDecision,
      selectedTier: 'SERVER_FALLBACK',
      selectedEngine: serverEngine,
      isLocal: false,
      requiresUpload: true,
      fallbackTier: null,
      fallbackEngine: null,
      reason: `Transparently routing to high-precision engine after local issue...`,
      warnings: [
        ...previousDecision.warnings,
        `Local processing encountered an issue (${detail}); transparently recovered via high-precision engine.`,
      ],
    };
  }
}
