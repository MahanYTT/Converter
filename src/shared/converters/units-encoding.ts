import type { DataTransformResult } from '../types.ts';
import { getFormatById } from '../registry/formats.catalog.ts';

/**
 * Converts text/bytes between encodings: UTF-8, ASCII, Base64, Hex, URL-encoding, DataURI.
 */
export function convertEncodingOrText(
  inputBytes: Uint8Array,
  sourceFormat: string,
  targetFormat: string
): DataTransformResult {
  const warnings: string[] = [];
  const src = sourceFormat.trim().toLowerCase();
  const tgt = targetFormat.trim().toLowerCase();
  const tgtDef = getFormatById(tgt);

  const targetExtension = tgtDef ? tgtDef.extensions[0] : tgt;
  const mimeType = tgtDef ? tgtDef.mimeType : 'text/plain';

  if (!inputBytes || inputBytes.length === 0) {
    return {
      success: true,
      outputText: '',
      outputBytes: new Uint8Array(0),
      mimeType,
      targetExtension,
      warnings: ['Input bytes were empty'],
    };
  }

  try {
    // 1. Decode input bytes based on source format/encoding into a string or raw bytes
    const decodedText = decodeSource(inputBytes, src);
    const decodedBytes = new TextEncoder().encode(decodedText);

    // 2. Encode string into target format
    const outputText = encodeTarget(decodedText, decodedBytes, tgt);
    const outputBytes = new TextEncoder().encode(outputText);

    return {
      success: true,
      outputText,
      outputBytes,
      mimeType,
      targetExtension,
      warnings,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      outputText: '',
      outputBytes: new Uint8Array(0),
      mimeType,
      targetExtension,
      warnings,
      errorMessage: `Encoding conversion failed (${src} -> ${tgt}): ${message}`,
    };
  }
}

function decodeSource(bytes: Uint8Array, format: string): string {
  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();

  switch (format) {
    case 'base64': {
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(rawText, 'base64').toString('utf-8');
      }
      return atob(rawText);
    }

    case 'hex': {
      const cleanHex = rawText.replace(/[^0-9a-fA-F]/g, '');
      const byteArray = new Uint8Array(cleanHex.length / 2);
      for (let i = 0; i < cleanHex.length; i += 2) {
        byteArray[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
      }
      return new TextDecoder('utf-8').decode(byteArray);
    }

    case 'url':
    case 'url-encode': {
      return decodeURIComponent(rawText);
    }

    case 'data-uri': {
      const commaIdx = rawText.indexOf(',');
      if (commaIdx >= 0) {
        const payload = rawText.slice(commaIdx + 1);
        if (rawText.includes(';base64')) {
          if (typeof Buffer !== 'undefined') {
            return Buffer.from(payload, 'base64').toString('utf-8');
          }
          return atob(payload);
        }
        return decodeURIComponent(payload);
      }
      return rawText;
    }

    case 'ascii': {
      return new TextDecoder('ascii').decode(bytes);
    }

    default:
      return rawText;
  }
}

function encodeTarget(text: string, rawBytes: Uint8Array, format: string): string {
  switch (format) {
    case 'base64': {
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(rawBytes).toString('base64');
      }
      let binary = '';
      for (let i = 0; i < rawBytes.length; i++) {
        binary += String.fromCharCode(rawBytes[i]);
      }
      return btoa(binary);
    }

    case 'hex': {
      return Array.from(rawBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    case 'url':
    case 'url-encode': {
      return encodeURIComponent(text);
    }

    case 'data-uri': {
      const base64 = typeof Buffer !== 'undefined'
        ? Buffer.from(rawBytes).toString('base64')
        : btoa(String.fromCharCode(...rawBytes));
      return `data:text/plain;base64,${base64}`;
    }

    case 'ascii': {
      return text.replace(/[^\x00-\x7F]/g, '?');
    }

    default:
      return text;
  }
}
