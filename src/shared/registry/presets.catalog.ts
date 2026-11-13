import type { ConversionPreset } from '../types.ts';

export const CONVERSION_PRESETS: readonly ConversionPreset[] = [
  // --- IMAGES ---
  {
    id: 'webp-web-optimized',
    name: 'Web-Optimized WEBP (Quality 82)',
    category: 'image',
    targetFormat: 'webp',
    description: 'Optimal balance of image clarity and reduced file size for web pages.',
    options: {
      quality: 82,
      stripMetadata: true,
    },
  },
  {
    id: 'webp-lossless',
    name: 'Lossless WEBP (Strip EXIF)',
    category: 'image',
    targetFormat: 'webp',
    description: 'Bit-exact lossless WEBP compression with metadata removed.',
    options: {
      quality: 100,
      stripMetadata: true,
    },
  },
  {
    id: 'avif-high-compression',
    name: 'Next-Gen AVIF (Quality 70)',
    category: 'image',
    targetFormat: 'avif',
    description: 'Maximum compression efficiency for ultra-fast site loading.',
    options: {
      quality: 70,
      stripMetadata: true,
    },
  },
  {
    id: 'jpg-web-standard',
    name: 'JPEG Standard Photo (Quality 85)',
    category: 'image',
    targetFormat: 'jpg',
    description: 'High compatibility photo format for broad web and legacy support.',
    options: {
      quality: 85,
      stripMetadata: true,
    },
  },
  {
    id: 'jpg-thumbnail-320',
    name: 'JPEG Quick Thumbnail (320px)',
    category: 'image',
    targetFormat: 'jpg',
    description: 'Resized 320px width thumbnail for previews and galleries.',
    options: {
      width: 320,
      quality: 75,
      fit: 'inside',
      stripMetadata: true,
    },
  },
  {
    id: 'png-privacy-clean',
    name: 'Privacy Clean PNG',
    category: 'image',
    targetFormat: 'png',
    description: 'Lossless PNG image with all EXIF location & camera tags removed.',
    options: {
      stripMetadata: true,
    },
  },
  {
    id: 'ico-favicon-32',
    name: 'Web Favicon ICO (32x32)',
    category: 'image',
    targetFormat: 'ico',
    description: 'Standard 32x32 pixel icon file for website browsers.',
    options: {
      width: 32,
      height: 32,
      fit: 'contain',
    },
  },

  // --- VIDEO ---
  {
    id: 'mp4-social-1080p',
    name: 'Social Video 1080p (CRF 23)',
    category: 'video',
    targetFormat: 'mp4',
    description: 'Crisp Full HD H.264 video ready for YouTube, Twitter, or Instagram.',
    options: {
      height: 1080,
      videoCrf: 23,
      fps: 30,
      audioBitrateKbps: 192,
    },
  },
  {
    id: 'mp4-web-720p',
    name: 'Web Video HD 720p (CRF 26)',
    category: 'video',
    targetFormat: 'mp4',
    description: 'Lightweight HD video optimized for fast streaming and lower bandwidth.',
    options: {
      height: 720,
      videoCrf: 26,
      fps: 30,
      audioBitrateKbps: 128,
    },
  },
  {
    id: 'webm-discord-clip',
    name: 'Discord Clip (<10MB Target)',
    category: 'video',
    targetFormat: 'webm',
    description: 'WebM video tuned for messaging app sharing limits.',
    options: {
      height: 720,
      videoCrf: 28,
      fps: 30,
      audioBitrateKbps: 96,
    },
  },
  {
    id: 'gif-animated-thumbnail',
    name: 'Animated GIF Thumbnail (480p, 15fps)',
    category: 'video',
    targetFormat: 'gif',
    description: 'Converted animated clip tuned for email signatures and forums.',
    options: {
      width: 480,
      fps: 15,
    },
  },

  // --- AUDIO ---
  {
    id: 'mp3-podcast-mono-64k',
    name: 'Podcast Speech (64 kbps Mono, 16kHz)',
    category: 'audio',
    targetFormat: 'mp3',
    description: 'Highly compressed speech audio preset for podcasts and voice notes.',
    options: {
      channels: 1,
      sampleRate: 16000,
      audioBitrateKbps: 64,
      normalizeAudio: true,
    },
  },
  {
    id: 'mp3-music-high-320k',
    name: 'High Quality Music (320 kbps Stereo)',
    category: 'audio',
    targetFormat: 'mp3',
    description: 'Maximum quality lossy MP3 encoding at 320 kbps stereo.',
    options: {
      channels: 2,
      sampleRate: 44100,
      audioBitrateKbps: 320,
      normalizeAudio: true,
    },
  },
  {
    id: 'wav-studio-24bit',
    name: 'Studio PCM WAV (48kHz Stereo)',
    category: 'audio',
    targetFormat: 'wav',
    description: 'Uncompressed broadcast quality WAV audio for editing.',
    options: {
      channels: 2,
      sampleRate: 48000,
      normalizeAudio: false,
    },
  },
  {
    id: 'flac-archival-lossless',
    name: 'Archival Lossless FLAC',
    category: 'audio',
    targetFormat: 'flac',
    description: 'Lossless audio archiving with 44.1kHz sampling.',
    options: {
      channels: 2,
      sampleRate: 44100,
    },
  },

  // --- DOCUMENTS ---
  {
    id: 'pdf-print-a4',
    name: 'Print-Ready PDF (A4)',
    category: 'document',
    targetFormat: 'pdf',
    description: 'Formatted document output layout formatted for standard A4 paper.',
    options: {
      pageSize: 'A4',
    },
  },
  {
    id: 'pdf-letter-standard',
    name: 'Standard Document PDF (Letter)',
    category: 'document',
    targetFormat: 'pdf',
    description: 'Formatted document output formatted for standard Letter paper size.',
    options: {
      pageSize: 'Letter',
    },
  },

  // --- DATA / TABULAR ---
  {
    id: 'json-pretty-4space',
    name: 'Formatted JSON (4-Space Indent)',
    category: 'data',
    targetFormat: 'json',
    description: 'Human-readable formatted JSON with clean line indentation.',
    options: {
      indentSpaces: 4,
    },
  },
  {
    id: 'json-minified',
    name: 'Minified JSON (Compact)',
    category: 'data',
    targetFormat: 'json',
    description: 'Stripped whitespace JSON for minimal payload size.',
    options: {
      indentSpaces: 0,
    },
  },
  {
    id: 'csv-excel-semicolon',
    name: 'European Excel CSV (Semicolon Delimiter)',
    category: 'data',
    targetFormat: 'csv',
    description: 'CSV formatted using semicolon (;) separation for European locale Excel.',
    options: {
      csvDelimiter: ';',
    },
  },
  {
    id: 'sql-insert-statements',
    name: 'SQL INSERT Batch Script',
    category: 'data',
    targetFormat: 'sql',
    description: 'Generates SQL INSERT statements into table `imported_data`.',
    options: {
      sqlTableName: 'imported_data',
    },
  },

  // --- MARKUP ---
  {
    id: 'md-clean-documentation',
    name: 'Clean Markdown Document',
    category: 'document',
    targetFormat: 'md',
    description: 'Standard GitHub-Flavored Markdown formatting.',
    options: {},
  },
  {
    id: 'html-standalone-page',
    name: 'Standalone HTML Webpage',
    category: 'document',
    targetFormat: 'html',
    description: 'Complete HTML5 document wrapper with standard head tag structure.',
    options: {},
  },
  {
    id: 'png-web-lossless',
    name: 'Web Transparent PNG',
    category: 'image',
    targetFormat: 'png',
    description: 'Lossless web graphics with transparent background support.',
    options: {
      stripMetadata: true,
    },
  },
  {
    id: 'flac-hi-res-96k',
    name: 'Hi-Res Audio FLAC (96kHz)',
    category: 'audio',
    targetFormat: 'flac',
    description: 'High resolution audiophile FLAC encoding.',
    options: {
      sampleRate: 96000,
      channels: 2,
    },
  },
  {
    id: 'json-compact-minified',
    name: 'Compact Minified Data JSON',
    category: 'data',
    targetFormat: 'json',
    description: 'Zero indentation space minified JSON.',
    options: {
      indentSpaces: 0,
    },
  },
];

/**
 * Get all presets available for a specified target format ID.
 */
export function getPresetsForTarget(targetFormat: string): ConversionPreset[] {
  if (!targetFormat) return [];
  const cleanTarget = targetFormat.trim().toLowerCase();
  return CONVERSION_PRESETS.filter((p) => p.targetFormat === cleanTarget);
}
