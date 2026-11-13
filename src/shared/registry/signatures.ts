import type { MagicDetectionResult, MagicSignature } from '../types.ts';
import { getFormatByExtension } from './formats.catalog.ts';

export const MAGIC_SIGNATURES: readonly MagicSignature[] = [
  {
    formatId: 'png',
    offset: 0,
    hexBytes: ['89', '50', '4E', '47', '0D', '0A', '1A', '0A'],
    priority: 100,
    description: 'PNG Image Magic Signature',
  },
  {
    formatId: 'jpg',
    offset: 0,
    hexBytes: ['FF', 'D8', 'FF'],
    priority: 90,
    description: 'JPEG Image Magic Signature',
  },
  {
    formatId: 'gif',
    offset: 0,
    hexBytes: ['47', '49', '46', '38'],
    priority: 90,
    description: 'GIF Image Magic Signature',
  },
  {
    formatId: 'webp',
    offset: 0,
    hexBytes: ['52', '49', '46', '46'],
    asciiMarker: { offset: 8, value: 'WEBP' },
    priority: 95,
    description: 'WebP Image Magic Signature',
  },
  {
    formatId: 'wav',
    offset: 0,
    hexBytes: ['52', '49', '46', '46'],
    asciiMarker: { offset: 8, value: 'WAVE' },
    priority: 95,
    description: 'WAV Audio Magic Signature',
  },
  {
    formatId: 'avi',
    offset: 0,
    hexBytes: ['52', '49', '46', '46'],
    asciiMarker: { offset: 8, value: 'AVI ' },
    priority: 95,
    description: 'AVI Video Magic Signature',
  },
  {
    formatId: 'pdf',
    offset: 0,
    hexBytes: ['25', '50', '44', '46'],
    priority: 90,
    description: 'PDF Document Magic Signature',
  },
  {
    formatId: 'zip',
    offset: 0,
    hexBytes: ['50', '4B', '03', '04'],
    priority: 50,
    description: 'ZIP Archive Signature',
  },
  {
    formatId: 'gz',
    offset: 0,
    hexBytes: ['1F', '8B', '08'],
    priority: 80,
    description: 'GZIP Compression Signature',
  },
  {
    formatId: '7z',
    offset: 0,
    hexBytes: ['37', '7A', 'BC', 'AF', '27', '1C'],
    priority: 100,
    description: '7-Zip Archive Signature',
  },
  {
    formatId: 'rar',
    offset: 0,
    hexBytes: ['52', '61', '72', '21', '1A', '07'],
    priority: 100,
    description: 'RAR Archive Signature',
  },
  {
    formatId: 'mp3',
    offset: 0,
    hexBytes: ['49', '44', '33'],
    priority: 90,
    description: 'MP3 Audio (ID3v2 Tag) Signature',
  },
  {
    formatId: 'mp3',
    offset: 0,
    hexBytes: ['FF', 'FB'],
    priority: 40,
    description: 'MP3 Audio Frame Signature',
  },
  {
    formatId: 'flac',
    offset: 0,
    hexBytes: ['66', '4C', '61', '43'],
    priority: 90,
    description: 'FLAC Audio Signature',
  },
  {
    formatId: 'ogg',
    offset: 0,
    hexBytes: ['4F', '67', '67', '53'],
    priority: 90,
    description: 'OGG Container Signature',
  },
  {
    formatId: 'bmp',
    offset: 0,
    hexBytes: ['42', '4D'],
    priority: 40,
    description: 'BMP Image Signature',
  },
  {
    formatId: 'ico',
    offset: 0,
    hexBytes: ['00', '00', '01', '00'],
    priority: 40,
    description: 'ICO Icon Signature',
  },
  {
    formatId: 'tiff',
    offset: 0,
    hexBytes: ['49', '49', '2A', '00'],
    priority: 80,
    description: 'TIFF Image Signature (Little-Endian)',
  },
  {
    formatId: 'tiff',
    offset: 0,
    hexBytes: ['4D', '4D', '00', '2A'],
    priority: 80,
    description: 'TIFF Image Signature (Big-Endian)',
  },
  {
    formatId: 'webm',
    offset: 0,
    hexBytes: ['1A', '45', 'DF', 'A3'],
    priority: 80,
    description: 'WebM / MKV EBML Container Signature',
  },
  {
    formatId: 'mp4',
    offset: 4,
    hexBytes: ['66', '74', '79', '70'],
    priority: 70,
    description: 'MP4 / MOV / HEIC ISO Media Container Signature (ftyp)',
  },
  {
    formatId: 'woff',
    offset: 0,
    hexBytes: ['77', '4F', '46', '46'],
    priority: 90,
    description: 'WOFF Font Signature',
  },
  {
    formatId: 'woff2',
    offset: 0,
    hexBytes: ['77', '4F', '46', '32'],
    priority: 90,
    description: 'WOFF2 Font Signature',
  },
  {
    formatId: 'ttf',
    offset: 0,
    hexBytes: ['00', '01', '00', '00'],
    priority: 40,
    description: 'TTF Font Signature',
  },
  {
    formatId: 'otf',
    offset: 0,
    hexBytes: ['4F', '54', '54', '4F'],
    priority: 90,
    description: 'OTF Font Signature',
  },
  {
    formatId: 'parquet',
    offset: 0,
    hexBytes: ['50', '41', '52', '31'],
    priority: 90,
    description: 'Apache Parquet Magic Signature',
  },
] as const;

/**
 * Compatible container format relationships where magic byte detection
 * might find a generic container (like ZIP or EBML or FTYP) for a specialized format extension.
 */
const CONTAINER_COMPATIBILITY_MAP: Record<string, string[]> = {
  zip: ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub', 'jar', 'apk'],
  webm: ['mkv'],
  mp4: ['mov', 'm4v', 'heic', 'm4a', '3gp'],
};

/**
 * Detect file format from header magic bytes, text heuristics, and filename matching.
 */
export function detectFormatByMagicBytes(
  headerBytes: Uint8Array,
  filename?: string
): MagicDetectionResult {
  const extFormat = filename ? getFormatByExtension(filename) : undefined;
  const extensionFormatId = extFormat ? extFormat.id : null;

  let matchedSig: MagicSignature | undefined;
  let detectedFormatId: string | null = null;
  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';

  // 1. Check Binary Magic Signatures (sorted by priority descending)
  const sortedSignatures = [...MAGIC_SIGNATURES].sort((a, b) => b.priority - a.priority);

  for (const sig of sortedSignatures) {
    if (headerBytes.length < sig.offset + sig.hexBytes.length) {
      continue;
    }

    let match = true;
    for (let i = 0; i < sig.hexBytes.length; i++) {
      const expectedByte = parseInt(sig.hexBytes[i], 16);
      if (headerBytes[sig.offset + i] !== expectedByte) {
        match = false;
        break;
      }
    }

    if (match && sig.asciiMarker) {
      if (headerBytes.length < sig.asciiMarker.offset + sig.asciiMarker.value.length) {
        match = false;
      } else {
        const asciiSub = new TextDecoder('ascii').decode(
          headerBytes.subarray(
            sig.asciiMarker.offset,
            sig.asciiMarker.offset + sig.asciiMarker.value.length
          )
        );
        if (asciiSub !== sig.asciiMarker.value) {
          match = false;
        }
      }
    }

    if (match) {
      matchedSig = sig;
      detectedFormatId = sig.formatId;
      confidence = sig.priority >= 80 ? 'high' : 'medium';
      break;
    }
  }

  // 2. Text Heuristics if binary check did not yield high confidence
  if (!detectedFormatId && headerBytes.length > 0) {
    try {
      const sampleText = new TextDecoder('utf-8', { fatal: false })
        .decode(headerBytes.subarray(0, Math.min(headerBytes.length, 1024)))
        .trim();

      if (sampleText.toLowerCase().includes('<svg') || sampleText.toLowerCase().includes('xmlns="http://www.w3.org/2000/svg"')) {
        detectedFormatId = 'svg';
        confidence = 'high';
      } else if (sampleText.toLowerCase().startsWith('<!doctype html') || sampleText.toLowerCase().startsWith('<html')) {
        detectedFormatId = 'html';
        confidence = 'high';
      } else if (sampleText.toLowerCase().startsWith('<?xml')) {
        detectedFormatId = 'xml';
        confidence = 'medium';
      } else if (
        (sampleText.startsWith('{') && sampleText.includes(':')) ||
        (sampleText.startsWith('[') && sampleText.includes(']'))
      ) {
        detectedFormatId = 'json';
        confidence = 'medium';
      }
    } catch {
      // Ignore text decoding errors for binary data
    }
  }

  // 3. Spoof & Mismatch Analysis
  let isSpoofedOrMismatched = false;
  let warningMessage: string | undefined;

  if (detectedFormatId && extensionFormatId) {
    if (detectedFormatId !== extensionFormatId) {
      const allowedExtensions = CONTAINER_COMPATIBILITY_MAP[detectedFormatId] || [];
      const isCompatibleContainer = allowedExtensions.includes(extensionFormatId);

      if (!isCompatibleContainer) {
        isSpoofedOrMismatched = true;
        warningMessage = `Mismatched file format: File header magic bytes match '${detectedFormatId.toUpperCase()}', but file extension is '.${extensionFormatId}'. File may be corrupted or renamed.`;
      }
    }
  }

  return {
    detectedFormatId,
    confidence,
    matchedSignature: matchedSig,
    extensionFormatId,
    isSpoofedOrMismatched,
    warningMessage,
  };
}
