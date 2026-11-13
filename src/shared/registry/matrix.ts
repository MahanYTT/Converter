import type {
  ConversionEngineId,
  ConversionRouteRule,
  ExecutionTier,
  FormatCategory,
  FormatDefinition,
  ServerQueueLane,
} from '../types.ts';
import { FORMAT_CATALOG, getFormatById } from './formats.catalog.ts';

/**
 * Standard matrix of conversion route rules.
 */
export const CONVERSION_ROUTE_RULES: readonly ConversionRouteRule[] = [
  // --- IMAGE CONVERSIONS ---
  // Native Canvas-2D image conversions (PNG, JPG, WEBP, BMP, ICO, SVG)
  ...createImageNativeRules(),

  // WASM / Sharp-Magick image conversions (TIFF, PSD, HEIC, AVIF, RAW, TGA, JXL)
  ...createImageWasmRules(),

  // --- AUDIO CONVERSIONS ---
  ...createAudioRules(),

  // --- VIDEO CONVERSIONS ---
  ...createVideoRules(),

  // --- DATA & TABULAR CONVERSIONS ---
  ...createDataTabularRules(),

  // --- MARKUP & DOCUMENT CONVERSIONS ---
  ...createMarkupDocumentRules(),

  // --- OFFICE & HEAVY DOCUMENTS (LibreOffice / Pandoc Fallback) ---
  ...createOfficeDocumentRules(),

  // --- ARCHIVE CONVERSIONS ---
  ...createArchiveRules(),
];

function createImageNativeRules(): ConversionRouteRule[] {
  const nativeFormats = ['png', 'jpg', 'webp', 'bmp', 'ico', 'svg'];
  const rules: ConversionRouteRule[] = [];

  for (const src of nativeFormats) {
    for (const tgt of nativeFormats) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_NATIVE', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_NATIVE: 'canvas-2d',
          SERVER_FALLBACK: 'server-sharp-magick',
        },
        memoryMultiplier: 3.0,
        maxLocalFileSizeMB: 100,
        serverLane: 'fast',
        notes: 'Native OffscreenCanvas / HTMLCanvasElement conversion',
      });
    }
  }

  return rules;
}

function createImageWasmRules(): ConversionRouteRule[] {
  const wasmFormats = ['tiff', 'psd', 'heic', 'avif', 'raw', 'tga', 'jxl'];
  const allImageTargets = ['png', 'jpg', 'webp', 'avif', 'bmp', 'ico', 'tiff'];
  const rules: ConversionRouteRule[] = [];

  for (const src of wasmFormats) {
    for (const tgt of allImageTargets) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_WASM', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_WASM: 'wasm-imagemagick',
          SERVER_FALLBACK: 'server-sharp-magick',
        },
        memoryMultiplier: 5.0,
        maxLocalFileSizeMB: 40,
        requiresCrossOriginIsolation: true,
        serverLane: 'fast',
        notes: 'WASM Magick or managed server Sharp/ImageMagick',
      });
    }
  }

  return rules;
}

function createAudioRules(): ConversionRouteRule[] {
  const audioFormats = ['mp3', 'wav', 'ogg', 'opus', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'webm-audio'];
  const rules: ConversionRouteRule[] = [];

  for (const src of audioFormats) {
    for (const tgt of audioFormats) {
      if (src === tgt) continue;

      if (tgt === 'wav') {
        rules.push({
          sourceFormat: src,
          targetFormat: tgt,
          supportedTiers: ['LOCAL_NATIVE', 'LOCAL_WASM', 'SERVER_FALLBACK'],
          enginesByTier: {
            LOCAL_NATIVE: 'web-audio-pcm',
            LOCAL_WASM: 'wasm-ffmpeg',
            SERVER_FALLBACK: 'server-ffmpeg',
          },
          memoryMultiplier: 4.0,
          maxLocalFileSizeMB: 150,
          serverLane: 'media',
          notes: 'WebAudio native PCM decoding to WAV',
        });
      } else {
        rules.push({
          sourceFormat: src,
          targetFormat: tgt,
          supportedTiers: ['LOCAL_WASM', 'SERVER_FALLBACK'],
          enginesByTier: {
            LOCAL_WASM: 'wasm-ffmpeg',
            SERVER_FALLBACK: 'server-ffmpeg',
          },
          memoryMultiplier: 4.0,
          maxLocalFileSizeMB: 60,
          requiresCrossOriginIsolation: true,
          serverLane: 'media',
          notes: 'FFmpeg WASM or server FFmpeg media encoding',
        });
      }
    }
  }

  return rules;
}

function createVideoRules(): ConversionRouteRule[] {
  const videoFormats = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v', 'mpeg', 'ogv', 'gif'];
  const rules: ConversionRouteRule[] = [];

  for (const src of videoFormats) {
    for (const tgt of videoFormats) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_WASM', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_WASM: 'wasm-ffmpeg',
          SERVER_FALLBACK: 'server-ffmpeg',
        },
        memoryMultiplier: 4.5,
        maxLocalFileSizeMB: 50,
        requiresCrossOriginIsolation: true,
        serverLane: 'media',
        notes: 'FFmpeg transcode pipeline',
      });
    }
  }

  return rules;
}

function createDataTabularRules(): ConversionRouteRule[] {
  const dataFormats = ['json', 'csv', 'tsv', 'yaml', 'xml', 'toml', 'ini', 'env', 'sql', 'ndjson'];
  const rules: ConversionRouteRule[] = [];

  for (const src of dataFormats) {
    for (const tgt of [...dataFormats, 'md', 'html']) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_PURE_JS: 'pure-data-tabular',
          SERVER_FALLBACK: 'server-data-engine',
        },
        memoryMultiplier: 2.0,
        maxLocalFileSizeMB: 100,
        serverLane: 'fast',
        notes: 'Pure JS zero-dependency tabular data transformer',
      });
    }
  }

  return rules;
}

function createMarkupDocumentRules(): ConversionRouteRule[] {
  const markupFormats = ['md', 'html', 'txt', 'rtf', 'latex'];
  const rules: ConversionRouteRule[] = [];

  for (const src of markupFormats) {
    for (const tgt of markupFormats) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_PURE_JS: 'pure-markup-doc',
          SERVER_FALLBACK: 'server-pandoc',
        },
        memoryMultiplier: 2.0,
        maxLocalFileSizeMB: 50,
        serverLane: 'document',
        notes: 'Pure JS document transformer with Pandoc fallback',
      });
    }
  }

  return rules;
}

function createOfficeDocumentRules(): ConversionRouteRule[] {
  const officeSources = ['docx', 'doc', 'pptx', 'xlsx', 'ods', 'odp', 'odt', 'pdf', 'epub', 'mobi'];
  const officeTargets = ['pdf', 'html', 'md', 'txt', 'docx'];
  const rules: ConversionRouteRule[] = [];

  for (const src of officeSources) {
    for (const tgt of officeTargets) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['SERVER_FALLBACK'],
        enginesByTier: {
          SERVER_FALLBACK: 'server-libreoffice',
        },
        memoryMultiplier: 6.0,
        maxLocalFileSizeMB: 0, // Force server execution for binary office docs
        serverLane: 'document',
        notes: 'LibreOffice headless conversion server fallback',
      });
    }
  }

  return rules;
}

function createArchiveRules(): ConversionRouteRule[] {
  const zipPureFormats = ['zip', 'tar', 'gz', 'tgz'];
  const externalArchives = ['7z', 'rar', 'bz2', 'xz', 'zst'];
  const rules: ConversionRouteRule[] = [];

  for (const src of [...zipPureFormats, ...externalArchives]) {
    for (const tgt of ['zip', 'tar', 'tgz', '7z']) {
      if (src === tgt) continue;
      const isPureLocal = zipPureFormats.includes(src) && zipPureFormats.includes(tgt);

      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: isPureLocal
          ? ['LOCAL_PURE_JS', 'SERVER_FALLBACK']
          : ['LOCAL_WASM', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_PURE_JS: isPureLocal ? 'pure-archive-zip' : undefined,
          LOCAL_WASM: 'pure-archive-zip',
          SERVER_FALLBACK: 'server-archive-7z',
        },
        memoryMultiplier: 3.0,
        maxLocalFileSizeMB: isPureLocal ? 150 : 50,
        serverLane: 'fast',
        notes: 'Archive extraction and repackaging',
      });
    }
  }

  return rules;
}

/**
 * Find exact route rule or derive a matching rule for (sourceFormat, targetFormat).
 */
export function getRouteRule(sourceFormat: string, targetFormat: string): ConversionRouteRule | undefined {
  const s = sourceFormat.trim().toLowerCase();
  const t = targetFormat.trim().toLowerCase();

  const exact = CONVERSION_ROUTE_RULES.find(
    (r) => r.sourceFormat === s && r.targetFormat === t
  );
  if (exact) return exact;

  // Generic category fallback rule if formats exist in catalog
  const srcDef = getFormatById(s);
  const tgtDef = getFormatById(t);

  if (!srcDef || !tgtDef) return undefined;

  // Category based rule generation
  if (srcDef.category === 'data' && (tgtDef.category === 'data' || tgtDef.category === 'document')) {
    return {
      sourceFormat: s,
      targetFormat: t,
      supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
      enginesByTier: {
        LOCAL_PURE_JS: 'pure-data-tabular',
        SERVER_FALLBACK: 'server-data-engine',
      },
      memoryMultiplier: 2.0,
      maxLocalFileSizeMB: 50,
      serverLane: 'fast',
    };
  }

  if (srcDef.category === 'image' && tgtDef.category === 'image') {
    return {
      sourceFormat: s,
      targetFormat: t,
      supportedTiers: ['LOCAL_NATIVE', 'SERVER_FALLBACK'],
      enginesByTier: {
        LOCAL_NATIVE: 'canvas-2d',
        SERVER_FALLBACK: 'server-sharp-magick',
      },
      memoryMultiplier: 4.0,
      maxLocalFileSizeMB: 50,
      serverLane: 'fast',
    };
  }

  return undefined;
}

/**
 * Get all supported target formats for a given source format ID.
 */
export function getSupportedTargetsForSource(sourceFormat: string): FormatDefinition[] {
  const s = sourceFormat.trim().toLowerCase();
  const srcDef = getFormatById(s);
  if (!srcDef) return [];

  const targetIds = new Set<string>();

  for (const rule of CONVERSION_ROUTE_RULES) {
    if (rule.sourceFormat === s) {
      targetIds.add(rule.targetFormat);
    }
  }

  // If category is data, allow all other data formats
  if (srcDef.category === 'data') {
    for (const fmt of FORMAT_CATALOG) {
      if (fmt.category === 'data' && fmt.id !== s) {
        targetIds.add(fmt.id);
      }
    }
    targetIds.add('md');
    targetIds.add('html');
  }

  const results: FormatDefinition[] = [];
  for (const tid of targetIds) {
    const tgtFmt = getFormatById(tid);
    if (tgtFmt) results.push(tgtFmt);
  }

  return results;
}
