import type {
  ConversionOptions,
  DataTransformResult,
} from '../../shared/types.ts';
import { getFormatById } from '../router/format-catalog.ts';
import { LazyWasmLoader, WasmLoaderError } from './wasm-loader.ts';

export interface LocalConversionOutput {
  blob: Blob;
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  filename: string;
  warnings: string[];
  metadata?: Record<string, string | number>;
}

export type LocalProgressFn = (percent: number, stageMessage: string) => void;

function replaceExtension(filename: string, newExt: string): string {
  const base = filename.replace(/\.[^/.]+$/, '');
  return `${base || 'converted'}.${newExt}`;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Conversion aborted by user', 'AbortError');
  }
}

// ============================================================================
// TIER 1: NATIVE IMAGE CONVERTER (Canvas / OffscreenCanvas + BMP / ICO)
// ============================================================================

export function encodeImageDataToBmp(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const rowStride = width * 4;
  const pixelDataSize = rowStride * height;
  const headerSize = 14 + 40;
  const fileSize = headerSize + pixelDataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, headerSize, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 32, true); // 32-bit BGRA
  view.setUint32(30, 0, true); // BI_RGB
  view.setUint32(34, pixelDataSize, true);
  view.setInt32(38, 2835, true); // 72 DPI
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const si = (srcRow * width + x) * 4;
      const di = headerSize + y * rowStride + x * 4;
      out[di] = rgba[si + 2];     // B
      out[di + 1] = rgba[si + 1]; // G
      out[di + 2] = rgba[si];     // R
      out[di + 3] = rgba[si + 3]; // A
    }
  }
  return out;
}

export function encodePngToIco(
  pngBytes: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const headerSize = 6 + 16;
  const totalSize = headerSize + pngBytes.length;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  // ICONDIR (6 bytes)
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = 1 (ICO)
  view.setUint16(4, 1, true); // image count = 1

  // ICONDIRENTRY (16 bytes)
  view.setUint8(6, width >= 256 ? 0 : width);
  view.setUint8(7, height >= 256 ? 0 : height);
  view.setUint8(8, 0); // palette colors
  view.setUint8(9, 0); // reserved
  view.setUint16(10, 1, true); // color planes
  view.setUint16(12, 32, true); // bpp
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, headerSize, true);

  out.set(pngBytes, headerSize);
  return out;
}

function computeTargetDimensions(
  srcW: number,
  srcH: number,
  options: ConversionOptions,
): { targetW: number; targetH: number; drawX: number; drawY: number; drawW: number; drawH: number } {
  let targetW = options.width && options.width > 0 ? Math.round(options.width) : srcW;
  let targetH = options.height && options.height > 0 ? Math.round(options.height) : srcH;

  if (options.width && !options.height) {
    targetH = Math.max(1, Math.round((srcH * targetW) / srcW));
  } else if (!options.width && options.height) {
    targetW = Math.max(1, Math.round((srcW * targetH) / srcH));
  }

  const fit = options.fit ?? 'contain';
  if (fit === 'fill' || (!options.width && !options.height)) {
    return { targetW, targetH, drawX: 0, drawY: 0, drawW: targetW, drawH: targetH };
  }

  const scaleX = targetW / srcW;
  const scaleY = targetH / srcH;

  if (fit === 'inside') {
    const scale = Math.min(1, scaleX, scaleY);
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    return { targetW: w, targetH: h, drawX: 0, drawY: 0, drawW: w, drawH: h };
  }

  if (fit === 'cover') {
    const scale = Math.max(scaleX, scaleY);
    const drawW = Math.round(srcW * scale);
    const drawH = Math.round(srcH * scale);
    return {
      targetW,
      targetH,
      drawX: Math.round((targetW - drawW) / 2),
      drawY: Math.round((targetH - drawH) / 2),
      drawW,
      drawH,
    };
  }

  // contain
  const scale = Math.min(scaleX, scaleY);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  return {
    targetW,
    targetH,
    drawX: Math.round((targetW - drawW) / 2),
    drawY: Math.round((targetH - drawH) / 2),
    drawW,
    drawH,
  };
}

async function decodeImageDrawable(
  blob: Blob,
  sourceFormat: string,
): Promise<{
  drawable: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (sourceFormat !== 'svg' && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  if (typeof Image !== 'undefined') {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(`Failed to decode ${sourceFormat.toUpperCase()} image`));
        el.src = url;
      });
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 600;
      return {
        drawable: img,
        width,
        height,
        cleanup: () => URL.revokeObjectURL(url),
      };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }

  throw new Error('No browser image decoder (createImageBitmap / Image) is available');
}

async function canvasToBlobCompat(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error(`Canvas failed to encode ${mimeType}`))),
      mimeType,
      quality,
    );
  });
}

export async function convertImageLocal(
  file: Blob,
  filename: string,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions,
  onProgress?: LocalProgressFn,
  signal?: AbortSignal,
): Promise<LocalConversionOutput> {
  assertNotAborted(signal);
  const warnings: string[] = [];
  onProgress?.(15, `Decoding ${sourceFormat.toUpperCase()} bitmap...`);

  const decoded = await decodeImageDrawable(file, sourceFormat);
  try {
    assertNotAborted(signal);
    const dims = computeTargetDimensions(decoded.width, decoded.height, options);

    // Clamp ICO dimensions to max 256x256
    if (targetFormat === 'ico' && (dims.targetW > 256 || dims.targetH > 256)) {
      const scale = Math.min(256 / dims.targetW, 256 / dims.targetH);
      dims.targetW = Math.max(1, Math.round(dims.targetW * scale));
      dims.targetH = Math.max(1, Math.round(dims.targetH * scale));
      dims.drawW = dims.targetW;
      dims.drawH = dims.targetH;
      dims.drawX = 0;
      dims.drawY = 0;
      warnings.push(`ICO dimensions clamped to ${dims.targetW}x${dims.targetH}px.`);
    }

    onProgress?.(45, `Rendering ${dims.targetW}x${dims.targetH}px frame on Canvas...`);

    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(dims.targetW, dims.targetH)
        : (() => {
            const c = document.createElement('canvas');
            c.width = dims.targetW;
            c.height = dims.targetH;
            return c;
          })();

    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) {
      throw new Error('Failed to acquire 2D canvas rendering context');
    }

    // Fill solid white background for opaque targets (JPEG / BMP) so transparent alpha doesn't turn black
    if (targetFormat === 'jpg' || targetFormat === 'bmp') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dims.targetW, dims.targetH);
    }

    ctx.drawImage(decoded.drawable, dims.drawX, dims.drawY, dims.drawW, dims.drawH);
    assertNotAborted(signal);

    onProgress?.(75, `Encoding ${targetFormat.toUpperCase()} (EXIF metadata stripped)...`);

    if (targetFormat === 'bmp') {
      const imageData = ctx.getImageData(0, 0, dims.targetW, dims.targetH);
      const bmpBytes = encodeImageDataToBmp(imageData.data, dims.targetW, dims.targetH);
      const blob = new Blob([bmpBytes.buffer as ArrayBuffer], { type: 'image/bmp' });
      onProgress?.(100, 'BMP conversion complete');
      return {
        blob,
        bytes: bmpBytes,
        mimeType: 'image/bmp',
        extension: 'bmp',
        filename: replaceExtension(filename, 'bmp'),
        warnings,
        metadata: { width: dims.targetW, height: dims.targetH, exifStripped: 1 },
      };
    }

    if (targetFormat === 'ico') {
      const pngBlob = await canvasToBlobCompat(canvas, 'image/png');
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      const icoBytes = encodePngToIco(pngBytes, dims.targetW, dims.targetH);
      const blob = new Blob([icoBytes.buffer as ArrayBuffer], { type: 'image/x-icon' });
      onProgress?.(100, 'ICO icon created');
      return {
        blob,
        bytes: icoBytes,
        mimeType: 'image/x-icon',
        extension: 'ico',
        filename: replaceExtension(filename, 'ico'),
        warnings,
        metadata: { width: dims.targetW, height: dims.targetH },
      };
    }

    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      webp: 'image/webp',
      avif: 'image/avif',
    };
    const targetMime = mimeMap[targetFormat] ?? 'image/png';
    const quality = Math.min(1, Math.max(0.05, (options.quality ?? 88) / 100));
    const encodedBlob = await canvasToBlobCompat(canvas, targetMime, quality);

    if (encodedBlob.type !== targetMime && targetFormat === 'avif') {
      throw new Error('Browser canvas encoder fell back from AVIF; escalating');
    }

    const bytes = new Uint8Array(await encodedBlob.arrayBuffer());
    onProgress?.(100, `${targetFormat.toUpperCase()} conversion complete`);

    return {
      blob: encodedBlob,
      bytes,
      mimeType: targetMime,
      extension: targetFormat,
      filename: replaceExtension(filename, targetFormat),
      warnings,
      metadata: { width: dims.targetW, height: dims.targetH, exifStripped: 1 },
    };
  } finally {
    decoded.cleanup();
  }
}

// ============================================================================
// TIER 1: NATIVE AUDIO CONVERTER (WebAudio + Resample/Trim/Normalize + WAV)
// ============================================================================

export interface WavEncodeOptions {
  bitDepth?: 16 | 24;
}

export function encodeChannelsToWav(
  channels: readonly Float32Array[],
  sampleRate: number,
  options?: WavEncodeOptions,
): Uint8Array {
  const numChannels = Math.max(1, channels.length);
  const numSamples = channels[0]?.length ?? 0;
  const bitDepth = options?.bitDepth === 24 ? 24 : 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const totalSize = 44 + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true);  // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] ?? 0));
      if (bitDepth === 16) {
        const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
        view.setInt16(offset, int16, true);
        offset += 2;
      } else {
        const int24 = sample < 0 ? Math.round(sample * 0x800000) : Math.round(sample * 0x7fffff);
        view.setUint8(offset, int24 & 0xff);
        view.setUint8(offset + 1, (int24 >> 8) & 0xff);
        view.setUint8(offset + 2, (int24 >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Uint8Array(buffer);
}

export function encodeAudioBufferToWav(
  audioBuffer: AudioBuffer,
  options?: WavEncodeOptions,
): Uint8Array {
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }
  return encodeChannelsToWav(channels, audioBuffer.sampleRate, options);
}

export function normalizeChannelData(
  channels: Float32Array[],
  targetDb = -1,
): Float32Array[] {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > peak) peak = abs;
    }
  }
  if (peak <= 0.00001) return channels;
  const targetLinear = Math.pow(10, targetDb / 20);
  const gain = targetLinear / peak;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      out[i] = Math.max(-1, Math.min(1, ch[i] * gain));
    }
    return out;
  });
}

export async function convertAudioLocal(
  file: Blob,
  filename: string,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions,
  onProgress?: LocalProgressFn,
  signal?: AbortSignal,
): Promise<LocalConversionOutput> {
  assertNotAborted(signal);
  if (targetFormat !== 'wav') {
    throw new Error(`Native WebAudio encoder only outputs WAV; ${targetFormat.toUpperCase()} requires FFmpeg WASM or Server.`);
  }

  const AudioCtx =
    (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    throw new Error('WebAudio AudioContext is unavailable in this browser');
  }

  onProgress?.(15, `Decoding ${sourceFormat.toUpperCase()} audio stream...`);
  const inputBuffer = await file.arrayBuffer();
  assertNotAborted(signal);

  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(inputBuffer.slice(0));
  } finally {
    await decodeCtx.close().catch(() => {});
  }

  assertNotAborted(signal);
  onProgress?.(45, 'Processing resampling, trimming, and channel mix...');

  const startSec = Math.max(0, options.trimStartSec ?? 0);
  const endSec =
    options.trimEndSec && options.trimEndSec > startSec
      ? Math.min(decoded.duration, options.trimEndSec)
      : decoded.duration;
  const durationSec = Math.max(0.01, endSec - startSec);

  const targetRate = options.sampleRate ?? decoded.sampleRate;
  const targetChannels = options.channels ?? Math.min(2, Math.max(1, decoded.numberOfChannels));
  const frameCount = Math.max(1, Math.round(durationSec * targetRate));

  const OfflineCtx = globalThis.OfflineAudioContext;
  let renderedChannels: Float32Array[];

  if (OfflineCtx) {
    const offline = new OfflineCtx(targetChannels, frameCount, targetRate);
    const srcNode = offline.createBufferSource();
    srcNode.buffer = decoded;
    srcNode.connect(offline.destination);
    srcNode.start(0, startSec, durationSec);
    const rendered = await offline.startRendering();
    renderedChannels = [];
    for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
      renderedChannels.push(rendered.getChannelData(ch));
    }
  } else {
    // Pure JS fallback slice if OfflineAudioContext is absent
    const startSample = Math.floor(startSec * decoded.sampleRate);
    const endSample = Math.min(decoded.length, Math.floor(endSec * decoded.sampleRate));
    renderedChannels = [];
    for (let ch = 0; ch < targetChannels; ch++) {
      const srcCh = decoded.getChannelData(Math.min(ch, decoded.numberOfChannels - 1));
      renderedChannels.push(srcCh.slice(startSample, endSample));
    }
  }

  assertNotAborted(signal);
  if (options.normalizeAudio) {
    onProgress?.(70, 'Normalizing audio peak to -1 dB...');
    renderedChannels = normalizeChannelData(renderedChannels, -1);
  }

  onProgress?.(85, 'Encoding PCM WAV container...');
  const wavBytes = encodeChannelsToWav(renderedChannels, targetRate, { bitDepth: 16 });
  const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
  onProgress?.(100, 'WAV audio conversion complete');

  return {
    blob,
    bytes: wavBytes,
    mimeType: 'audio/wav',
    extension: 'wav',
    filename: replaceExtension(filename, 'wav'),
    warnings: [],
    metadata: {
      sampleRate: targetRate,
      channels: targetChannels,
      durationSec: Number(durationSec.toFixed(2)),
    },
  };
}

// ============================================================================
// TIER 2: PURE DATA, MARKUP, CLIENT PDF & ARCHIVE CONVERTER
// ============================================================================

function parseDelimitedText(text: string, delimiter: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  return nonEmpty.slice(1).map((vals) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? '';
    });
    return obj;
  });
}

function serializeDelimitedText(rows: Record<string, unknown>[], delimiter: string): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce((set, r) => {
      for (const k of Object.keys(r)) set.add(k);
      return set;
    }, new Set<string>()),
  );
  const escapeCell = (val: unknown) => {
    const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(delimiter),
    ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(delimiter)),
  ];
  return lines.join('\n');
}

function parseSimpleYaml(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  const isArray = lines.some((l) => l.trim().startsWith('- '));
  if (isArray) {
    const items: unknown[] = [];
    let currentObj: Record<string, unknown> | null = null;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('- ')) {
        const rest = t.slice(2).trim();
        const colon = rest.indexOf(':');
        if (colon !== -1) {
          currentObj = {};
          currentObj[rest.slice(0, colon).trim()] = parseScalar(rest.slice(colon + 1).trim());
          items.push(currentObj);
        } else {
          currentObj = null;
          items.push(parseScalar(rest));
        }
      } else if (currentObj && line.startsWith('  ')) {
        const colon = t.indexOf(':');
        if (colon !== -1) {
          currentObj[t.slice(0, colon).trim()] = parseScalar(t.slice(colon + 1).trim());
        }
      }
    }
    return items;
  }

  const root: Record<string, unknown> = {};
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon !== -1) {
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim();
      root[key] = parseScalar(val);
    }
  }
  return root;
}

function parseScalar(raw: string): unknown {
  if (raw === '' || raw === 'null' || raw === '~') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function toSimpleYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value === '' || /[:#\n"']/.test(value) || /^\d/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length === 0) return `${pad}- {}`;
          const [firstK, firstV] = entries[0];
          const firstLine = `${pad}- ${firstK}: ${typeof firstV === 'object' && firstV !== null ? '\n' + toSimpleYaml(firstV, indent + 2) : toSimpleYaml(firstV, 0)}`;
          const restLines = entries.slice(1).map(([k, v]) => {
            if (v && typeof v === 'object') {
              return `${pad}  ${k}:\n${toSimpleYaml(v, indent + 2)}`;
            }
            return `${pad}  ${k}: ${toSimpleYaml(v, 0)}`;
          });
          return [firstLine, ...restLines].join('\n');
        }
        return `${pad}- ${toSimpleYaml(item, 0)}`;
      })
      .join('\n');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return entries
    .map(([k, v]) => {
      if (v && typeof v === 'object') {
        return `${pad}${k}:\n${toSimpleYaml(v, indent + 1)}`;
      }
      return `${pad}${k}: ${toSimpleYaml(v, 0)}`;
    })
    .join('\n');
}

function parseIniOrEnv(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let section: Record<string, unknown> | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      const secName = line.slice(1, -1).trim();
      section = {};
      root[secName] = section;
      continue;
    }
    const eq = line.indexOf('=');
    if (eq !== -1) {
      const k = line.slice(0, eq).trim();
      const v = parseScalar(line.slice(eq + 1).trim());
      if (section) section[k] = v;
      else root[k] = v;
    }
  }
  return root;
}

function parseToml(text: string): Record<string, unknown> {
  return parseIniOrEnv(text);
}

function parseSimpleXml(text: string): unknown {
  const rows: Record<string, string>[] = [];
  const rowRegex = /<(row|item|record|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(text)) !== null) {
    const inner = match[2];
    const obj: Record<string, string> = {};
    const fieldRegex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
    let fMatch: RegExpExecArray | null;
    while ((fMatch = fieldRegex.exec(inner)) !== null) {
      obj[fMatch[1]] = fMatch[2]
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"');
    }
    if (Object.keys(obj).length > 0) rows.push(obj);
  }
  if (rows.length > 0) return rows;

  const flat: Record<string, string> = {};
  const tagRegex = /<([a-zA-Z0-9_-]+)>([^<]+)<\/\1>/g;
  while ((match = tagRegex.exec(text)) !== null) {
    flat[match[1]] = match[2].trim();
  }
  return flat;
}

function toSimpleXml(value: unknown): string {
  const esc = (s: unknown) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  const sanitizeTag = (k: string) => k.replace(/[^a-zA-Z0-9_-]/g, '_') || 'field';

  if (Array.isArray(value)) {
    const items = value
      .map((item) => {
        if (item && typeof item === 'object') {
          const fields = Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => `    <${sanitizeTag(k)}>${esc(v)}</${sanitizeTag(k)}>`)
            .join('\n');
          return `  <record>\n${fields}\n  </record>`;
        }
        return `  <item>${esc(item)}</item>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${items}\n</records>`;
  }

  if (value && typeof value === 'object') {
    const fields = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `  <${sanitizeTag(k)}>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</${sanitizeTag(k)}>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${fields}\n</root>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<value>${esc(value)}</value>`;
}

function toTomlOrIni(value: unknown, format: 'toml' | 'ini' | 'env'): string {
  const rows = Array.isArray(value) ? value : [value];
  if (format === 'env') {
    const obj = (rows[0] && typeof rows[0] === 'object' ? rows[0] : { VALUE: value }) as Record<string, unknown>;
    return Object.entries(obj)
      .map(([k, v]) => `${k.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}=${typeof v === 'string' && /\s/.test(v) ? JSON.stringify(v) : String(v ?? '')}`)
      .join('\n');
  }

  if (Array.isArray(value)) {
    return value
      .map((item, idx) => {
        const obj = (item && typeof item === 'object' ? item : { value: item }) as Record<string, unknown>;
        const header = format === 'toml' ? `[[records]]` : `[record_${idx + 1}]`;
        const lines = Object.entries(obj).map(
          ([k, v]) => `${k} = ${typeof v === 'string' && format === 'toml' ? JSON.stringify(v) : String(v ?? '')}`,
        );
        return [header, ...lines].join('\n');
      })
      .join('\n\n');
  }

  const obj = (value && typeof value === 'object' ? value : { value }) as Record<string, unknown>;
  return Object.entries(obj)
    .map(([k, v]) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const sec = Object.entries(v as Record<string, unknown>)
          .map(([sk, sv]) => `${sk} = ${typeof sv === 'string' && format === 'toml' ? JSON.stringify(sv) : String(sv ?? '')}`)
          .join('\n');
        return `[${k}]\n${sec}`;
      }
      return `${k} = ${typeof v === 'string' && format === 'toml' ? JSON.stringify(v) : String(v ?? '')}`;
    })
    .join('\n');
}

function toSqlInserts(rows: Record<string, unknown>[], tableName = 'records'): string {
  if (rows.length === 0) return `-- No rows found for table ${tableName}\n`;
  const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_') || 'records';
  const cols = Array.from(
    rows.reduce((s, r) => {
      for (const k of Object.keys(r)) s.add(k);
      return s;
    }, new Set<string>()),
  );
  const sqlVal = (v: unknown) => {
    if (v === null || v === undefined || v === '') return 'NULL';
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return `'${String(v).replaceAll("'", "''")}'`;
  };
  const colList = cols.map((c) => `"${c.replaceAll('"', '')}"`).join(', ');
  return rows
    .map((r) => `INSERT INTO "${safeTable}" (${colList}) VALUES (${cols.map((c) => sqlVal(r[c])).join(', ')});`)
    .join('\n');
}

function normalizeToRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : { value: item },
    );
  }
  if (data && typeof data === 'object') {
    return [data as Record<string, unknown>];
  }
  return [{ value: data }];
}

function markdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push('');
      continue;
    }
    if (t.startsWith('### ')) out.push(`<h3>${esc(t.slice(4))}</h3>`);
    else if (t.startsWith('## ')) out.push(`<h2>${esc(t.slice(3))}</h2>`);
    else if (t.startsWith('# ')) out.push(`<h1>${esc(t.slice(2))}</h1>`);
    else if (t.startsWith('- ') || t.startsWith('* ')) out.push(`<li>${esc(t.slice(2))}</li>`);
    else {
      const formatted = esc(t)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
      out.push(`<p>${formatted}</p>`);
    }
  }
  return `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Converted Document</title><style>body{font-family:system-ui,sans-serif;max-width:780px;margin:40px auto;line-height:1.6;color:#1e293b;padding:0 20px}code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head>\n<body>\n${out.join('\n')}\n</body>\n</html>`;
}

function htmlToTextOrMarkdown(html: string, toMd: boolean): string {
  let out = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  if (toMd) {
    out = out
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  }
  out = out
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

export function convertStructuredDataText(
  inputText: string,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions = {},
): DataTransformResult {
  try {
    const src = sourceFormat.toLowerCase();
    const tgt = targetFormat.toLowerCase();
    const warnings: string[] = [];

    // Markup conversions (md <-> html <-> txt)
    if (['md', 'html', 'txt'].includes(src) && ['md', 'html', 'txt'].includes(tgt)) {
      let outputText = inputText;
      if (src === 'md' && tgt === 'html') outputText = markdownToHtml(inputText);
      else if (src === 'md' && tgt === 'txt') outputText = inputText.replace(/^#{1,6}\s+/gm, '').replace(/[*_`]/g, '');
      else if (src === 'html' && tgt === 'md') outputText = htmlToTextOrMarkdown(inputText, true);
      else if (src === 'html' && tgt === 'txt') outputText = htmlToTextOrMarkdown(inputText, false);
      else if (src === 'txt' && tgt === 'html') outputText = markdownToHtml(inputText);

      const bytes = new TextEncoder().encode(outputText);
      const mime = getFormatById(tgt)?.mimeType ?? 'text/plain';
      return {
        success: true,
        outputText,
        outputBytes: bytes,
        mimeType: mime,
        targetExtension: tgt,
        warnings,
      };
    }

    // Parse structured data
    let parsed: unknown;
    if (src === 'json') parsed = JSON.parse(inputText);
    else if (src === 'csv') parsed = parseDelimitedText(inputText, options.csvDelimiter ?? ',');
    else if (src === 'tsv') parsed = parseDelimitedText(inputText, '\t');
    else if (src === 'yaml') parsed = parseSimpleYaml(inputText);
    else if (src === 'xml') parsed = parseSimpleXml(inputText);
    else if (src === 'toml') parsed = parseToml(inputText);
    else if (src === 'ini' || src === 'env') parsed = parseIniOrEnv(inputText);
    else if (src === 'sql') {
      const rows: Record<string, string>[] = [];
      const insertRe = /INSERT\s+INTO\s+\S+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;
      let m: RegExpExecArray | null;
      while ((m = insertRe.exec(inputText)) !== null) {
        const cols = m[1].split(',').map((c) => c.trim().replace(/^["`]|["`]$/g, ''));
        const vals = m[2].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
        const obj: Record<string, string> = {};
        cols.forEach((c, idx) => {
          obj[c] = vals[idx] ?? '';
        });
        rows.push(obj);
      }
      parsed = rows;
    } else {
      parsed = { content: inputText };
    }

    const rows = normalizeToRows(parsed);
    const indent = options.indentSpaces ?? 2;
    let outputText = '';

    if (tgt === 'json') {
      outputText = JSON.stringify(parsed, null, indent);
    } else if (tgt === 'csv') {
      outputText = serializeDelimitedText(rows, options.csvDelimiter ?? ',');
    } else if (tgt === 'tsv') {
      outputText = serializeDelimitedText(rows, '\t');
    } else if (tgt === 'yaml') {
      outputText = toSimpleYaml(parsed);
    } else if (tgt === 'xml') {
      outputText = toSimpleXml(parsed);
    } else if (tgt === 'toml' || tgt === 'ini' || tgt === 'env') {
      outputText = toTomlOrIni(parsed, tgt);
    } else if (tgt === 'sql') {
      outputText = toSqlInserts(rows, options.sqlTableName ?? 'records');
    } else if (tgt === 'md') {
      const headers = Object.keys(rows[0] ?? {});
      if (headers.length === 0) {
        outputText = '';
      } else {
        const sep = headers.map(() => '---').join(' | ');
        const body = rows.map((r) => headers.map((h) => String(r[h] ?? '')).join(' | ')).join('\n');
        outputText = `| ${headers.join(' | ')} |\n| ${sep} |\n${body.split('\n').map((l) => `| ${l} |`).join('\n')}`;
      }
    } else if (tgt === 'html') {
      const headers = Object.keys(rows[0] ?? {});
      const ths = headers.map((h) => `<th>${h}</th>`).join('');
      const trs = rows
        .map((r) => `<tr>${headers.map((h) => `<td>${String(r[h] ?? '')}</td>`).join('')}</tr>`)
        .join('\n');
      outputText = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left}th{background:#f1f5f9}</style></head><body><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
    } else {
      outputText = JSON.stringify(parsed, null, 2);
    }

    const bytes = new TextEncoder().encode(outputText);
    const mime = getFormatById(tgt)?.mimeType ?? 'text/plain';
    return {
      success: true,
      outputText,
      outputBytes: bytes,
      mimeType: mime,
      targetExtension: tgt,
      rowCount: rows.length,
      warnings,
    };
  } catch (err) {
    return {
      success: false,
      outputText: '',
      outputBytes: new Uint8Array(0),
      mimeType: 'text/plain',
      targetExtension: targetFormat,
      warnings: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// TIER 2: PURE CLIENT-SIDE PDF 1.4 GENERATOR (Text, Tables & Embedded Images)
// ============================================================================

const PDF_PAGE_SIZES: Record<'A4' | 'Letter' | 'Legal', [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
};

function escapePdfText(str: string): string {
  // Strip non-Latin1 characters safely for standard Type1 Helvetica font
  const safe = str.replace(/[^\x20-\x7E]/g, '?');
  return safe
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function buildPdfBinary(objects: string[], rootObjId = 1): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    chunks.push(b);
    cursor += b.length;
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  for (let i = 0; i < objects.length; i++) {
    offsets.push(cursor);
    pushStr(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }

  const xrefOffset = cursor;
  pushStr(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const off of offsets) {
    pushStr(`${String(off).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${objects.length + 1} /Root ${rootObjId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(cursor);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

function buildPdfWithBinaryStreams(
  textObjects: Array<{ id: number; body: string }>,
  binaryStreams: Array<{ id: number; dict: string; data: Uint8Array }>,
): Uint8Array {
  const encoder = new TextEncoder();
  const allIds = [
    ...textObjects.map((o) => ({ id: o.id, kind: 'text' as const, body: o.body })),
    ...binaryStreams.map((o) => ({ id: o.id, kind: 'bin' as const, dict: o.dict, data: o.data })),
  ].sort((a, b) => a.id - b.id);

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    cursor += b.length;
  };
  const pushStr = (s: string) => pushBytes(encoder.encode(s));

  pushStr('%PDF-1.4\n');
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  for (const obj of allIds) {
    offsets.push(cursor);
    if (obj.kind === 'text') {
      pushStr(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
    } else {
      pushStr(`${obj.id} 0 obj\n${obj.dict}\nstream\n`);
      pushBytes(obj.data);
      pushStr(`\nendstream\nendobj\n`);
    }
  }

  const xrefOffset = cursor;
  pushStr(`xref\n0 ${allIds.length + 1}\n0000000000 65535 f \n`);
  for (const off of offsets) {
    pushStr(`${String(off).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${allIds.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(cursor);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export function generateTextPdf(
  title: string,
  lines: readonly string[],
  pageSize: 'A4' | 'Letter' | 'Legal' = 'A4',
): Uint8Array {
  const [pageW, pageH] = PDF_PAGE_SIZES[pageSize];
  const margin = 48;
  const maxWidthChars = Math.floor((pageW - margin * 2) / 5.4);
  const lineHeight = 14.5;

  const wrapped: Array<{ text: string; heading: boolean }> = [
    { text: title, heading: true },
    { text: '', heading: false },
  ];

  for (const rawLine of lines) {
    const isHeading = rawLine.startsWith('#');
    const clean = rawLine.replace(/^#{1,6}\s+/, '');
    if (!clean) {
      wrapped.push({ text: '', heading: false });
      continue;
    }
    const words = clean.split(/\s+/);
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).trim().length > maxWidthChars) {
        wrapped.push({ text: current.trim(), heading: isHeading });
        current = w;
      } else {
        current = (current + ' ' + w).trim();
      }
    }
    if (current) wrapped.push({ text: current, heading: isHeading });
  }

  const linesPerPage = Math.max(10, Math.floor((pageH - margin * 2) / lineHeight));
  const pages: Array<typeof wrapped> = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([{ text: title, heading: true }]);

  // Object numbering: 1=Catalog, 2=Pages, 3=FontRegular, 4=FontBold, then pairs of (Page, Content)
  const objects: string[] = [];
  const pageRefs: string[] = [];
  let nextObjId = 5;

  const pageObjects: string[] = [];
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    pageRefs.push(`${pageObjId} 0 R`);

    const cmds: string[] = ['BT'];
    let y = pageH - margin;
    for (const item of pages[pIdx]) {
      const font = item.heading ? '/F2' : '/F1';
      const size = item.heading ? 13 : 10;
      cmds.push(`${font} ${size} Tf`);
      cmds.push(`1 0 0 1 ${margin} ${y.toFixed(2)} Tm`);
      cmds.push(`(${escapePdfText(item.text)}) Tj`);
      y -= lineHeight;
    }
    cmds.push('ET');
    const stream = cmds.join('\n');

    pageObjects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    );
    pageObjects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
  }

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`);
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
  objects.push(...pageObjects);

  return buildPdfBinary(objects, 1);
}

export async function generateImagePdf(
  imageBlob: Blob,
  sourceFormat: string,
  pageSize: 'A4' | 'Letter' | 'Legal' = 'A4',
): Promise<Uint8Array> {
  const decoded = await decodeImageDrawable(imageBlob, sourceFormat);
  try {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(decoded.width, decoded.height)
        : (() => {
            const c = document.createElement('canvas');
            c.width = decoded.width;
            c.height = decoded.height;
            return c;
          })();
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) throw new Error('Canvas 2D unavailable for PDF image embedding');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, decoded.width, decoded.height);
    ctx.drawImage(decoded.drawable, 0, 0, decoded.width, decoded.height);

    const jpegBlob = await canvasToBlobCompat(canvas, 'image/jpeg', 0.92);
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());

    const [pageW, pageH] = PDF_PAGE_SIZES[pageSize];
    const margin = 36;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scale = Math.min(availW / decoded.width, availH / decoded.height);
    const drawW = decoded.width * scale;
    const drawH = decoded.height * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    const contentStream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im1 Do\nQ`;
    const contentBytes = new TextEncoder().encode(contentStream);

    return buildPdfWithBinaryStreams(
      [
        { id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` },
        { id: 2, body: `<< /Type /Pages /Kids [3 0 R] /Count 1 >>` },
        {
          id: 3,
          body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
        },
      ],
      [
        {
          id: 4,
          dict: `<< /Type /XObject /Subtype /Image /Width ${decoded.width} /Height ${decoded.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`,
          data: jpegBytes,
        },
        {
          id: 5,
          dict: `<< /Length ${contentBytes.length} >>`,
          data: contentBytes,
        },
      ],
    );
  } finally {
    decoded.cleanup();
  }
}

// ============================================================================
// TIER 1 & 2: ZIP & GZIP PURE BROWSER ARCHIVE ENGINE
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function runCompressionStream(
  data: Uint8Array,
  format: 'gzip' | 'deflate-raw',
  mode: 'compress' | 'decompress',
): Promise<Uint8Array> {
  const StreamCtor =
    mode === 'compress'
      ? (globalThis as unknown as { CompressionStream?: typeof CompressionStream }).CompressionStream
      : (globalThis as unknown as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;

  if (!StreamCtor) {
    throw new Error(`${mode === 'compress' ? 'CompressionStream' : 'DecompressionStream'} unavailable`);
  }

  const stream = new StreamCtor(format);
  const writer = stream.writable.getWriter();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  void writer.write(copy).then(() => writer.close());
  const resp = new Response(stream.readable);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

export interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

export async function createZipArchive(entries: readonly ZipEntryInput[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replace(/^\/+/, ''));
    const checksum = crc32(entry.data);
    let compressed = entry.data;
    let method = 0; // 0 = STORE

    if (typeof CompressionStream !== 'undefined' && entry.data.length > 64) {
      try {
        const deflated = await runCompressionStream(entry.data, 'deflate-raw', 'compress');
        if (deflated.length < entry.data.length) {
          compressed = deflated;
          method = 8; // 8 = DEFLATE
        }
      } catch {
        // Fallback to STORE
      }
    }

    // Local file header (30 bytes + filename)
    const lfh = new ArrayBuffer(30);
    const lv = new DataView(lfh);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);

    localChunks.push(new Uint8Array(lfh), nameBytes, compressed);

    // Central directory header (46 bytes + filename)
    const cdh = new ArrayBuffer(46);
    const cv = new DataView(cdh);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, localOffset, true);

    centralChunks.push(new Uint8Array(cdh), nameBytes);
    localOffset += 30 + nameBytes.length + compressed.length;
    centralSize += 46 + nameBytes.length;
  }

  // End of central directory (22 bytes)
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, localOffset, true);
  ev.setUint16(20, 0, true);

  const totalBytes = localOffset + centralSize + 22;
  const out = new Uint8Array(totalBytes);
  let pos = 0;
  for (const c of localChunks) {
    out.set(c, pos);
    pos += c.length;
  }
  for (const c of centralChunks) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(new Uint8Array(eocd), pos);
  return out;
}

export async function extractFirstFromZip(zipBytes: Uint8Array): Promise<{ name: string; data: Uint8Array }> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  if (zipBytes.length < 30 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Invalid ZIP header');
  }
  const method = view.getUint16(8, true);
  const compSize = view.getUint32(18, true);
  const nameLen = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  const name = new TextDecoder().decode(zipBytes.subarray(30, 30 + nameLen));
  const dataStart = 30 + nameLen + extraLen;
  const payload = zipBytes.subarray(dataStart, dataStart + compSize);

  if (method === 0) return { name, data: payload };
  if (method === 8) {
    const data = await runCompressionStream(payload, 'deflate-raw', 'decompress');
    return { name, data };
  }
  throw new Error(`Unsupported ZIP compression method ${method}`);
}

export async function convertDataOrArchiveLocal(
  file: Blob,
  filename: string,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions,
  onProgress?: LocalProgressFn,
  signal?: AbortSignal,
): Promise<LocalConversionOutput> {
  assertNotAborted(signal);

  // Archive targets (ZIP / GZ)
  if (targetFormat === 'zip') {
    onProgress?.(25, 'Compressing payload into local ZIP archive...');
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    let entryName = filename;
    let entryBytes = inputBytes;

    if (sourceFormat === 'gz') {
      entryBytes = await runCompressionStream(inputBytes, 'gzip', 'decompress');
      entryName = filename.replace(/\.gz$/i, '') || 'extracted.bin';
    }

    const zipBytes = await createZipArchive([{ name: entryName, data: entryBytes }]);
    onProgress?.(100, 'ZIP archive generated locally');
    return {
      blob: new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' }),
      bytes: zipBytes,
      mimeType: 'application/zip',
      extension: 'zip',
      filename: replaceExtension(filename, 'zip'),
      warnings: [],
    };
  }

  if (targetFormat === 'gz') {
    onProgress?.(30, 'Compressing via native CompressionStream (GZIP)...');
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    const gzBytes = await runCompressionStream(inputBytes, 'gzip', 'compress');
    onProgress?.(100, 'GZIP archive generated');
    return {
      blob: new Blob([gzBytes.buffer as ArrayBuffer], { type: 'application/gzip' }),
      bytes: gzBytes,
      mimeType: 'application/gzip',
      extension: 'gz',
      filename: `${filename}.gz`,
      warnings: [],
    };
  }

  // Client-side PDF generation
  if (targetFormat === 'pdf') {
    const srcFormatInfo = getFormatById(sourceFormat);
    if (srcFormatInfo?.category === 'image' || srcFormatInfo?.category === 'vector') {
      onProgress?.(35, 'Embedding image into printable PDF page...');
      const pdfBytes = await generateImagePdf(file, sourceFormat, options.pageSize ?? 'A4');
      onProgress?.(100, 'Image PDF generated locally');
      return {
        blob: new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
        bytes: pdfBytes,
        mimeType: 'application/pdf',
        extension: 'pdf',
        filename: replaceExtension(filename, 'pdf'),
        warnings: [],
      };
    }

    onProgress?.(35, 'Typesetting document into A4/Letter PDF...');
    const rawText = await file.text();
    let lines: string[];
    if (['csv', 'tsv', 'json', 'yaml', 'xml', 'toml', 'ini'].includes(sourceFormat)) {
      const mdTable = convertStructuredDataText(rawText, sourceFormat, 'md', options);
      lines = (mdTable.success ? mdTable.outputText : rawText).split(/\r?\n/);
    } else if (sourceFormat === 'html') {
      lines = htmlToTextOrMarkdown(rawText, false).split(/\r?\n/);
    } else {
      lines = rawText.split(/\r?\n/);
    }

    const pdfBytes = generateTextPdf(filename, lines, options.pageSize ?? 'A4');
    onProgress?.(100, 'PDF document generated locally');
    return {
      blob: new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
      bytes: pdfBytes,
      mimeType: 'application/pdf',
      extension: 'pdf',
      filename: replaceExtension(filename, 'pdf'),
      warnings: [],
    };
  }

  // Structured data & markup transformation
  onProgress?.(30, `Transforming ${sourceFormat.toUpperCase()} -> ${targetFormat.toUpperCase()}...`);
  const inputText = await file.text();
  assertNotAborted(signal);

  const result = convertStructuredDataText(inputText, sourceFormat, targetFormat, options);
  if (!result.success) {
    throw new Error(result.errorMessage ?? `Failed to transform ${sourceFormat} to ${targetFormat}`);
  }

  onProgress?.(100, `${targetFormat.toUpperCase()} conversion complete`);
  const blob = new Blob([result.outputBytes.buffer as ArrayBuffer], { type: result.mimeType });
  return {
    blob,
    bytes: result.outputBytes,
    mimeType: result.mimeType,
    extension: result.targetExtension,
    filename: replaceExtension(filename, result.targetExtension),
    warnings: result.warnings,
    metadata: result.rowCount !== undefined ? { rows: result.rowCount } : undefined,
  };
}

// ============================================================================
// UNIFIED LOCAL DISPATCHER (Tier 1, Tier 2, Tier 3)
// ============================================================================

const sharedWasmLoader = new LazyWasmLoader();

export function getSharedWasmLoader(): LazyWasmLoader {
  return sharedWasmLoader;
}

export async function executeLocalConversion(params: {
  file: Blob;
  filename: string;
  sourceFormat: string;
  targetFormat: string;
  engineId: string;
  options: ConversionOptions;
  onProgress?: LocalProgressFn;
  signal?: AbortSignal;
}): Promise<LocalConversionOutput> {
  const { file, filename, sourceFormat, targetFormat, engineId, options, onProgress, signal } = params;

  if (engineId === 'canvas-2d') {
    return convertImageLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal);
  }
  if (engineId === 'web-audio-pcm') {
    return convertAudioLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal);
  }
  if (
    engineId === 'pure-data-tabular' ||
    engineId === 'pure-markup-doc' ||
    engineId === 'pure-archive-zip' ||
    engineId === 'pure-pdf-ops' ||
    engineId === 'compression-stream'
  ) {
    return convertDataOrArchiveLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal);
  }

  if (engineId === 'wasm-ffmpeg' || engineId === 'wasm-imagemagick') {
    const modId = engineId === 'wasm-ffmpeg' ? 'ffmpeg-wasm' : 'imagemagick-wasm';
    await sharedWasmLoader.loadModuleBinary(modId, {
      signal,
      onProgress: (pct, stage) => onProgress?.(Math.min(50, pct * 0.5), stage),
    });
    // Full multi-codec WASM runtime bridges into ServerFallback if codec wrapper isn't bundled offline
    throw new WasmLoaderError(
      `${modId} binary ready, delegating heavy codec execution to managed Server Fallback`,
      true,
    );
  }

  throw new Error(`Unsupported local conversion engine: ${engineId}`);
}
