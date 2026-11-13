import type { MagicDetectionResult } from '../../shared/types.ts';

// Known dangerous magic bytes
const BANNED_SIGNATURES = [
  { bytes: [0x4D, 0x5A], name: 'DOS/Windows Executable' }, // MZ
  { bytes: [0x7F, 0x45, 0x4C, 0x46], name: 'ELF Executable' }, // ELF
  { bytes: [0x23, 0x21], name: 'Shebang Script' }, // #!
];

export async function validateMagicBytes(buffer: Buffer): Promise<{ isValid: boolean; reason?: string }> {
  if (buffer.length < 4) return { isValid: false, reason: 'File too small' };

  for (const sig of BANNED_SIGNATURES) {
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return { isValid: false, reason: `File contains forbidden executable signature: ${sig.name}` };
    }
  }

  return { isValid: true };
}

export function verifySafeCompressionRatio(compressedBytes: number, uncompressedBytes: number, maxRatio = 100): boolean {
  if (compressedBytes === 0) return true;
  const ratio = uncompressedBytes / compressedBytes;
  return ratio <= maxRatio;
}
