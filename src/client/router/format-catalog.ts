import type {
  ConversionPreset,
  ConversionRouteRule,
  FormatCategory,
  FormatDefinition,
  MagicDetectionResult,
  MagicSignature,
} from '../../shared/types.ts';

export const CLIENT_FORMATS: readonly FormatDefinition[] = [
  // Images
  {
    id: 'png',
    name: 'Portable Network Graphics',
    label: 'PNG',
    category: 'image',
    extensions: ['png'],
    mimeType: 'image/png',
    compressionType: 'lossless',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: 'Lossless raster image with alpha transparency',
  },
  {
    id: 'jpg',
    name: 'JPEG Image',
    label: 'JPG',
    category: 'image',
    extensions: ['jpg', 'jpeg', 'jpe'],
    mimeType: 'image/jpeg',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Widely supported lossy photographic raster format',
  },
  {
    id: 'webp',
    name: 'WebP Image',
    label: 'WEBP',
    category: 'image',
    extensions: ['webp'],
    mimeType: 'image/webp',
    compressionType: 'both',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: 'Modern web image format with lossy/lossless compression and alpha',
  },
  {
    id: 'avif',
    name: 'AV1 Image File Format',
    label: 'AVIF',
    category: 'image',
    extensions: ['avif'],
    mimeType: 'image/avif',
    compressionType: 'both',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: 'Next-generation high-efficiency AV1 image format',
  },
  {
    id: 'bmp',
    name: 'Windows Bitmap',
    label: 'BMP',
    category: 'image',
    extensions: ['bmp'],
    mimeType: 'image/bmp',
    compressionType: 'uncompressed',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: 'Uncompressed device-independent raster bitmap',
  },
  {
    id: 'ico',
    name: 'Windows Icon',
    label: 'ICO',
    category: 'image',
    extensions: ['ico'],
    mimeType: 'image/x-icon',
    mimeAliases: ['image/vnd.microsoft.icon'],
    compressionType: 'lossless',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 20,
    description: 'Favicon and application icon container',
  },
  {
    id: 'gif',
    name: 'Graphics Interchange Format',
    label: 'GIF',
    category: 'image',
    extensions: ['gif'],
    mimeType: 'image/gif',
    compressionType: 'lossless',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 60,
    description: 'Indexed color raster and animated image format',
  },
  {
    id: 'svg',
    name: 'Scalable Vector Graphics',
    label: 'SVG',
    category: 'vector',
    extensions: ['svg'],
    mimeType: 'image/svg+xml',
    compressionType: 'text',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 25,
    description: 'XML-based resolution-independent vector graphics',
  },
  {
    id: 'tiff',
    name: 'Tagged Image File Format',
    label: 'TIFF',
    category: 'image',
    extensions: ['tif', 'tiff'],
    mimeType: 'image/tiff',
    compressionType: 'both',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: 'Archival and print-grade raster image format',
  },
  {
    id: 'heic',
    name: 'High Efficiency Image Container',
    label: 'HEIC',
    category: 'image',
    extensions: ['heic', 'heif'],
    mimeType: 'image/heic',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: 'Apple HEVC-compressed photo container',
  },

  // Audio
  {
    id: 'wav',
    name: 'Waveform Audio',
    label: 'WAV',
    category: 'audio',
    extensions: ['wav', 'wave'],
    mimeType: 'audio/wav',
    mimeAliases: ['audio/x-wav'],
    compressionType: 'uncompressed',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 250,
    description: 'Uncompressed lossless PCM waveform audio',
  },
  {
    id: 'mp3',
    name: 'MPEG Layer 3 Audio',
    label: 'MP3',
    category: 'audio',
    extensions: ['mp3'],
    mimeType: 'audio/mpeg',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Universal lossy compressed audio stream',
  },
  {
    id: 'ogg',
    name: 'Ogg Vorbis',
    label: 'OGG',
    category: 'audio',
    extensions: ['ogg', 'oga'],
    mimeType: 'audio/ogg',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Open-source lossy audio container',
  },
  {
    id: 'flac',
    name: 'Free Lossless Audio Codec',
    label: 'FLAC',
    category: 'audio',
    extensions: ['flac'],
    mimeType: 'audio/flac',
    compressionType: 'lossless',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 200,
    description: 'Bit-exact lossless compressed audio',
  },
  {
    id: 'aac',
    name: 'Advanced Audio Coding',
    label: 'AAC',
    category: 'audio',
    extensions: ['aac', 'm4a'],
    mimeType: 'audio/aac',
    mimeAliases: ['audio/mp4'],
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Modern perceptual audio codec',
  },
  {
    id: 'opus',
    name: 'Opus Interactive Audio',
    label: 'OPUS',
    category: 'audio',
    extensions: ['opus'],
    mimeType: 'audio/opus',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Low-latency speech and music codec',
  },

  // Video
  {
    id: 'mp4',
    name: 'MPEG-4 Video',
    label: 'MP4',
    category: 'video',
    extensions: ['mp4', 'm4v'],
    mimeType: 'video/mp4',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Universal H.264/H.265 multimedia container',
  },
  {
    id: 'webm',
    name: 'WebM Video',
    label: 'WEBM',
    category: 'video',
    extensions: ['webm'],
    mimeType: 'video/webm',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Open web-native VP8/VP9/AV1 video container',
  },
  {
    id: 'mov',
    name: 'QuickTime Movie',
    label: 'MOV',
    category: 'video',
    extensions: ['mov'],
    mimeType: 'video/quicktime',
    compressionType: 'lossy',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: 'Apple QuickTime multimedia container',
  },
  {
    id: 'mkv',
    name: 'Matroska Video',
    label: 'MKV',
    category: 'video',
    extensions: ['mkv'],
    mimeType: 'video/x-matroska',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: 'Extensible open-standard multimedia container',
  },

  // Data & Tabular
  {
    id: 'json',
    name: 'JSON Data',
    label: 'JSON',
    category: 'data',
    extensions: ['json'],
    mimeType: 'application/json',
    compressionType: 'text',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: 'JavaScript Object Notation structured data',
  },
  {
    id: 'csv',
    name: 'Comma-Separated Values',
    label: 'CSV',
    category: 'data',
    extensions: ['csv'],
    mimeType: 'text/csv',
    compressionType: 'text',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: 'Tabular plain-text spreadsheet format',
  },
  {
    id: 'tsv',
    name: 'Tab-Separated Values',
    label: 'TSV',
    category: 'data',
    extensions: ['tsv'],
    mimeType: 'text/tab-separated-values',
    compressionType: 'text',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: 'Tab-delimited tabular dataset',
  },
  {
    id: 'yaml',
    name: 'YAML Ain\'t Markup Language',
    label: 'YAML',
    category: 'data',
    extensions: ['yaml', 'yml'],
    mimeType: 'application/yaml',
    mimeAliases: ['text/yaml'],
    compressionType: 'text',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 50,
    description: 'Human-readable configuration and data serialization',
  },
  {
    id: 'xml',
    name: 'Extensible Markup Language',
    label: 'XML',
    category: 'data',
    extensions: ['xml'],
    mimeType: 'application/xml',
    mimeAliases: ['text/xml'],
    compressionType: 'text',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 60,
    description: 'Structured hierarchical markup document',
  },
  {
    id: 'toml',
    name: 'Tom\'s Obvious Minimal Language',
    label: 'TOML',
    category: 'data',
    extensions: ['toml'],
    mimeType: 'application/toml',
    compressionType: 'text',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 40,
    description: 'Clean minimal configuration file format',
  },
  {
    id: 'ini',
    name: 'INI Configuration',
    label: 'INI',
    category: 'data',
    extensions: ['ini', 'cfg', 'conf'],
    mimeType: 'text/plain',
    compressionType: 'text',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 40,
    description: 'Key-value sectioned configuration file',
  },
  {
    id: 'env',
    name: 'DotEnv Variables',
    label: 'ENV',
    category: 'data',
    extensions: ['env'],
    mimeType: 'text/plain',
    compressionType: 'text',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 20,
    description: 'Environment variable key-value configuration',
  },
  {
    id: 'sql',
    name: 'SQL Insert Script',
    label: 'SQL',
    category: 'data',
    extensions: ['sql'],
    mimeType: 'application/sql',
    compressionType: 'text',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 60,
    description: 'Relational SQL INSERT statements',
  },

  // Documents & Markup
  {
    id: 'md',
    name: 'Markdown Document',
    label: 'MD',
    category: 'document',
    extensions: ['md', 'markdown'],
    mimeType: 'text/markdown',
    compressionType: 'text',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 40,
    description: 'Lightweight formatted prose and tables',
  },
  {
    id: 'html',
    name: 'HyperText Markup Language',
    label: 'HTML',
    category: 'document',
    extensions: ['html', 'htm'],
    mimeType: 'text/html',
    compressionType: 'text',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 50,
    description: 'Web document markup',
  },
  {
    id: 'txt',
    name: 'Plain Text',
    label: 'TXT',
    category: 'document',
    extensions: ['txt', 'log'],
    mimeType: 'text/plain',
    compressionType: 'text',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 80,
    description: 'UTF-8 plain text file',
  },
  {
    id: 'pdf',
    name: 'Portable Document Format',
    label: 'PDF',
    category: 'document',
    extensions: ['pdf'],
    mimeType: 'application/pdf',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: 'Fixed-layout printable document',
  },
  {
    id: 'docx',
    name: 'Microsoft Word Document',
    label: 'DOCX',
    category: 'document',
    extensions: ['docx'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: 'Office Open XML Word document (server LibreOffice/Pandoc)',
  },
  {
    id: 'pptx',
    name: 'Microsoft PowerPoint Deck',
    label: 'PPTX',
    category: 'document',
    extensions: ['pptx'],
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: 'Office Open XML presentation (server LibreOffice)',
  },
  {
    id: 'xlsx',
    name: 'Microsoft Excel Workbook',
    label: 'XLSX',
    category: 'document',
    extensions: ['xlsx'],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: 'Office Open XML spreadsheet (server LibreOffice)',
  },
  {
    id: 'epub',
    name: 'EPUB E-Book',
    label: 'EPUB',
    category: 'ebook',
    extensions: ['epub'],
    mimeType: 'application/epub+zip',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: 'Open digital e-book package',
  },

  // Archives
  {
    id: 'zip',
    name: 'ZIP Archive',
    label: 'ZIP',
    category: 'archive',
    extensions: ['zip'],
    mimeType: 'application/zip',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: 'Standard DEFLATE/STORE compressed archive',
  },
  {
    id: 'gz',
    name: 'GZIP Compressed File',
    label: 'GZ',
    category: 'archive',
    extensions: ['gz', 'gzip'],
    mimeType: 'application/gzip',
    compressionType: 'lossless',
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 200,
    description: 'Browser-native CompressionStream GZIP archive',
  },
  {
    id: '7z',
    name: '7-Zip Archive',
    label: '7Z',
    category: 'archive',
    extensions: ['7z'],
    mimeType: 'application/x-7z-compressed',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: 'LZMA2 high-compression archive (server 7z engine)',
  },
  {
    id: 'rar',
    name: 'RAR Archive',
    label: 'RAR',
    category: 'archive',
    extensions: ['rar'],
    mimeType: 'application/vnd.rar',
    compressionType: 'container',
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: 'Proprietary Roshal Archive (server extraction)',
  },
];

export const CLIENT_MAGIC_SIGNATURES: readonly MagicSignature[] = [
  {
    formatId: 'png',
    offset: 0,
    hexBytes: ['89', '50', '4E', '47', '0D', '0A', '1A', '0A'],
    priority: 100,
    description: 'PNG image signature',
  },
  {
    formatId: 'jpg',
    offset: 0,
    hexBytes: ['FF', 'D8', 'FF'],
    priority: 100,
    description: 'JPEG SOI marker',
  },
  {
    formatId: 'gif',
    offset: 0,
    hexBytes: ['47', '49', '46', '38'],
    priority: 100,
    description: 'GIF87a / GIF89a header',
  },
  {
    formatId: 'webp',
    offset: 0,
    hexBytes: ['52', '49', '46', '46'],
    asciiMarker: { offset: 8, value: 'WEBP' },
    priority: 110,
    description: 'RIFF WEBP container',
  },
  {
    formatId: 'bmp',
    offset: 0,
    hexBytes: ['42', '4D'],
    priority: 80,
    description: 'BMP BM header',
  },
  {
    formatId: 'ico',
    offset: 0,
    hexBytes: ['00', '00', '01', '00'],
    priority: 95,
    description: 'Windows ICO icon header',
  },
  {
    formatId: 'tiff',
    offset: 0,
    hexBytes: ['49', '49', '2A', '00'],
    priority: 95,
    description: 'TIFF little-endian header',
  },
  {
    formatId: 'tiff',
    offset: 0,
    hexBytes: ['4D', '4D', '00', '2A'],
    priority: 95,
    description: 'TIFF big-endian header',
  },
  {
    formatId: 'avif',
    offset: 4,
    hexBytes: ['66', '74', '79', '70', '61', '76', '69', '66'],
    priority: 115,
    description: 'ISO BMFF AVIF ftypavif box',
  },
  {
    formatId: 'heic',
    offset: 4,
    hexBytes: ['66', '74', '79', '70', '68', '65', '69', '63'],
    priority: 115,
    description: 'ISO BMFF HEIC ftypheic box',
  },
  {
    formatId: 'mov',
    offset: 4,
    hexBytes: ['66', '74', '79', '70', '71', '74', '20', '20'],
    priority: 115,
    description: 'QuickTime ftypqt box',
  },
  {
    formatId: 'mp4',
    offset: 4,
    hexBytes: ['66', '74', '79', '70'],
    priority: 90,
    description: 'ISO BMFF MP4 ftyp box',
  },
  {
    formatId: 'webm',
    offset: 0,
    hexBytes: ['1A', '45', 'DF', 'A3'],
    priority: 90,
    description: 'EBML WebM/Matroska header',
  },
  {
    formatId: 'wav',
    offset: 0,
    hexBytes: ['52', '49', '46', '46'],
    asciiMarker: { offset: 8, value: 'WAVE' },
    priority: 110,
    description: 'RIFF WAVE audio header',
  },
  {
    formatId: 'mp3',
    offset: 0,
    hexBytes: ['49', '44', '33'],
    priority: 100,
    description: 'MP3 ID3v2 tag header',
  },
  {
    formatId: 'mp3',
    offset: 0,
    hexBytes: ['FF', 'FB'],
    priority: 85,
    description: 'MP3 MPEG-1 Layer 3 frame sync',
  },
  {
    formatId: 'ogg',
    offset: 0,
    hexBytes: ['4F', '67', '67', '53'],
    priority: 100,
    description: 'OggS container header',
  },
  {
    formatId: 'flac',
    offset: 0,
    hexBytes: ['66', '4C', '61', '43'],
    priority: 100,
    description: 'fLaC lossless audio header',
  },
  {
    formatId: 'pdf',
    offset: 0,
    hexBytes: ['25', '50', '44', '46', '2D'],
    priority: 105,
    description: '%PDF- document header',
  },
  {
    formatId: 'gz',
    offset: 0,
    hexBytes: ['1F', '8B', '08'],
    priority: 100,
    description: 'GZIP deflate header',
  },
  {
    formatId: '7z',
    offset: 0,
    hexBytes: ['37', '7A', 'BC', 'AF', '27', '1C'],
    priority: 105,
    description: '7-Zip archive header',
  },
  {
    formatId: 'rar',
    offset: 0,
    hexBytes: ['52', '61', '72', '21', '1A', '07'],
    priority: 105,
    description: 'RAR archive header',
  },
  {
    formatId: 'zip',
    offset: 0,
    hexBytes: ['50', '4B', '03', '04'],
    priority: 50,
    description: 'PKZIP local file header (also used by DOCX/XLSX/PPTX/EPUB)',
  },
];

const TEXT_COMPATIBLE_IDS = new Set([
  'json', 'csv', 'tsv', 'yaml', 'xml', 'toml', 'ini', 'env', 'sql', 'md', 'html', 'txt', 'svg',
]);

const ZIP_CONTAINER_EXTENSION_IDS = new Set(['zip', 'docx', 'xlsx', 'pptx', 'epub']);

export function getFormatById(formatId: string): FormatDefinition | undefined {
  const normalized = formatId.trim().toLowerCase();
  return CLIENT_FORMATS.find(
    (f) => f.id === normalized || f.extensions.includes(normalized),
  );
}

export function getExtensionFormatId(filename: string): string | null {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 2) return null;
  const ext = parts[parts.length - 1];
  const found = CLIENT_FORMATS.find((f) => f.extensions.includes(ext));
  return found ? found.id : ext || null;
}

function matchesSignature(bytes: Uint8Array, sig: MagicSignature): boolean {
  if (bytes.length < sig.offset + sig.hexBytes.length) return false;
  for (let i = 0; i < sig.hexBytes.length; i++) {
    const expected = Number.parseInt(sig.hexBytes[i], 16);
    if (bytes[sig.offset + i] !== expected) return false;
  }
  if (sig.asciiMarker) {
    const { offset, value } = sig.asciiMarker;
    if (bytes.length < offset + value.length) return false;
    for (let i = 0; i < value.length; i++) {
      if (bytes[offset + i] !== value.charCodeAt(i)) return false;
    }
  }
  return true;
}

function detectTextFormatFromHeader(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return null;
  // Check if mostly printable UTF-8 text (excluding BOM)
  let nonTextCount = 0;
  const sampleLen = Math.min(bytes.length, 256);
  for (let i = 0; i < sampleLen; i++) {
    const b = bytes[i];
    if (b === 0) return null; // binary NUL byte
    if (b < 9 || (b > 13 && b < 32)) nonTextCount++;
  }
  if (nonTextCount > sampleLen * 0.08) return null;

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, sampleLen)).trim();
  if (!text) return null;
  if (text.startsWith('<svg') || text.includes('<svg ')) return 'svg';
  if (text.startsWith('<!DOCTYPE html') || text.startsWith('<html')) return 'html';
  if (text.startsWith('<?xml')) return 'xml';
  if ((text.startsWith('{') || text.startsWith('[')) && /["':]/.test(text)) return 'json';
  return null;
}

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  if (bytes.length < needle.length) return false;
  const text = new TextDecoder('latin1').decode(bytes);
  return text.includes(needle);
}

export function inspectFileMagicBytes(
  headerBytes: Uint8Array | undefined,
  filename: string,
): MagicDetectionResult {
  const extensionFormatId = getExtensionFormatId(filename);
  if (!headerBytes || headerBytes.length === 0) {
    return {
      detectedFormatId: extensionFormatId,
      confidence: extensionFormatId ? 'low' : 'none',
      extensionFormatId,
      isSpoofedOrMismatched: false,
    };
  }

  const matched = CLIENT_MAGIC_SIGNATURES
    .filter((sig) => matchesSignature(headerBytes, sig))
    .sort((a, b) => b.priority - a.priority);

  if (matched.length > 0) {
    const best = matched[0];
    let resolvedFormat = best.formatId;

    // Refine PKZIP into DOCX/PPTX/XLSX/EPUB when OOXML/EPUB entries appear in header
    if (resolvedFormat === 'zip') {
      if (containsAscii(headerBytes, 'mimetypeapplication/epub+zip')) {
        resolvedFormat = 'epub';
      } else if (containsAscii(headerBytes, 'word/')) {
        resolvedFormat = 'docx';
      } else if (containsAscii(headerBytes, 'xl/')) {
        resolvedFormat = 'xlsx';
      } else if (containsAscii(headerBytes, 'ppt/')) {
        resolvedFormat = 'pptx';
      } else if (extensionFormatId && ZIP_CONTAINER_EXTENSION_IDS.has(extensionFormatId)) {
        // Trust ZIP-based extension if header only shows [Content_Types].xml
        resolvedFormat = extensionFormatId;
      }
    }

    // Refine EBML into mkv if extension says mkv
    if (resolvedFormat === 'webm' && extensionFormatId === 'mkv') {
      resolvedFormat = 'mkv';
    }

    // Refine ISO ftyp generic mp4 into mov/avif/heic if matched by extension
    if (resolvedFormat === 'mp4' && (extensionFormatId === 'mov' || extensionFormatId === 'm4a')) {
      resolvedFormat = extensionFormatId === 'm4a' ? 'aac' : 'mov';
    }

    const isSameFamily =
      resolvedFormat === extensionFormatId ||
      (ZIP_CONTAINER_EXTENSION_IDS.has(resolvedFormat) && extensionFormatId !== null && ZIP_CONTAINER_EXTENSION_IDS.has(extensionFormatId));

    const isMismatch = Boolean(extensionFormatId && !isSameFamily);

    return {
      detectedFormatId: resolvedFormat,
      confidence: 'high',
      matchedSignature: best,
      extensionFormatId,
      isSpoofedOrMismatched: isMismatch,
      warningMessage: isMismatch
        ? `File extension ".${extensionFormatId}" does not match binary signature (${resolvedFormat.toUpperCase()}). Routing using verified magic bytes.`
        : undefined,
    };
  }

  const textGuess = detectTextFormatFromHeader(headerBytes);
  if (textGuess) {
    const isTextExtension = extensionFormatId !== null && TEXT_COMPATIBLE_IDS.has(extensionFormatId);
    const resolved = isTextExtension ? extensionFormatId : textGuess;
    const isMismatch = Boolean(extensionFormatId && !isTextExtension);
    return {
      detectedFormatId: resolved,
      confidence: isTextExtension ? 'medium' : 'low',
      extensionFormatId,
      isSpoofedOrMismatched: isMismatch,
      warningMessage: isMismatch
        ? `File has ".${extensionFormatId}" extension, but header looks like plain-text ${textGuess.toUpperCase()}.`
        : undefined,
    };
  }

  return {
    detectedFormatId: extensionFormatId,
    confidence: extensionFormatId ? 'low' : 'none',
    extensionFormatId,
    isSpoofedOrMismatched: false,
  };
}

const IMAGE_NATIVE_TARGETS = ['png', 'jpg', 'webp', 'avif', 'bmp', 'ico'] as const;
const DATA_PURE_FORMATS = ['json', 'csv', 'tsv', 'yaml', 'xml', 'toml', 'ini', 'env', 'sql'] as const;
const MARKUP_PURE_FORMATS = ['md', 'html', 'txt'] as const;

function buildDefaultRouteRules(): ConversionRouteRule[] {
  const rules: ConversionRouteRule[] = [];

  // 1. Tier 1 Native Image Matrix (png, jpg, webp, avif, bmp, ico, svg, gif -> png/jpg/webp/avif/bmp/ico)
  for (const src of ['png', 'jpg', 'webp', 'avif', 'bmp', 'ico', 'svg', 'gif']) {
    for (const tgt of IMAGE_NATIVE_TARGETS) {
      if (src === tgt) continue;
      const isAvifTarget = tgt === 'avif';
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: isAvifTarget
          ? ['LOCAL_NATIVE', 'LOCAL_WASM', 'SERVER_FALLBACK']
          : ['LOCAL_NATIVE', 'SERVER_FALLBACK'],
        enginesByTier: isAvifTarget
          ? { LOCAL_NATIVE: 'canvas-2d', LOCAL_WASM: 'wasm-imagemagick', SERVER_FALLBACK: 'server-sharp-magick' }
          : { LOCAL_NATIVE: 'canvas-2d', SERVER_FALLBACK: 'server-sharp-magick' },
        memoryMultiplier: 5.5,
        maxLocalFileSizeMB: 120,
        serverLane: 'fast',
        notes: 'Hardware-accelerated OffscreenCanvas pipeline with automatic EXIF stripping',
      });
    }
    // Images -> PDF via pure JS client PDF generator
    rules.push({
      sourceFormat: src,
      targetFormat: 'pdf',
      supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
      enginesByTier: { LOCAL_PURE_JS: 'pure-pdf-ops', SERVER_FALLBACK: 'server-sharp-magick' },
      memoryMultiplier: 4.5,
      maxLocalFileSizeMB: 80,
      serverLane: 'fast',
      notes: 'Pure client-side PDF document embedding with A4/Letter scaling',
    });
  }

  // Advanced image formats needing WASM or Server (tiff, heic -> web formats)
  for (const src of ['tiff', 'heic']) {
    for (const tgt of ['png', 'jpg', 'webp', 'pdf']) {
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_WASM', 'SERVER_FALLBACK'],
        enginesByTier: { LOCAL_WASM: 'wasm-imagemagick', SERVER_FALLBACK: 'server-sharp-magick' },
        memoryMultiplier: 6.0,
        maxLocalFileSizeMB: 80,
        serverLane: 'fast',
        notes: 'Requires ImageMagick WASM or server Sharp/ImageMagick toolchain',
      });
    }
  }

  // 2. Tier 1 Native Audio -> WAV + Tier 3/4 Audio Transcoding
  for (const src of ['wav', 'mp3', 'ogg', 'flac', 'aac', 'opus', 'webm']) {
    rules.push({
      sourceFormat: src,
      targetFormat: 'wav',
      supportedTiers: ['LOCAL_NATIVE', 'LOCAL_WASM', 'SERVER_FALLBACK'],
      enginesByTier: {
        LOCAL_NATIVE: 'web-audio-pcm',
        LOCAL_WASM: 'wasm-ffmpeg',
        SERVER_FALLBACK: 'server-ffmpeg',
      },
      memoryMultiplier: 6.0,
      maxLocalFileSizeMB: 180,
      serverLane: 'media',
      notes: 'Browser OfflineAudioContext decoding + PCM WAV encoding with optional resampling & normalization',
    });

    for (const tgt of ['mp3', 'ogg', 'flac', 'aac', 'opus']) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_WASM', 'SERVER_FALLBACK'],
        enginesByTier: { LOCAL_WASM: 'wasm-ffmpeg', SERVER_FALLBACK: 'server-ffmpeg' },
        memoryMultiplier: 4.5,
        maxLocalFileSizeMB: 120,
        requiresCrossOriginIsolation: true,
        serverLane: 'media',
        notes: 'FFmpeg WASM transcoding with automatic server FFmpeg fallback',
      });
    }
  }

  // 3. Tier 3/4 Video Transcoding
  for (const src of ['mp4', 'webm', 'mov', 'mkv']) {
    for (const tgt of ['mp4', 'webm', 'mov', 'mkv', 'gif', 'mp3', 'wav']) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_WASM', 'SERVER_FALLBACK'],
        enginesByTier: { LOCAL_WASM: 'wasm-ffmpeg', SERVER_FALLBACK: 'server-ffmpeg' },
        memoryMultiplier: 6.5,
        maxLocalFileSizeMB: 120,
        requiresCrossOriginIsolation: true,
        serverLane: 'media',
        notes: 'Multi-threaded FFmpeg WASM (<120MB with COOP/COEP) or native server FFmpeg',
      });
    }
  }

  // 4. Tier 2 Pure JS Tabular & Structured Data
  for (const src of DATA_PURE_FORMATS) {
    for (const tgt of DATA_PURE_FORMATS) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
        enginesByTier: { LOCAL_PURE_JS: 'pure-data-tabular', SERVER_FALLBACK: 'server-data-engine' },
        memoryMultiplier: 3.5,
        maxLocalFileSizeMB: 80,
        serverLane: 'fast',
        notes: 'Deterministic in-browser structured data parser & serializer',
      });
    }
    for (const tgt of ['md', 'html', 'txt', 'pdf']) {
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_PURE_JS: tgt === 'pdf' ? 'pure-pdf-ops' : 'pure-markup-doc',
          SERVER_FALLBACK: 'server-data-engine',
        },
        memoryMultiplier: 3.5,
        maxLocalFileSizeMB: 60,
        serverLane: 'fast',
        notes: 'Transforms tabular/structured data into readable reports or PDF tables',
      });
    }
  }

  // 5. Tier 2 Pure JS Markup & Document -> HTML/MD/TXT/PDF
  for (const src of MARKUP_PURE_FORMATS) {
    for (const tgt of [...MARKUP_PURE_FORMATS, 'pdf']) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_PURE_JS: tgt === 'pdf' ? 'pure-pdf-ops' : 'pure-markup-doc',
          SERVER_FALLBACK: 'server-pandoc',
        },
        memoryMultiplier: 3.0,
        maxLocalFileSizeMB: 50,
        serverLane: 'document',
        notes: 'Zero-upload markup transformation and client PDF typesetting',
      });
    }
  }

  // 6. Tier 4 Server-Only Office & Publishing Documents
  for (const src of ['docx', 'pptx', 'xlsx', 'epub']) {
    const targets = src === 'xlsx' ? ['pdf', 'csv', 'html'] : ['pdf', 'html', 'txt', 'md'];
    for (const tgt of targets) {
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ['SERVER_FALLBACK'],
        enginesByTier: {
          SERVER_FALLBACK: src === 'epub' ? 'server-pandoc' : 'server-libreoffice',
        },
        memoryMultiplier: 2.0,
        maxLocalFileSizeMB: 0,
        serverLane: 'document',
        notes: `${src.toUpperCase()} layout rendering requires server LibreOffice/Pandoc engine`,
      });
    }
  }

  // 7. Archives & Compression (Tier 1 CompressionStream GZ, Tier 2 Pure ZIP, Tier 4 7z/RAR)
  for (const src of CLIENT_FORMATS.map((f) => f.id)) {
    if (src !== 'zip' && src !== 'gz' && src !== '7z' && src !== 'rar') {
      rules.push({
        sourceFormat: src,
        targetFormat: 'zip',
        supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
        enginesByTier: { LOCAL_PURE_JS: 'pure-archive-zip', SERVER_FALLBACK: 'server-archive-7z' },
        memoryMultiplier: 2.5,
        maxLocalFileSizeMB: 150,
        serverLane: 'fast',
        notes: 'In-browser ZIP packaging using CompressionStream deflate-raw',
      });
      rules.push({
        sourceFormat: src,
        targetFormat: 'gz',
        supportedTiers: ['LOCAL_NATIVE', 'LOCAL_PURE_JS', 'SERVER_FALLBACK'],
        enginesByTier: {
          LOCAL_NATIVE: 'compression-stream',
          LOCAL_PURE_JS: 'pure-archive-zip',
          SERVER_FALLBACK: 'server-archive-7z',
        },
        memoryMultiplier: 2.2,
        maxLocalFileSizeMB: 200,
        serverLane: 'fast',
        notes: 'Browser native GZIP CompressionStream',
      });
    }
  }

  rules.push(
    {
      sourceFormat: 'zip',
      targetFormat: 'gz',
      supportedTiers: ['LOCAL_NATIVE', 'LOCAL_PURE_JS', 'SERVER_FALLBACK'],
      enginesByTier: { LOCAL_NATIVE: 'compression-stream', LOCAL_PURE_JS: 'pure-archive-zip', SERVER_FALLBACK: 'server-archive-7z' },
      memoryMultiplier: 2.5,
      maxLocalFileSizeMB: 150,
      serverLane: 'fast',
    },
    {
      sourceFormat: 'gz',
      targetFormat: 'zip',
      supportedTiers: ['LOCAL_PURE_JS', 'SERVER_FALLBACK'],
      enginesByTier: { LOCAL_PURE_JS: 'pure-archive-zip', SERVER_FALLBACK: 'server-archive-7z' },
      memoryMultiplier: 3.0,
      maxLocalFileSizeMB: 150,
      serverLane: 'fast',
    },
    {
      sourceFormat: '7z',
      targetFormat: 'zip',
      supportedTiers: ['SERVER_FALLBACK'],
      enginesByTier: { SERVER_FALLBACK: 'server-archive-7z' },
      memoryMultiplier: 2.0,
      maxLocalFileSizeMB: 0,
      serverLane: 'fast',
      notes: '7z LZMA2 unpacking requires server 7-Zip engine',
    },
    {
      sourceFormat: 'rar',
      targetFormat: 'zip',
      supportedTiers: ['SERVER_FALLBACK'],
      enginesByTier: { SERVER_FALLBACK: 'server-archive-7z' },
      memoryMultiplier: 2.0,
      maxLocalFileSizeMB: 0,
      serverLane: 'fast',
      notes: 'RAR archive extraction requires server archive engine',
    },
  );

  return rules;
}

export const CLIENT_ROUTE_RULES: readonly ConversionRouteRule[] = buildDefaultRouteRules();

export function findConversionRule(
  sourceFormat: string,
  targetFormat: string,
): ConversionRouteRule | undefined {
  const src = sourceFormat.trim().toLowerCase();
  const tgt = targetFormat.trim().toLowerCase();
  return CLIENT_ROUTE_RULES.find((r) => r.sourceFormat === src && r.targetFormat === tgt);
}

export function getCompatibleTargets(sourceFormat: string): FormatDefinition[] {
  const src = sourceFormat.trim().toLowerCase();
  const targetIds = new Set(
    CLIENT_ROUTE_RULES.filter((r) => r.sourceFormat === src).map((r) => r.targetFormat),
  );
  const results = CLIENT_FORMATS.filter((f) => targetIds.has(f.id));
  if (results.length === 0) {
    return CLIENT_FORMATS.filter((f) => f.id === 'zip' || f.id === 'gz');
  }
  return results;
}

export function getDefaultTargetForSource(sourceFormat: string): string {
  const src = sourceFormat.trim().toLowerCase();
  const defaults: Record<string, string> = {
    png: 'webp',
    jpg: 'webp',
    webp: 'png',
    avif: 'png',
    bmp: 'png',
    ico: 'png',
    svg: 'png',
    gif: 'png',
    tiff: 'png',
    heic: 'jpg',
    wav: 'wav',
    mp3: 'wav',
    ogg: 'wav',
    flac: 'wav',
    aac: 'wav',
    opus: 'wav',
    mp4: 'webm',
    webm: 'mp4',
    mov: 'mp4',
    mkv: 'mp4',
    csv: 'json',
    tsv: 'csv',
    json: 'yaml',
    yaml: 'json',
    xml: 'json',
    toml: 'json',
    ini: 'json',
    env: 'json',
    sql: 'json',
    md: 'pdf',
    html: 'md',
    txt: 'pdf',
    docx: 'pdf',
    pptx: 'pdf',
    xlsx: 'pdf',
    epub: 'pdf',
    '7z': 'zip',
    rar: 'zip',
    zip: 'gz',
    gz: 'zip',
  };
  return defaults[src] ?? getCompatibleTargets(src)[0]?.id ?? 'zip';
}

export const CLIENT_PRESETS: readonly ConversionPreset[] = [
  {
    id: 'img-web-optimized',
    name: 'Web Optimized (WebP · 82%)',
    category: 'image',
    targetFormat: 'webp',
    description: 'High compression ratio with EXIF stripped for fast web delivery',
    options: { quality: 82, stripMetadata: true, fit: 'inside' },
  },
  {
    id: 'img-strip-exif',
    name: 'Social & Retina PNG',
    category: 'image',
    targetFormat: 'png',
    description: 'High-quality lossy/lossless hybrid for crisp displays',
    options: { quality: 90, stripMetadata: true },
  },
  {
    id: 'img-favicon-ico',
    name: 'Favicon 64x64 ICO',
    category: 'image',
    targetFormat: 'ico',
    description: 'Resizes cleanly to 64x64 square icon',
    options: { width: 64, height: 64, fit: 'contain', stripMetadata: true },
  },
  {
    id: 'audio-studio-wav',
    name: 'Studio Master WAV (48 kHz)',
    category: 'audio',
    targetFormat: 'wav',
    description: 'Lossless 48kHz stereo PCM with -1 dB peak normalization',
    options: { sampleRate: 48000, channels: 2, normalizeAudio: true },
  },
  {
    id: 'audio-voice-mono',
    name: 'Podcast / Voice Mono (16 kHz)',
    category: 'audio',
    targetFormat: 'wav',
    description: 'Downmixes to mono 16kHz normalized WAV for speech/AI transcription',
    options: { sampleRate: 16000, channels: 1, normalizeAudio: true },
  },
  {
    id: 'data-pretty-json',
    name: 'Clean JSON (2-Space)',
    category: 'data',
    targetFormat: 'json',
    description: 'Formats structured data with clean 2-space indentation',
    options: { indentSpaces: 2 },
  },
  {
    id: 'data-sql-seed',
    name: 'SQL Database Seed',
    category: 'data',
    targetFormat: 'sql',
    description: 'Converts tabular dataset into portable SQL INSERT statements',
    options: { sqlTableName: 'records' },
  },
  {
    id: 'doc-a4-pdf',
    name: 'Print-Ready PDF (A4)',
    category: 'document',
    targetFormat: 'pdf',
    description: 'Typesets document or table onto clean A4 pages locally in browser',
    options: { pageSize: 'A4' },
  },
  {
    id: 'archive-zip-bundle',
    name: 'Compressed ZIP Archive',
    category: 'archive',
    targetFormat: 'zip',
    description: 'Packages file into standard DEFLATE ZIP archive locally',
    options: {},
  },
];

export function getPresetsForCategory(category: FormatCategory): ConversionPreset[] {
  return CLIENT_PRESETS.filter((p) => p.category === category);
}
