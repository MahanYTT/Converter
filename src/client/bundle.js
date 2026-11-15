// src/client/router/format-catalog.ts
var CLIENT_FORMATS = [
  // Images
  {
    id: "png",
    name: "Portable Network Graphics",
    label: "PNG",
    category: "image",
    extensions: ["png"],
    mimeType: "image/png",
    compressionType: "lossless",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: "Lossless raster image with alpha transparency"
  },
  {
    id: "jpg",
    name: "JPEG Image",
    label: "JPG",
    category: "image",
    extensions: ["jpg", "jpeg", "jpe"],
    mimeType: "image/jpeg",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Widely supported lossy photographic raster format"
  },
  {
    id: "webp",
    name: "WebP Image",
    label: "WEBP",
    category: "image",
    extensions: ["webp"],
    mimeType: "image/webp",
    compressionType: "both",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: "Modern web image format with lossy/lossless compression and alpha"
  },
  {
    id: "avif",
    name: "AV1 Image File Format",
    label: "AVIF",
    category: "image",
    extensions: ["avif"],
    mimeType: "image/avif",
    compressionType: "both",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: "Next-generation high-efficiency AV1 image format"
  },
  {
    id: "bmp",
    name: "Windows Bitmap",
    label: "BMP",
    category: "image",
    extensions: ["bmp"],
    mimeType: "image/bmp",
    compressionType: "uncompressed",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: "Uncompressed device-independent raster bitmap"
  },
  {
    id: "ico",
    name: "Windows Icon",
    label: "ICO",
    category: "image",
    extensions: ["ico"],
    mimeType: "image/x-icon",
    mimeAliases: ["image/vnd.microsoft.icon"],
    compressionType: "lossless",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 20,
    description: "Favicon and application icon container"
  },
  {
    id: "gif",
    name: "Graphics Interchange Format",
    label: "GIF",
    category: "image",
    extensions: ["gif"],
    mimeType: "image/gif",
    compressionType: "lossless",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 60,
    description: "Indexed color raster and animated image format"
  },
  {
    id: "svg",
    name: "Scalable Vector Graphics",
    label: "SVG",
    category: "vector",
    extensions: ["svg"],
    mimeType: "image/svg+xml",
    compressionType: "text",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 25,
    description: "XML-based resolution-independent vector graphics"
  },
  {
    id: "tiff",
    name: "Tagged Image File Format",
    label: "TIFF",
    category: "image",
    extensions: ["tif", "tiff"],
    mimeType: "image/tiff",
    compressionType: "both",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: "Archival and print-grade raster image format"
  },
  {
    id: "heic",
    name: "High Efficiency Image Container",
    label: "HEIC",
    category: "image",
    extensions: ["heic", "heif"],
    mimeType: "image/heic",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: "Apple HEVC-compressed photo container"
  },
  // Audio
  {
    id: "wav",
    name: "Waveform Audio",
    label: "WAV",
    category: "audio",
    extensions: ["wav", "wave"],
    mimeType: "audio/wav",
    mimeAliases: ["audio/x-wav"],
    compressionType: "uncompressed",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 250,
    description: "Uncompressed lossless PCM waveform audio"
  },
  {
    id: "mp3",
    name: "MPEG Layer 3 Audio",
    label: "MP3",
    category: "audio",
    extensions: ["mp3"],
    mimeType: "audio/mpeg",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Universal lossy compressed audio stream"
  },
  {
    id: "ogg",
    name: "Ogg Vorbis",
    label: "OGG",
    category: "audio",
    extensions: ["ogg", "oga"],
    mimeType: "audio/ogg",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Open-source lossy audio container"
  },
  {
    id: "flac",
    name: "Free Lossless Audio Codec",
    label: "FLAC",
    category: "audio",
    extensions: ["flac"],
    mimeType: "audio/flac",
    compressionType: "lossless",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 200,
    description: "Bit-exact lossless compressed audio"
  },
  {
    id: "aac",
    name: "Advanced Audio Coding",
    label: "AAC",
    category: "audio",
    extensions: ["aac", "m4a"],
    mimeType: "audio/aac",
    mimeAliases: ["audio/mp4"],
    compressionType: "lossy",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Modern perceptual audio codec"
  },
  {
    id: "opus",
    name: "Opus Interactive Audio",
    label: "OPUS",
    category: "audio",
    extensions: ["opus"],
    mimeType: "audio/opus",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Low-latency speech and music codec"
  },
  // Video
  {
    id: "mp4",
    name: "MPEG-4 Video",
    label: "MP4",
    category: "video",
    extensions: ["mp4", "m4v"],
    mimeType: "video/mp4",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Universal H.264/H.265 multimedia container"
  },
  {
    id: "webm",
    name: "WebM Video",
    label: "WEBM",
    category: "video",
    extensions: ["webm"],
    mimeType: "video/webm",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: true, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Open web-native VP8/VP9/AV1 video container"
  },
  {
    id: "mov",
    name: "QuickTime Movie",
    label: "MOV",
    category: "video",
    extensions: ["mov"],
    mimeType: "video/quicktime",
    compressionType: "lossy",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: "Apple QuickTime multimedia container"
  },
  {
    id: "mkv",
    name: "Matroska Video",
    label: "MKV",
    category: "video",
    extensions: ["mkv"],
    mimeType: "video/x-matroska",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 120,
    description: "Extensible open-standard multimedia container"
  },
  // Data & Tabular
  {
    id: "json",
    name: "JSON Data",
    label: "JSON",
    category: "data",
    extensions: ["json"],
    mimeType: "application/json",
    compressionType: "text",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: "JavaScript Object Notation structured data"
  },
  {
    id: "csv",
    name: "Comma-Separated Values",
    label: "CSV",
    category: "data",
    extensions: ["csv"],
    mimeType: "text/csv",
    compressionType: "text",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: "Tabular plain-text spreadsheet format"
  },
  {
    id: "tsv",
    name: "Tab-Separated Values",
    label: "TSV",
    category: "data",
    extensions: ["tsv"],
    mimeType: "text/tab-separated-values",
    compressionType: "text",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 100,
    description: "Tab-delimited tabular dataset"
  },
  {
    id: "yaml",
    name: "YAML Ain't Markup Language",
    label: "YAML",
    category: "data",
    extensions: ["yaml", "yml"],
    mimeType: "application/yaml",
    mimeAliases: ["text/yaml"],
    compressionType: "text",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 50,
    description: "Human-readable configuration and data serialization"
  },
  {
    id: "xml",
    name: "Extensible Markup Language",
    label: "XML",
    category: "data",
    extensions: ["xml"],
    mimeType: "application/xml",
    mimeAliases: ["text/xml"],
    compressionType: "text",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 60,
    description: "Structured hierarchical markup document"
  },
  {
    id: "toml",
    name: "Tom's Obvious Minimal Language",
    label: "TOML",
    category: "data",
    extensions: ["toml"],
    mimeType: "application/toml",
    compressionType: "text",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 40,
    description: "Clean minimal configuration file format"
  },
  {
    id: "ini",
    name: "INI Configuration",
    label: "INI",
    category: "data",
    extensions: ["ini", "cfg", "conf"],
    mimeType: "text/plain",
    compressionType: "text",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 40,
    description: "Key-value sectioned configuration file"
  },
  {
    id: "env",
    name: "DotEnv Variables",
    label: "ENV",
    category: "data",
    extensions: ["env"],
    mimeType: "text/plain",
    compressionType: "text",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 20,
    description: "Environment variable key-value configuration"
  },
  {
    id: "sql",
    name: "SQL Insert Script",
    label: "SQL",
    category: "data",
    extensions: ["sql"],
    mimeType: "application/sql",
    compressionType: "text",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 60,
    description: "Relational SQL INSERT statements"
  },
  // Documents & Markup
  {
    id: "md",
    name: "Markdown Document",
    label: "MD",
    category: "document",
    extensions: ["md", "markdown"],
    mimeType: "text/markdown",
    compressionType: "text",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 40,
    description: "Lightweight formatted prose and tables"
  },
  {
    id: "html",
    name: "HyperText Markup Language",
    label: "HTML",
    category: "document",
    extensions: ["html", "htm"],
    mimeType: "text/html",
    compressionType: "text",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 50,
    description: "Web document markup"
  },
  {
    id: "txt",
    name: "Plain Text",
    label: "TXT",
    category: "document",
    extensions: ["txt", "log"],
    mimeType: "text/plain",
    compressionType: "text",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 80,
    description: "UTF-8 plain text file"
  },
  {
    id: "pdf",
    name: "Portable Document Format",
    label: "PDF",
    category: "document",
    extensions: ["pdf"],
    mimeType: "application/pdf",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 80,
    description: "Fixed-layout printable document"
  },
  {
    id: "docx",
    name: "Microsoft Word Document",
    label: "DOCX",
    category: "document",
    extensions: ["docx"],
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: "Office Open XML Word document (server LibreOffice/Pandoc)"
  },
  {
    id: "pptx",
    name: "Microsoft PowerPoint Deck",
    label: "PPTX",
    category: "document",
    extensions: ["pptx"],
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: "Office Open XML presentation (server LibreOffice)"
  },
  {
    id: "xlsx",
    name: "Microsoft Excel Workbook",
    label: "XLSX",
    category: "document",
    extensions: ["xlsx"],
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: "Office Open XML spreadsheet (server LibreOffice)"
  },
  {
    id: "epub",
    name: "EPUB E-Book",
    label: "EPUB",
    category: "ebook",
    extensions: ["epub"],
    mimeType: "application/epub+zip",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: "Open digital e-book package"
  },
  // Archives
  {
    id: "zip",
    name: "ZIP Archive",
    label: "ZIP",
    category: "archive",
    extensions: ["zip"],
    mimeType: "application/zip",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 150,
    description: "Standard DEFLATE/STORE compressed archive"
  },
  {
    id: "gz",
    name: "GZIP Compressed File",
    label: "GZ",
    category: "archive",
    extensions: ["gz", "gzip"],
    mimeType: "application/gzip",
    compressionType: "lossless",
    browserSupport: { canDecodeNative: true, canEncodeNative: true, canProcessPureJs: true, canProcessWasm: true },
    maxRecommendedLocalSizeMB: 200,
    description: "Browser-native CompressionStream GZIP archive"
  },
  {
    id: "7z",
    name: "7-Zip Archive",
    label: "7Z",
    category: "archive",
    extensions: ["7z"],
    mimeType: "application/x-7z-compressed",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: "LZMA2 high-compression archive (server 7z engine)"
  },
  {
    id: "rar",
    name: "RAR Archive",
    label: "RAR",
    category: "archive",
    extensions: ["rar"],
    mimeType: "application/vnd.rar",
    compressionType: "container",
    browserSupport: { canDecodeNative: false, canEncodeNative: false, canProcessPureJs: false, canProcessWasm: false },
    maxRecommendedLocalSizeMB: 0,
    description: "Proprietary Roshal Archive (server extraction)"
  }
];
var CLIENT_MAGIC_SIGNATURES = [
  {
    formatId: "png",
    offset: 0,
    hexBytes: ["89", "50", "4E", "47", "0D", "0A", "1A", "0A"],
    priority: 100,
    description: "PNG image signature"
  },
  {
    formatId: "jpg",
    offset: 0,
    hexBytes: ["FF", "D8", "FF"],
    priority: 100,
    description: "JPEG SOI marker"
  },
  {
    formatId: "gif",
    offset: 0,
    hexBytes: ["47", "49", "46", "38"],
    priority: 100,
    description: "GIF87a / GIF89a header"
  },
  {
    formatId: "webp",
    offset: 0,
    hexBytes: ["52", "49", "46", "46"],
    asciiMarker: { offset: 8, value: "WEBP" },
    priority: 110,
    description: "RIFF WEBP container"
  },
  {
    formatId: "bmp",
    offset: 0,
    hexBytes: ["42", "4D"],
    priority: 80,
    description: "BMP BM header"
  },
  {
    formatId: "ico",
    offset: 0,
    hexBytes: ["00", "00", "01", "00"],
    priority: 95,
    description: "Windows ICO icon header"
  },
  {
    formatId: "tiff",
    offset: 0,
    hexBytes: ["49", "49", "2A", "00"],
    priority: 95,
    description: "TIFF little-endian header"
  },
  {
    formatId: "tiff",
    offset: 0,
    hexBytes: ["4D", "4D", "00", "2A"],
    priority: 95,
    description: "TIFF big-endian header"
  },
  {
    formatId: "avif",
    offset: 4,
    hexBytes: ["66", "74", "79", "70", "61", "76", "69", "66"],
    priority: 115,
    description: "ISO BMFF AVIF ftypavif box"
  },
  {
    formatId: "heic",
    offset: 4,
    hexBytes: ["66", "74", "79", "70", "68", "65", "69", "63"],
    priority: 115,
    description: "ISO BMFF HEIC ftypheic box"
  },
  {
    formatId: "mov",
    offset: 4,
    hexBytes: ["66", "74", "79", "70", "71", "74", "20", "20"],
    priority: 115,
    description: "QuickTime ftypqt box"
  },
  {
    formatId: "mp4",
    offset: 4,
    hexBytes: ["66", "74", "79", "70"],
    priority: 90,
    description: "ISO BMFF MP4 ftyp box"
  },
  {
    formatId: "webm",
    offset: 0,
    hexBytes: ["1A", "45", "DF", "A3"],
    priority: 90,
    description: "EBML WebM/Matroska header"
  },
  {
    formatId: "wav",
    offset: 0,
    hexBytes: ["52", "49", "46", "46"],
    asciiMarker: { offset: 8, value: "WAVE" },
    priority: 110,
    description: "RIFF WAVE audio header"
  },
  {
    formatId: "mp3",
    offset: 0,
    hexBytes: ["49", "44", "33"],
    priority: 100,
    description: "MP3 ID3v2 tag header"
  },
  {
    formatId: "mp3",
    offset: 0,
    hexBytes: ["FF", "FB"],
    priority: 85,
    description: "MP3 MPEG-1 Layer 3 frame sync"
  },
  {
    formatId: "ogg",
    offset: 0,
    hexBytes: ["4F", "67", "67", "53"],
    priority: 100,
    description: "OggS container header"
  },
  {
    formatId: "flac",
    offset: 0,
    hexBytes: ["66", "4C", "61", "43"],
    priority: 100,
    description: "fLaC lossless audio header"
  },
  {
    formatId: "pdf",
    offset: 0,
    hexBytes: ["25", "50", "44", "46", "2D"],
    priority: 105,
    description: "%PDF- document header"
  },
  {
    formatId: "gz",
    offset: 0,
    hexBytes: ["1F", "8B", "08"],
    priority: 100,
    description: "GZIP deflate header"
  },
  {
    formatId: "7z",
    offset: 0,
    hexBytes: ["37", "7A", "BC", "AF", "27", "1C"],
    priority: 105,
    description: "7-Zip archive header"
  },
  {
    formatId: "rar",
    offset: 0,
    hexBytes: ["52", "61", "72", "21", "1A", "07"],
    priority: 105,
    description: "RAR archive header"
  },
  {
    formatId: "zip",
    offset: 0,
    hexBytes: ["50", "4B", "03", "04"],
    priority: 50,
    description: "PKZIP local file header (also used by DOCX/XLSX/PPTX/EPUB)"
  }
];
var TEXT_COMPATIBLE_IDS = /* @__PURE__ */ new Set([
  "json",
  "csv",
  "tsv",
  "yaml",
  "xml",
  "toml",
  "ini",
  "env",
  "sql",
  "md",
  "html",
  "txt",
  "svg"
]);
var ZIP_CONTAINER_EXTENSION_IDS = /* @__PURE__ */ new Set(["zip", "docx", "xlsx", "pptx", "epub"]);
function getFormatById(formatId) {
  const normalized = formatId.trim().toLowerCase();
  return CLIENT_FORMATS.find(
    (f) => f.id === normalized || f.extensions.includes(normalized)
  );
}
function getExtensionFormatId(filename) {
  const parts = filename.toLowerCase().split(".");
  if (parts.length < 2) return null;
  const ext = parts[parts.length - 1];
  const found = CLIENT_FORMATS.find((f) => f.extensions.includes(ext));
  return found ? found.id : ext || null;
}
function matchesSignature(bytes, sig) {
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
function detectTextFormatFromHeader(bytes) {
  if (bytes.length === 0) return null;
  let nonTextCount = 0;
  const sampleLen = Math.min(bytes.length, 256);
  for (let i = 0; i < sampleLen; i++) {
    const b = bytes[i];
    if (b === 0) return null;
    if (b < 9 || b > 13 && b < 32) nonTextCount++;
  }
  if (nonTextCount > sampleLen * 0.08) return null;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, sampleLen)).trim();
  if (!text) return null;
  if (text.startsWith("<svg") || text.includes("<svg ")) return "svg";
  if (text.startsWith("<!DOCTYPE html") || text.startsWith("<html")) return "html";
  if (text.startsWith("<?xml")) return "xml";
  if ((text.startsWith("{") || text.startsWith("[")) && /["':]/.test(text)) return "json";
  return null;
}
function containsAscii(bytes, needle) {
  if (bytes.length < needle.length) return false;
  const text = new TextDecoder("latin1").decode(bytes);
  return text.includes(needle);
}
function inspectFileMagicBytes(headerBytes, filename) {
  const extensionFormatId = getExtensionFormatId(filename);
  if (!headerBytes || headerBytes.length === 0) {
    return {
      detectedFormatId: extensionFormatId,
      confidence: extensionFormatId ? "low" : "none",
      extensionFormatId,
      isSpoofedOrMismatched: false
    };
  }
  const matched = CLIENT_MAGIC_SIGNATURES.filter((sig) => matchesSignature(headerBytes, sig)).sort((a, b) => b.priority - a.priority);
  if (matched.length > 0) {
    const best = matched[0];
    let resolvedFormat = best.formatId;
    if (resolvedFormat === "zip") {
      if (containsAscii(headerBytes, "mimetypeapplication/epub+zip")) {
        resolvedFormat = "epub";
      } else if (containsAscii(headerBytes, "word/")) {
        resolvedFormat = "docx";
      } else if (containsAscii(headerBytes, "xl/")) {
        resolvedFormat = "xlsx";
      } else if (containsAscii(headerBytes, "ppt/")) {
        resolvedFormat = "pptx";
      } else if (extensionFormatId && ZIP_CONTAINER_EXTENSION_IDS.has(extensionFormatId)) {
        resolvedFormat = extensionFormatId;
      }
    }
    if (resolvedFormat === "webm" && extensionFormatId === "mkv") {
      resolvedFormat = "mkv";
    }
    if (resolvedFormat === "mp4" && (extensionFormatId === "mov" || extensionFormatId === "m4a")) {
      resolvedFormat = extensionFormatId === "m4a" ? "aac" : "mov";
    }
    const isSameFamily = resolvedFormat === extensionFormatId || ZIP_CONTAINER_EXTENSION_IDS.has(resolvedFormat) && extensionFormatId !== null && ZIP_CONTAINER_EXTENSION_IDS.has(extensionFormatId);
    const isMismatch = Boolean(extensionFormatId && !isSameFamily);
    return {
      detectedFormatId: resolvedFormat,
      confidence: "high",
      matchedSignature: best,
      extensionFormatId,
      isSpoofedOrMismatched: isMismatch,
      warningMessage: isMismatch ? `File extension ".${extensionFormatId}" does not match binary signature (${resolvedFormat.toUpperCase()}). Routing using verified magic bytes.` : void 0
    };
  }
  const textGuess = detectTextFormatFromHeader(headerBytes);
  if (textGuess) {
    const isTextExtension = extensionFormatId !== null && TEXT_COMPATIBLE_IDS.has(extensionFormatId);
    const resolved = isTextExtension ? extensionFormatId : textGuess;
    const isMismatch = Boolean(extensionFormatId && !isTextExtension);
    return {
      detectedFormatId: resolved,
      confidence: isTextExtension ? "medium" : "low",
      extensionFormatId,
      isSpoofedOrMismatched: isMismatch,
      warningMessage: isMismatch ? `File has ".${extensionFormatId}" extension, but header looks like plain-text ${textGuess.toUpperCase()}.` : void 0
    };
  }
  return {
    detectedFormatId: extensionFormatId,
    confidence: extensionFormatId ? "low" : "none",
    extensionFormatId,
    isSpoofedOrMismatched: false
  };
}
var IMAGE_NATIVE_TARGETS = ["png", "jpg", "webp", "avif", "bmp", "ico"];
var DATA_PURE_FORMATS = ["json", "csv", "tsv", "yaml", "xml", "toml", "ini", "env", "sql"];
var MARKUP_PURE_FORMATS = ["md", "html", "txt"];
function buildDefaultRouteRules() {
  const rules = [];
  for (const src of ["png", "jpg", "webp", "avif", "bmp", "ico", "svg", "gif"]) {
    for (const tgt of IMAGE_NATIVE_TARGETS) {
      if (src === tgt) continue;
      const isAvifTarget = tgt === "avif";
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: isAvifTarget ? ["LOCAL_NATIVE", "LOCAL_WASM", "SERVER_FALLBACK"] : ["LOCAL_NATIVE", "SERVER_FALLBACK"],
        enginesByTier: isAvifTarget ? { LOCAL_NATIVE: "canvas-2d", LOCAL_WASM: "wasm-imagemagick", SERVER_FALLBACK: "server-sharp-magick" } : { LOCAL_NATIVE: "canvas-2d", SERVER_FALLBACK: "server-sharp-magick" },
        memoryMultiplier: 5.5,
        maxLocalFileSizeMB: 120,
        serverLane: "fast",
        notes: "Hardware-accelerated OffscreenCanvas pipeline with automatic EXIF stripping"
      });
    }
    rules.push({
      sourceFormat: src,
      targetFormat: "pdf",
      supportedTiers: ["LOCAL_PURE_JS", "SERVER_FALLBACK"],
      enginesByTier: { LOCAL_PURE_JS: "pure-pdf-ops", SERVER_FALLBACK: "server-sharp-magick" },
      memoryMultiplier: 4.5,
      maxLocalFileSizeMB: 80,
      serverLane: "fast",
      notes: "Pure client-side PDF document embedding with A4/Letter scaling"
    });
  }
  for (const src of ["tiff", "heic"]) {
    for (const tgt of ["png", "jpg", "webp", "pdf"]) {
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ["LOCAL_WASM", "SERVER_FALLBACK"],
        enginesByTier: { LOCAL_WASM: "wasm-imagemagick", SERVER_FALLBACK: "server-sharp-magick" },
        memoryMultiplier: 6,
        maxLocalFileSizeMB: 80,
        serverLane: "fast",
        notes: "Requires ImageMagick WASM or server Sharp/ImageMagick toolchain"
      });
    }
  }
  for (const src of ["wav", "mp3", "ogg", "flac", "aac", "opus", "webm"]) {
    rules.push({
      sourceFormat: src,
      targetFormat: "wav",
      supportedTiers: ["LOCAL_NATIVE", "LOCAL_WASM", "SERVER_FALLBACK"],
      enginesByTier: {
        LOCAL_NATIVE: "web-audio-pcm",
        LOCAL_WASM: "wasm-ffmpeg",
        SERVER_FALLBACK: "server-ffmpeg"
      },
      memoryMultiplier: 6,
      maxLocalFileSizeMB: 180,
      serverLane: "media",
      notes: "Browser OfflineAudioContext decoding + PCM WAV encoding with optional resampling & normalization"
    });
    for (const tgt of ["mp3", "ogg", "flac", "aac", "opus"]) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ["LOCAL_WASM", "SERVER_FALLBACK"],
        enginesByTier: { LOCAL_WASM: "wasm-ffmpeg", SERVER_FALLBACK: "server-ffmpeg" },
        memoryMultiplier: 4.5,
        maxLocalFileSizeMB: 120,
        requiresCrossOriginIsolation: true,
        serverLane: "media",
        notes: "FFmpeg WASM transcoding with automatic server FFmpeg fallback"
      });
    }
  }
  for (const src of ["mp4", "webm", "mov", "mkv"]) {
    for (const tgt of ["mp4", "webm", "mov", "mkv", "gif", "mp3", "wav"]) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ["LOCAL_WASM", "SERVER_FALLBACK"],
        enginesByTier: { LOCAL_WASM: "wasm-ffmpeg", SERVER_FALLBACK: "server-ffmpeg" },
        memoryMultiplier: 6.5,
        maxLocalFileSizeMB: 120,
        requiresCrossOriginIsolation: true,
        serverLane: "media",
        notes: "Multi-threaded FFmpeg WASM (<120MB with COOP/COEP) or native server FFmpeg"
      });
    }
  }
  for (const src of DATA_PURE_FORMATS) {
    for (const tgt of DATA_PURE_FORMATS) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ["LOCAL_PURE_JS", "SERVER_FALLBACK"],
        enginesByTier: { LOCAL_PURE_JS: "pure-data-tabular", SERVER_FALLBACK: "server-data-engine" },
        memoryMultiplier: 3.5,
        maxLocalFileSizeMB: 80,
        serverLane: "fast",
        notes: "Deterministic in-browser structured data parser & serializer"
      });
    }
    for (const tgt of ["md", "html", "txt", "pdf"]) {
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ["LOCAL_PURE_JS", "SERVER_FALLBACK"],
        enginesByTier: {
          LOCAL_PURE_JS: tgt === "pdf" ? "pure-pdf-ops" : "pure-markup-doc",
          SERVER_FALLBACK: "server-data-engine"
        },
        memoryMultiplier: 3.5,
        maxLocalFileSizeMB: 60,
        serverLane: "fast",
        notes: "Transforms tabular/structured data into readable reports or PDF tables"
      });
    }
  }
  for (const src of MARKUP_PURE_FORMATS) {
    for (const tgt of [...MARKUP_PURE_FORMATS, "pdf"]) {
      if (src === tgt) continue;
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ["LOCAL_PURE_JS", "SERVER_FALLBACK"],
        enginesByTier: {
          LOCAL_PURE_JS: tgt === "pdf" ? "pure-pdf-ops" : "pure-markup-doc",
          SERVER_FALLBACK: "server-pandoc"
        },
        memoryMultiplier: 3,
        maxLocalFileSizeMB: 50,
        serverLane: "document",
        notes: "Zero-upload markup transformation and client PDF typesetting"
      });
    }
  }
  for (const src of ["docx", "pptx", "xlsx", "epub"]) {
    const targets = src === "xlsx" ? ["pdf", "csv", "html"] : ["pdf", "html", "txt", "md"];
    for (const tgt of targets) {
      rules.push({
        sourceFormat: src,
        targetFormat: tgt,
        supportedTiers: ["SERVER_FALLBACK"],
        enginesByTier: {
          SERVER_FALLBACK: src === "epub" ? "server-pandoc" : "server-libreoffice"
        },
        memoryMultiplier: 2,
        maxLocalFileSizeMB: 0,
        serverLane: "document",
        notes: `${src.toUpperCase()} layout rendering requires server LibreOffice/Pandoc engine`
      });
    }
  }
  for (const src of CLIENT_FORMATS.map((f) => f.id)) {
    if (src !== "zip" && src !== "gz" && src !== "7z" && src !== "rar") {
      rules.push({
        sourceFormat: src,
        targetFormat: "zip",
        supportedTiers: ["LOCAL_PURE_JS", "SERVER_FALLBACK"],
        enginesByTier: { LOCAL_PURE_JS: "pure-archive-zip", SERVER_FALLBACK: "server-archive-7z" },
        memoryMultiplier: 2.5,
        maxLocalFileSizeMB: 150,
        serverLane: "fast",
        notes: "In-browser ZIP packaging using CompressionStream deflate-raw"
      });
      rules.push({
        sourceFormat: src,
        targetFormat: "gz",
        supportedTiers: ["LOCAL_NATIVE", "LOCAL_PURE_JS", "SERVER_FALLBACK"],
        enginesByTier: {
          LOCAL_NATIVE: "compression-stream",
          LOCAL_PURE_JS: "pure-archive-zip",
          SERVER_FALLBACK: "server-archive-7z"
        },
        memoryMultiplier: 2.2,
        maxLocalFileSizeMB: 200,
        serverLane: "fast",
        notes: "Browser native GZIP CompressionStream"
      });
    }
  }
  rules.push(
    {
      sourceFormat: "zip",
      targetFormat: "gz",
      supportedTiers: ["LOCAL_NATIVE", "LOCAL_PURE_JS", "SERVER_FALLBACK"],
      enginesByTier: { LOCAL_NATIVE: "compression-stream", LOCAL_PURE_JS: "pure-archive-zip", SERVER_FALLBACK: "server-archive-7z" },
      memoryMultiplier: 2.5,
      maxLocalFileSizeMB: 150,
      serverLane: "fast"
    },
    {
      sourceFormat: "gz",
      targetFormat: "zip",
      supportedTiers: ["LOCAL_PURE_JS", "SERVER_FALLBACK"],
      enginesByTier: { LOCAL_PURE_JS: "pure-archive-zip", SERVER_FALLBACK: "server-archive-7z" },
      memoryMultiplier: 3,
      maxLocalFileSizeMB: 150,
      serverLane: "fast"
    },
    {
      sourceFormat: "7z",
      targetFormat: "zip",
      supportedTiers: ["SERVER_FALLBACK"],
      enginesByTier: { SERVER_FALLBACK: "server-archive-7z" },
      memoryMultiplier: 2,
      maxLocalFileSizeMB: 0,
      serverLane: "fast",
      notes: "7z LZMA2 unpacking requires server 7-Zip engine"
    },
    {
      sourceFormat: "rar",
      targetFormat: "zip",
      supportedTiers: ["SERVER_FALLBACK"],
      enginesByTier: { SERVER_FALLBACK: "server-archive-7z" },
      memoryMultiplier: 2,
      maxLocalFileSizeMB: 0,
      serverLane: "fast",
      notes: "RAR archive extraction requires server archive engine"
    }
  );
  return rules;
}
var CLIENT_ROUTE_RULES = buildDefaultRouteRules();
function findConversionRule(sourceFormat, targetFormat) {
  const src = sourceFormat.trim().toLowerCase();
  const tgt = targetFormat.trim().toLowerCase();
  return CLIENT_ROUTE_RULES.find((r) => r.sourceFormat === src && r.targetFormat === tgt);
}
function getCompatibleTargets(sourceFormat) {
  const src = sourceFormat.trim().toLowerCase();
  const targetIds = new Set(
    CLIENT_ROUTE_RULES.filter((r) => r.sourceFormat === src).map((r) => r.targetFormat)
  );
  const results = CLIENT_FORMATS.filter((f) => targetIds.has(f.id));
  if (results.length === 0) {
    return CLIENT_FORMATS.filter((f) => f.id === "zip" || f.id === "gz");
  }
  return results;
}
function getDefaultTargetForSource(sourceFormat) {
  const src = sourceFormat.trim().toLowerCase();
  const defaults = {
    png: "webp",
    jpg: "webp",
    webp: "png",
    avif: "png",
    bmp: "png",
    ico: "png",
    svg: "png",
    gif: "png",
    tiff: "png",
    heic: "jpg",
    wav: "wav",
    mp3: "wav",
    ogg: "wav",
    flac: "wav",
    aac: "wav",
    opus: "wav",
    mp4: "webm",
    webm: "mp4",
    mov: "mp4",
    mkv: "mp4",
    csv: "json",
    tsv: "csv",
    json: "yaml",
    yaml: "json",
    xml: "json",
    toml: "json",
    ini: "json",
    env: "json",
    sql: "json",
    md: "pdf",
    html: "md",
    txt: "pdf",
    docx: "pdf",
    pptx: "pdf",
    xlsx: "pdf",
    epub: "pdf",
    "7z": "zip",
    rar: "zip",
    zip: "gz",
    gz: "zip"
  };
  return defaults[src] ?? getCompatibleTargets(src)[0]?.id ?? "zip";
}
var CLIENT_PRESETS = [
  {
    id: "img-web-optimized",
    name: "Web Optimized (WebP \xB7 82%)",
    category: "image",
    targetFormat: "webp",
    description: "High compression ratio with EXIF stripped for fast web delivery",
    options: { quality: 82, stripMetadata: true, fit: "inside" }
  },
  {
    id: "img-strip-exif",
    name: "Social & Retina PNG",
    category: "image",
    targetFormat: "png",
    description: "High-quality lossy/lossless hybrid for crisp displays",
    options: { quality: 90, stripMetadata: true }
  },
  {
    id: "img-favicon-ico",
    name: "Favicon 64x64 ICO",
    category: "image",
    targetFormat: "ico",
    description: "Resizes cleanly to 64x64 square icon",
    options: { width: 64, height: 64, fit: "contain", stripMetadata: true }
  },
  {
    id: "audio-studio-wav",
    name: "Studio Master WAV (48 kHz)",
    category: "audio",
    targetFormat: "wav",
    description: "Lossless 48kHz stereo PCM with -1 dB peak normalization",
    options: { sampleRate: 48e3, channels: 2, normalizeAudio: true }
  },
  {
    id: "audio-voice-mono",
    name: "Podcast / Voice Mono (16 kHz)",
    category: "audio",
    targetFormat: "wav",
    description: "Downmixes to mono 16kHz normalized WAV for speech/AI transcription",
    options: { sampleRate: 16e3, channels: 1, normalizeAudio: true }
  },
  {
    id: "data-pretty-json",
    name: "Clean JSON (2-Space)",
    category: "data",
    targetFormat: "json",
    description: "Formats structured data with clean 2-space indentation",
    options: { indentSpaces: 2 }
  },
  {
    id: "data-sql-seed",
    name: "SQL Database Seed",
    category: "data",
    targetFormat: "sql",
    description: "Converts tabular dataset into portable SQL INSERT statements",
    options: { sqlTableName: "records" }
  },
  {
    id: "doc-a4-pdf",
    name: "Print-Ready PDF (A4)",
    category: "document",
    targetFormat: "pdf",
    description: "Typesets document or table onto clean A4 pages locally in browser",
    options: { pageSize: "A4" }
  },
  {
    id: "archive-zip-bundle",
    name: "Compressed ZIP Archive",
    category: "archive",
    targetFormat: "zip",
    description: "Packages file into standard DEFLATE ZIP archive locally",
    options: {}
  }
];
function getPresetsForCategory(category) {
  return CLIENT_PRESETS.filter((p) => p.category === category);
}

// src/client/router/conversion-router.ts
var TIER_PRIORITY = [
  "LOCAL_NATIVE",
  "LOCAL_PURE_JS",
  "LOCAL_WASM",
  "SERVER_FALLBACK"
];
var DEFAULT_SERVER_ENGINE_BY_LANE = {
  fast: "server-sharp-magick",
  document: "server-libreoffice",
  media: "server-ffmpeg"
};
var TARGET_MIME_BY_FORMAT = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif"
};
var ConversionRouter = class _ConversionRouter {
  static normalizeFormatId(format) {
    const clean = format.trim().toLowerCase().replace(/^\./, "");
    const def = getFormatById(clean);
    return def ? def.id : clean;
  }
  static synthesizeFallbackRule(sourceFormat, targetFormat) {
    const srcDef = getFormatById(sourceFormat);
    const tgtDef = getFormatById(targetFormat);
    const category = srcDef?.category ?? tgtDef?.category ?? "document";
    let serverLane = "fast";
    let serverEngine = "server-sharp-magick";
    if (category === "video" || category === "audio") {
      serverLane = "media";
      serverEngine = "server-ffmpeg";
    } else if (category === "document" || category === "ebook") {
      serverLane = "document";
      serverEngine = "server-libreoffice";
    } else if (category === "archive") {
      serverLane = "fast";
      serverEngine = "server-archive-7z";
    } else if (category === "data") {
      serverLane = "fast";
      serverEngine = "server-data-engine";
    }
    return {
      sourceFormat,
      targetFormat,
      supportedTiers: ["SERVER_FALLBACK"],
      enginesByTier: { SERVER_FALLBACK: serverEngine },
      memoryMultiplier: 3,
      maxLocalFileSizeMB: 0,
      serverLane,
      notes: `Preparing high-precision conversion...`
    };
  }
  static isTierCapableOnDevice(tier, engine, targetFormat, sizeMB, estimatedPeakMemoryMB, rule, device, forceLocal) {
    if (tier === "SERVER_FALLBACK") {
      return { ok: true };
    }
    if (tier === "LOCAL_NATIVE") {
      if (engine === "canvas-2d") {
        if (!device.supportsOffscreenCanvas && typeof document === "undefined") {
          return { ok: false, skipReason: "Browser OffscreenCanvas API is unavailable on this device" };
        }
        const targetMime = TARGET_MIME_BY_FORMAT[targetFormat];
        if (targetMime && !device.supportedCanvasEncodeMimes.includes(targetMime)) {
          return {
            ok: false,
            skipReason: `Browser canvas encoder does not support native ${targetFormat.toUpperCase()} encoding`
          };
        }
      } else if (engine === "web-audio-pcm") {
        if (!device.supportsWebAudio) {
          return { ok: false, skipReason: "WebAudio API is unavailable in this environment" };
        }
      } else if (engine === "compression-stream") {
        if (!device.supportsCompressionStream) {
          return { ok: false, skipReason: "Browser CompressionStream API is unavailable" };
        }
      } else if (engine === "web-codecs") {
        if (!device.supportsWebCodecs) {
          return { ok: false, skipReason: "WebCodecs API is unavailable in this browser" };
        }
      }
    }
    if (tier === "LOCAL_WASM" && rule.requiresCrossOriginIsolation && !device.crossOriginIsolated && sizeMB > 60) {
      if (forceLocal) {
        return {
          ok: true,
          warning: `SharedArrayBuffer (Cross-Origin Isolation) is disabled; single-threaded WASM processing of ${sizeMB.toFixed(1)} MB may be slow.`
        };
      }
      return {
        ok: false,
        skipReason: `File (${sizeMB.toFixed(1)} MB) requires multi-threaded WASM (SharedArrayBuffer / COOP+COEP), which is unavailable in this context`
      };
    }
    if (rule.maxLocalFileSizeMB > 0 && sizeMB > rule.maxLocalFileSizeMB) {
      if (forceLocal) {
        return {
          ok: true,
          warning: `File (${sizeMB.toFixed(1)} MB) exceeds recommended local limit (${rule.maxLocalFileSizeMB} MB).`
        };
      }
      return {
        ok: false,
        skipReason: `File size (${sizeMB.toFixed(1)} MB) exceeds local engine ceiling (${rule.maxLocalFileSizeMB} MB)`
      };
    }
    if (estimatedPeakMemoryMB > device.safeBrowserMemoryCapMB) {
      if (forceLocal) {
        return {
          ok: true,
          warning: `Estimated peak RAM (${estimatedPeakMemoryMB.toFixed(0)} MB) exceeds safe browser budget (${device.safeBrowserMemoryCapMB} MB).`
        };
      }
      return {
        ok: false,
        skipReason: `Estimated peak memory (${estimatedPeakMemoryMB.toFixed(0)} MB) exceeds device safe browser RAM budget (${device.safeBrowserMemoryCapMB} MB)`
      };
    }
    return { ok: true };
  }
  route(fileMeta, sourceFormat, targetFormat, options, device) {
    const warnings = [];
    let resolvedSource = _ConversionRouter.normalizeFormatId(sourceFormat);
    const resolvedTarget = _ConversionRouter.normalizeFormatId(targetFormat);
    if (fileMeta.headerBytes && fileMeta.headerBytes.length > 0) {
      const inspection = inspectFileMagicBytes(fileMeta.headerBytes, fileMeta.name);
      if (inspection.isSpoofedOrMismatched && inspection.detectedFormatId) {
        warnings.push(
          inspection.warningMessage ?? `Extension mismatch detected: using verified ${inspection.detectedFormatId.toUpperCase()} signature.`
        );
        if (inspection.confidence === "high") {
          resolvedSource = inspection.detectedFormatId;
        }
      }
    }
    const rule = findConversionRule(resolvedSource, resolvedTarget) ?? _ConversionRouter.synthesizeFallbackRule(resolvedSource, resolvedTarget);
    const sizeMB = Math.max(0, fileMeta.sizeBytes) / (1024 * 1024);
    const estimatedPeakMemoryMB = Number((sizeMB * rule.memoryMultiplier).toFixed(2));
    const mode = options.forceExecutionMode ?? "AUTO";
    const serverEngine = rule.enginesByTier.SERVER_FALLBACK ?? DEFAULT_SERVER_ENGINE_BY_LANE[rule.serverLane];
    if (mode === "SERVER_ONLY") {
      return {
        sourceFormat: resolvedSource,
        targetFormat: resolvedTarget,
        selectedTier: "SERVER_FALLBACK",
        selectedEngine: serverEngine,
        isLocal: false,
        requiresUpload: true,
        fallbackTier: null,
        fallbackEngine: null,
        estimatedPeakMemoryMB,
        serverLane: rule.serverLane,
        reason: `High-precision conversion explicitly selected.`,
        warnings
      };
    }
    const forceLocal = mode === "LOCAL_ONLY";
    const orderedTiers = TIER_PRIORITY.filter((t) => rule.supportedTiers.includes(t));
    const skipReasons = [];
    for (const tier of orderedTiers) {
      if (forceLocal && tier === "SERVER_FALLBACK") {
        continue;
      }
      const engine = rule.enginesByTier[tier] ?? (tier === "SERVER_FALLBACK" ? serverEngine : void 0);
      if (!engine) continue;
      const check = _ConversionRouter.isTierCapableOnDevice(
        tier,
        engine,
        resolvedTarget,
        sizeMB,
        estimatedPeakMemoryMB,
        rule,
        device,
        forceLocal
      );
      if (!check.ok) {
        if (check.skipReason) skipReasons.push(check.skipReason);
        continue;
      }
      if (check.warning) {
        warnings.push(check.warning);
      }
      const isLocal = tier !== "SERVER_FALLBACK";
      const hasServerFallback = !forceLocal && rule.supportedTiers.includes("SERVER_FALLBACK");
      let reason;
      if (tier === "LOCAL_NATIVE") {
        reason = `Processing securely on your device (hardware accelerated) \u2014 0 KB uploaded.`;
      } else if (tier === "LOCAL_PURE_JS") {
        reason = `Processing securely on your device \u2014 0 KB uploaded.`;
      } else if (tier === "LOCAL_WASM") {
        reason = `Processing securely on your device (advanced engine) \u2014 0 KB uploaded.`;
      } else {
        reason = skipReasons.length > 0 ? `Preparing high-precision conversion...` : rule.notes ?? `Preparing high-precision conversion...`;
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
        fallbackTier: isLocal && hasServerFallback ? "SERVER_FALLBACK" : null,
        fallbackEngine: isLocal && hasServerFallback ? serverEngine : null,
        estimatedPeakMemoryMB,
        serverLane: rule.serverLane,
        reason,
        warnings
      };
    }
    if (forceLocal) {
      throw new Error(
        `Local-only execution requested, but ${resolvedSource.toUpperCase()} -> ${resolvedTarget.toUpperCase()} has no compatible local browser engine.`
      );
    }
    return {
      sourceFormat: resolvedSource,
      targetFormat: resolvedTarget,
      selectedTier: "SERVER_FALLBACK",
      selectedEngine: serverEngine,
      isLocal: false,
      requiresUpload: true,
      fallbackTier: null,
      fallbackEngine: null,
      estimatedPeakMemoryMB,
      serverLane: rule.serverLane,
      reason: skipReasons.length > 0 ? `Preparing high-precision conversion...` : `Preparing high-precision conversion...`,
      warnings: [...warnings, ...skipReasons]
    };
  }
  escalateFailedLocalJobToServer(previousDecision, error) {
    const serverEngine = previousDecision.fallbackEngine ?? DEFAULT_SERVER_ENGINE_BY_LANE[previousDecision.serverLane] ?? "server-sharp-magick";
    const detail = error.message || "Unknown local worker error";
    return {
      ...previousDecision,
      selectedTier: "SERVER_FALLBACK",
      selectedEngine: serverEngine,
      isLocal: false,
      requiresUpload: true,
      fallbackTier: null,
      fallbackEngine: null,
      reason: `Transparently routing to high-precision engine after local issue...`,
      warnings: [
        ...previousDecision.warnings,
        `Local processing encountered an issue (${detail}); transparently recovered via high-precision engine.`
      ]
    };
  }
};

// src/client/router/device-profiler.ts
var CANDIDATE_CANVAS_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif"
];
var DeviceProfiler = class _DeviceProfiler {
  static computeSafeMemoryCapMB(deviceMemoryGB) {
    const safeGB = Number.isFinite(deviceMemoryGB) && deviceMemoryGB > 0 ? deviceMemoryGB : 8;
    return Math.round(Math.min(1536, Math.max(256, safeGB * 220)));
  }
  static async probeCanvasEncodeMimes() {
    const g = globalThis;
    if (typeof g.OffscreenCanvas === "function") {
      const supported = [];
      try {
        const canvas = new g.OffscreenCanvas(2, 2);
        const ctx = canvas.getContext("2d");
        ctx?.fillRect(0, 0, 2, 2);
        for (const mime of CANDIDATE_CANVAS_MIMES) {
          try {
            const blob = await canvas.convertToBlob({ type: mime, quality: 0.8 });
            if (blob && blob.type === mime) {
              supported.push(mime);
            }
          } catch {
          }
        }
        if (supported.length > 0) return supported;
      } catch {
      }
    }
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const supported = [];
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 2;
        for (const mime of CANDIDATE_CANVAS_MIMES) {
          try {
            const dataUrl = canvas.toDataURL(mime);
            if (dataUrl.startsWith(`data:${mime}`)) {
              supported.push(mime);
            }
          } catch {
          }
        }
        if (supported.length > 0) return supported;
      } catch {
      }
    }
    return ["image/png", "image/jpeg", "image/webp"];
  }
  static detectSync(overrides) {
    const g = globalThis;
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const rawCores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : 4;
    const rawMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 ? nav.deviceMemory : 8;
    const hardwareConcurrency = overrides?.hardwareConcurrency ?? rawCores;
    const deviceMemoryGB = overrides?.deviceMemoryGB ?? rawMemory;
    const crossOriginIsolated = overrides?.crossOriginIsolated ?? Boolean(g.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined");
    const supportsOffscreenCanvas = overrides?.supportsOffscreenCanvas ?? typeof g.OffscreenCanvas === "function";
    const supportsWebCodecs = overrides?.supportsWebCodecs ?? (typeof g.VideoEncoder === "function" && typeof g.VideoDecoder === "function");
    const supportsWebAudio = overrides?.supportsWebAudio ?? (typeof g.AudioContext === "function" || typeof g.webkitAudioContext === "function" || typeof g.OfflineAudioContext === "function");
    const supportsCompressionStream = overrides?.supportsCompressionStream ?? (typeof g.CompressionStream === "function" && typeof g.DecompressionStream === "function");
    const storage = nav.storage;
    const supportsOPFS = overrides?.supportsOPFS ?? Boolean(storage && typeof storage.getDirectory === "function");
    const availableStorageQuotaMB = overrides?.availableStorageQuotaMB ?? 2048;
    const safeBrowserMemoryCapMB = _DeviceProfiler.computeSafeMemoryCapMB(deviceMemoryGB);
    const supportedCanvasEncodeMimes = overrides?.supportedCanvasEncodeMimes ?? [
      "image/png",
      "image/jpeg",
      "image/webp"
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
      supportedCanvasEncodeMimes
    };
  }
  static async detect(overrides) {
    const base = _DeviceProfiler.detectSync(overrides);
    const nav = typeof navigator !== "undefined" ? navigator : {};
    let availableStorageQuotaMB = overrides?.availableStorageQuotaMB ?? base.availableStorageQuotaMB;
    if (overrides?.availableStorageQuotaMB === void 0 && nav.storage?.estimate) {
      try {
        const estimate = await nav.storage.estimate();
        if (typeof estimate.quota === "number") {
          const remainingBytes = Math.max(0, estimate.quota - (estimate.usage ?? 0));
          availableStorageQuotaMB = Math.round(remainingBytes / (1024 * 1024));
        }
      } catch {
      }
    }
    const supportedCanvasEncodeMimes = overrides?.supportedCanvasEncodeMimes ?? await _DeviceProfiler.probeCanvasEncodeMimes();
    return {
      ...base,
      availableStorageQuotaMB,
      supportedCanvasEncodeMimes
    };
  }
};

// src/client/workers/wasm-loader.ts
var WASM_CACHE_NAME = "omniconvert-wasm-cache-v1";
var WASM_MODULES = {
  "ffmpeg-wasm": {
    id: "ffmpeg-wasm",
    label: "FFmpeg WebAssembly Core",
    version: "0.12.6",
    cdnUrl: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
    wasmUrl: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
    estimatedSizeMB: 31.2,
    requiresCrossOriginIsolation: true
  },
  "imagemagick-wasm": {
    id: "imagemagick-wasm",
    label: "ImageMagick WebAssembly",
    version: "0.0.30",
    cdnUrl: "https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.30/dist/index.js",
    wasmUrl: "https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.30/dist/magick.wasm",
    estimatedSizeMB: 17.5,
    requiresCrossOriginIsolation: false
  }
};
var WasmLoaderError = class extends Error {
  shouldEscalateToServer;
  constructor(message, shouldEscalateToServer = true) {
    super(message);
    this.name = "WasmLoaderError";
    this.shouldEscalateToServer = shouldEscalateToServer;
  }
};
var LazyWasmLoader = class {
  loadedBuffers = /* @__PURE__ */ new Map();
  async isCached(id) {
    if (this.loadedBuffers.has(id)) return true;
    if (typeof caches === "undefined") return false;
    try {
      const cache = await caches.open(WASM_CACHE_NAME);
      const match = await cache.match(WASM_MODULES[id].wasmUrl);
      return Boolean(match);
    } catch {
      return false;
    }
  }
  async getAllStatuses() {
    const ids = ["ffmpeg-wasm", "imagemagick-wasm"];
    return Promise.all(
      ids.map(async (id) => ({
        id,
        cached: await this.isCached(id),
        loaded: this.loadedBuffers.has(id),
        sizeMB: WASM_MODULES[id].estimatedSizeMB
      }))
    );
  }
  async loadModuleBinary(id, options) {
    const existing = this.loadedBuffers.get(id);
    if (existing) {
      options?.onProgress?.(100, `${WASM_MODULES[id].label} ready from memory`);
      return existing;
    }
    const desc = WASM_MODULES[id];
    options?.onProgress?.(5, `Checking CacheStorage for ${desc.label}...`);
    if (typeof caches !== "undefined") {
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
      }
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new WasmLoaderError(
        `${desc.label} is not cached and browser is offline.`,
        true
      );
    }
    options?.onProgress?.(15, `Fetching ${desc.label} (${desc.estimatedSizeMB} MB) on demand...`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12e3);
      const onExternalAbort = () => controller.abort();
      options?.signal?.addEventListener("abort", onExternalAbort, { once: true });
      const resp = await fetch(desc.wasmUrl, { signal: controller.signal, mode: "cors" });
      clearTimeout(timeout);
      options?.signal?.removeEventListener("abort", onExternalAbort);
      if (!resp.ok) {
        throw new WasmLoaderError(
          `WASM CDN returned HTTP ${resp.status} for ${desc.label}`,
          true
        );
      }
      if (typeof caches !== "undefined") {
        try {
          const cache = await caches.open(WASM_CACHE_NAME);
          await cache.put(desc.wasmUrl, resp.clone());
        } catch {
        }
      }
      const buf = await resp.arrayBuffer();
      this.loadedBuffers.set(id, buf);
      options?.onProgress?.(100, `${desc.label} cached & ready`);
      return buf;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError" && options?.signal?.aborted) {
        throw err;
      }
      if (err instanceof WasmLoaderError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new WasmLoaderError(
        `Unable to load ${desc.label} (${msg}); escalating to Server Fallback.`,
        true
      );
    }
  }
  async clearCache() {
    this.loadedBuffers.clear();
    if (typeof caches !== "undefined") {
      await caches.delete(WASM_CACHE_NAME);
    }
  }
};

// src/client/workers/local-engines.ts
function replaceExtension(filename, newExt) {
  const base = filename.replace(/\.[^/.]+$/, "");
  return `${base || "converted"}.${newExt}`;
}
function assertNotAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException("Conversion aborted by user", "AbortError");
  }
}
function encodeImageDataToBmp(rgba, width, height) {
  const rowStride = width * 4;
  const pixelDataSize = rowStride * height;
  const headerSize = 14 + 40;
  const fileSize = headerSize + pixelDataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);
  view.setUint8(0, 66);
  view.setUint8(1, 77);
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, headerSize, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelDataSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const si = (srcRow * width + x) * 4;
      const di = headerSize + y * rowStride + x * 4;
      out[di] = rgba[si + 2];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si];
      out[di + 3] = rgba[si + 3];
    }
  }
  return out;
}
function encodePngToIco(pngBytes, width, height) {
  const headerSize = 6 + 16;
  const totalSize = headerSize + pngBytes.length;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  view.setUint8(6, width >= 256 ? 0 : width);
  view.setUint8(7, height >= 256 ? 0 : height);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, headerSize, true);
  out.set(pngBytes, headerSize);
  return out;
}
function computeTargetDimensions(srcW, srcH, options) {
  let targetW = options.width && options.width > 0 ? Math.round(options.width) : srcW;
  let targetH = options.height && options.height > 0 ? Math.round(options.height) : srcH;
  if (options.width && !options.height) {
    targetH = Math.max(1, Math.round(srcH * targetW / srcW));
  } else if (!options.width && options.height) {
    targetW = Math.max(1, Math.round(srcW * targetH / srcH));
  }
  const fit = options.fit ?? "contain";
  if (fit === "fill" || !options.width && !options.height) {
    return { targetW, targetH, drawX: 0, drawY: 0, drawW: targetW, drawH: targetH };
  }
  const scaleX = targetW / srcW;
  const scaleY = targetH / srcH;
  if (fit === "inside") {
    const scale2 = Math.min(1, scaleX, scaleY);
    const w = Math.max(1, Math.round(srcW * scale2));
    const h = Math.max(1, Math.round(srcH * scale2));
    return { targetW: w, targetH: h, drawX: 0, drawY: 0, drawW: w, drawH: h };
  }
  if (fit === "cover") {
    const scale2 = Math.max(scaleX, scaleY);
    const drawW2 = Math.round(srcW * scale2);
    const drawH2 = Math.round(srcH * scale2);
    return {
      targetW,
      targetH,
      drawX: Math.round((targetW - drawW2) / 2),
      drawY: Math.round((targetH - drawH2) / 2),
      drawW: drawW2,
      drawH: drawH2
    };
  }
  const scale = Math.min(scaleX, scaleY);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  return {
    targetW,
    targetH,
    drawX: Math.round((targetW - drawW) / 2),
    drawY: Math.round((targetH - drawH) / 2),
    drawW,
    drawH
  };
}
async function decodeImageDrawable(blob, sourceFormat) {
  if (sourceFormat !== "svg" && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close()
      };
    } catch {
    }
  }
  if (typeof Image !== "undefined") {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
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
        cleanup: () => URL.revokeObjectURL(url)
      };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }
  throw new Error("No browser image decoder (createImageBitmap / Image) is available");
}
async function canvasToBlobCompat(canvas, mimeType, quality) {
  if ("convertToBlob" in canvas && typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error(`Canvas failed to encode ${mimeType}`)),
      mimeType,
      quality
    );
  });
}
async function convertImageLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal) {
  assertNotAborted(signal);
  const warnings = [];
  onProgress?.(15, `Decoding ${sourceFormat.toUpperCase()} bitmap...`);
  const decoded = await decodeImageDrawable(file, sourceFormat);
  try {
    assertNotAborted(signal);
    const dims = computeTargetDimensions(decoded.width, decoded.height, options);
    if (targetFormat === "ico" && (dims.targetW > 256 || dims.targetH > 256)) {
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
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(dims.targetW, dims.targetH) : (() => {
      const c = document.createElement("canvas");
      c.width = dims.targetW;
      c.height = dims.targetH;
      return c;
    })();
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to acquire 2D canvas rendering context");
    }
    if (targetFormat === "jpg" || targetFormat === "bmp") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, dims.targetW, dims.targetH);
    }
    ctx.drawImage(decoded.drawable, dims.drawX, dims.drawY, dims.drawW, dims.drawH);
    assertNotAborted(signal);
    onProgress?.(75, `Encoding ${targetFormat.toUpperCase()} (EXIF metadata stripped)...`);
    if (targetFormat === "bmp") {
      const imageData = ctx.getImageData(0, 0, dims.targetW, dims.targetH);
      const bmpBytes = encodeImageDataToBmp(imageData.data, dims.targetW, dims.targetH);
      const blob = new Blob([bmpBytes.buffer], { type: "image/bmp" });
      onProgress?.(100, "BMP conversion complete");
      return {
        blob,
        bytes: bmpBytes,
        mimeType: "image/bmp",
        extension: "bmp",
        filename: replaceExtension(filename, "bmp"),
        warnings,
        metadata: { width: dims.targetW, height: dims.targetH, exifStripped: 1 }
      };
    }
    if (targetFormat === "ico") {
      const pngBlob = await canvasToBlobCompat(canvas, "image/png");
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      const icoBytes = encodePngToIco(pngBytes, dims.targetW, dims.targetH);
      const blob = new Blob([icoBytes.buffer], { type: "image/x-icon" });
      onProgress?.(100, "ICO icon created");
      return {
        blob,
        bytes: icoBytes,
        mimeType: "image/x-icon",
        extension: "ico",
        filename: replaceExtension(filename, "ico"),
        warnings,
        metadata: { width: dims.targetW, height: dims.targetH }
      };
    }
    const mimeMap = {
      png: "image/png",
      jpg: "image/jpeg",
      webp: "image/webp",
      avif: "image/avif"
    };
    const targetMime = mimeMap[targetFormat] ?? "image/png";
    const quality = Math.min(1, Math.max(0.05, (options.quality ?? 88) / 100));
    const encodedBlob = await canvasToBlobCompat(canvas, targetMime, quality);
    if (encodedBlob.type !== targetMime && targetFormat === "avif") {
      throw new Error("Browser canvas encoder fell back from AVIF; escalating");
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
      metadata: { width: dims.targetW, height: dims.targetH, exifStripped: 1 }
    };
  } finally {
    decoded.cleanup();
  }
}
function encodeChannelsToWav(channels, sampleRate, options) {
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
  const writeStr = (offset2, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset2 + i, str.charCodeAt(i));
    }
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] ?? 0));
      if (bitDepth === 16) {
        const int16 = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
        view.setInt16(offset, int16, true);
        offset += 2;
      } else {
        const int24 = sample < 0 ? Math.round(sample * 8388608) : Math.round(sample * 8388607);
        view.setUint8(offset, int24 & 255);
        view.setUint8(offset + 1, int24 >> 8 & 255);
        view.setUint8(offset + 2, int24 >> 16 & 255);
        offset += 3;
      }
    }
  }
  return new Uint8Array(buffer);
}
function normalizeChannelData(channels, targetDb = -1) {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > peak) peak = abs;
    }
  }
  if (peak <= 1e-5) return channels;
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
async function convertAudioLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal) {
  assertNotAborted(signal);
  if (targetFormat !== "wav") {
    throw new Error(`Native WebAudio encoder only outputs WAV; ${targetFormat.toUpperCase()} requires FFmpeg WASM or Server.`);
  }
  const AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("WebAudio AudioContext is unavailable in this browser");
  }
  onProgress?.(15, `Decoding ${sourceFormat.toUpperCase()} audio stream...`);
  const inputBuffer = await file.arrayBuffer();
  assertNotAborted(signal);
  const decodeCtx = new AudioCtx();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(inputBuffer.slice(0));
  } finally {
    await decodeCtx.close().catch(() => {
    });
  }
  assertNotAborted(signal);
  onProgress?.(45, "Processing resampling, trimming, and channel mix...");
  const startSec = Math.max(0, options.trimStartSec ?? 0);
  const endSec = options.trimEndSec && options.trimEndSec > startSec ? Math.min(decoded.duration, options.trimEndSec) : decoded.duration;
  const durationSec = Math.max(0.01, endSec - startSec);
  const targetRate = options.sampleRate ?? decoded.sampleRate;
  const targetChannels = options.channels ?? Math.min(2, Math.max(1, decoded.numberOfChannels));
  const frameCount = Math.max(1, Math.round(durationSec * targetRate));
  const OfflineCtx = globalThis.OfflineAudioContext;
  let renderedChannels;
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
    onProgress?.(70, "Normalizing audio peak to -1 dB...");
    renderedChannels = normalizeChannelData(renderedChannels, -1);
  }
  onProgress?.(85, "Encoding PCM WAV container...");
  const wavBytes = encodeChannelsToWav(renderedChannels, targetRate, { bitDepth: 16 });
  const blob = new Blob([wavBytes.buffer], { type: "audio/wav" });
  onProgress?.(100, "WAV audio conversion complete");
  return {
    blob,
    bytes: wavBytes,
    mimeType: "audio/wav",
    extension: "wav",
    filename: replaceExtension(filename, "wav"),
    warnings: [],
    metadata: {
      sampleRate: targetRate,
      channels: targetChannels,
      durationSec: Number(durationSec.toFixed(2))
    }
  };
}
function parseDelimitedText(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
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
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map((h, idx) => h.trim() || `column_${idx + 1}`);
  return nonEmpty.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    return obj;
  });
}
function serializeDelimitedText(rows, delimiter) {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      for (const k of Object.keys(r)) set.add(k);
      return set;
    }, /* @__PURE__ */ new Set())
  );
  const escapeCell = (val) => {
    const str = val === null || val === void 0 ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(delimiter),
    ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(delimiter))
  ];
  return lines.join("\n");
}
function parseSimpleYaml(text) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  const isArray = lines.some((l) => l.trim().startsWith("- "));
  if (isArray) {
    const items = [];
    let currentObj = null;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("- ")) {
        const rest = t.slice(2).trim();
        const colon = rest.indexOf(":");
        if (colon !== -1) {
          currentObj = {};
          currentObj[rest.slice(0, colon).trim()] = parseScalar(rest.slice(colon + 1).trim());
          items.push(currentObj);
        } else {
          currentObj = null;
          items.push(parseScalar(rest));
        }
      } else if (currentObj && line.startsWith("  ")) {
        const colon = t.indexOf(":");
        if (colon !== -1) {
          currentObj[t.slice(0, colon).trim()] = parseScalar(t.slice(colon + 1).trim());
        }
      }
    }
    return items;
  }
  const root = {};
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon !== -1) {
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim();
      root[key] = parseScalar(val);
    }
  }
  return root;
}
function parseScalar(raw) {
  if (raw === "" || raw === "null" || raw === "~") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith('"') && raw.endsWith('"') || raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }
  return raw;
}
function toSimpleYaml(value, indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null || value === void 0) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value === "" || /[:#\n"']/.test(value) || /^\d/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const entries2 = Object.entries(item);
        if (entries2.length === 0) return `${pad}- {}`;
        const [firstK, firstV] = entries2[0];
        const firstLine = `${pad}- ${firstK}: ${typeof firstV === "object" && firstV !== null ? "\n" + toSimpleYaml(firstV, indent + 2) : toSimpleYaml(firstV, 0)}`;
        const restLines = entries2.slice(1).map(([k, v]) => {
          if (v && typeof v === "object") {
            return `${pad}  ${k}:
${toSimpleYaml(v, indent + 2)}`;
          }
          return `${pad}  ${k}: ${toSimpleYaml(v, 0)}`;
        });
        return [firstLine, ...restLines].join("\n");
      }
      return `${pad}- ${toSimpleYaml(item, 0)}`;
    }).join("\n");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  return entries.map(([k, v]) => {
    if (v && typeof v === "object") {
      return `${pad}${k}:
${toSimpleYaml(v, indent + 1)}`;
    }
    return `${pad}${k}: ${toSimpleYaml(v, 0)}`;
  }).join("\n");
}
function parseIniOrEnv(text) {
  const root = {};
  let section = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      const secName = line.slice(1, -1).trim();
      section = {};
      root[secName] = section;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq !== -1) {
      const k = line.slice(0, eq).trim();
      const v = parseScalar(line.slice(eq + 1).trim());
      if (section) section[k] = v;
      else root[k] = v;
    }
  }
  return root;
}
function parseToml(text) {
  return parseIniOrEnv(text);
}
function parseSimpleXml(text) {
  const rows = [];
  const rowRegex = /<(row|item|record|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = rowRegex.exec(text)) !== null) {
    const inner = match[2];
    const obj = {};
    const fieldRegex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
    let fMatch;
    while ((fMatch = fieldRegex.exec(inner)) !== null) {
      obj[fMatch[1]] = fMatch[2].replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replaceAll("&quot;", '"');
    }
    if (Object.keys(obj).length > 0) rows.push(obj);
  }
  if (rows.length > 0) return rows;
  const flat = {};
  const tagRegex = /<([a-zA-Z0-9_-]+)>([^<]+)<\/\1>/g;
  while ((match = tagRegex.exec(text)) !== null) {
    flat[match[1]] = match[2].trim();
  }
  return flat;
}
function toSimpleXml(value) {
  const esc = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const sanitizeTag = (k) => k.replace(/[^a-zA-Z0-9_-]/g, "_") || "field";
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      if (item && typeof item === "object") {
        const fields = Object.entries(item).map(([k, v]) => `    <${sanitizeTag(k)}>${esc(v)}</${sanitizeTag(k)}>`).join("\n");
        return `  <record>
${fields}
  </record>`;
      }
      return `  <item>${esc(item)}</item>`;
    }).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<records>
${items}
</records>`;
  }
  if (value && typeof value === "object") {
    const fields = Object.entries(value).map(([k, v]) => `  <${sanitizeTag(k)}>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</${sanitizeTag(k)}>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<root>
${fields}
</root>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<value>${esc(value)}</value>`;
}
function toTomlOrIni(value, format) {
  const rows = Array.isArray(value) ? value : [value];
  if (format === "env") {
    const obj2 = rows[0] && typeof rows[0] === "object" ? rows[0] : { VALUE: value };
    return Object.entries(obj2).map(([k, v]) => `${k.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}=${typeof v === "string" && /\s/.test(v) ? JSON.stringify(v) : String(v ?? "")}`).join("\n");
  }
  if (Array.isArray(value)) {
    return value.map((item, idx) => {
      const obj2 = item && typeof item === "object" ? item : { value: item };
      const header = format === "toml" ? `[[records]]` : `[record_${idx + 1}]`;
      const lines = Object.entries(obj2).map(
        ([k, v]) => `${k} = ${typeof v === "string" && format === "toml" ? JSON.stringify(v) : String(v ?? "")}`
      );
      return [header, ...lines].join("\n");
    }).join("\n\n");
  }
  const obj = value && typeof value === "object" ? value : { value };
  return Object.entries(obj).map(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sec = Object.entries(v).map(([sk, sv]) => `${sk} = ${typeof sv === "string" && format === "toml" ? JSON.stringify(sv) : String(sv ?? "")}`).join("\n");
      return `[${k}]
${sec}`;
    }
    return `${k} = ${typeof v === "string" && format === "toml" ? JSON.stringify(v) : String(v ?? "")}`;
  }).join("\n");
}
function toSqlInserts(rows, tableName = "records") {
  if (rows.length === 0) return `-- No rows found for table ${tableName}
`;
  const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, "_") || "records";
  const cols = Array.from(
    rows.reduce((s, r) => {
      for (const k of Object.keys(r)) s.add(k);
      return s;
    }, /* @__PURE__ */ new Set())
  );
  const sqlVal = (v) => {
    if (v === null || v === void 0 || v === "") return "NULL";
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return `'${String(v).replaceAll("'", "''")}'`;
  };
  const colList = cols.map((c) => `"${c.replaceAll('"', "")}"`).join(", ");
  return rows.map((r) => `INSERT INTO "${safeTable}" (${colList}) VALUES (${cols.map((c) => sqlVal(r[c])).join(", ")});`).join("\n");
}
function normalizeToRows(data) {
  if (Array.isArray(data)) {
    return data.map(
      (item) => item && typeof item === "object" && !Array.isArray(item) ? item : { value: item }
    );
  }
  if (data && typeof data === "object") {
    return [data];
  }
  return [{ value: data }];
}
function markdownToHtml(md) {
  const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const lines = md.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push("");
      continue;
    }
    if (t.startsWith("### ")) out.push(`<h3>${esc(t.slice(4))}</h3>`);
    else if (t.startsWith("## ")) out.push(`<h2>${esc(t.slice(3))}</h2>`);
    else if (t.startsWith("# ")) out.push(`<h1>${esc(t.slice(2))}</h1>`);
    else if (t.startsWith("- ") || t.startsWith("* ")) out.push(`<li>${esc(t.slice(2))}</li>`);
    else {
      const formatted = esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
      out.push(`<p>${formatted}</p>`);
    }
  }
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Converted Document</title><style>body{font-family:system-ui,sans-serif;max-width:780px;margin:40px auto;line-height:1.6;color:#1e293b;padding:0 20px}code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head>
<body>
${out.join("\n")}
</body>
</html>`;
}
function htmlToTextOrMarkdown(html, toMd) {
  let out = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  if (toMd) {
    out = out.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n").replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n").replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n").replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n").replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**").replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  }
  out = out.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
function convertStructuredDataText(inputText, sourceFormat, targetFormat, options = {}) {
  try {
    const src = sourceFormat.toLowerCase();
    const tgt = targetFormat.toLowerCase();
    const warnings = [];
    if (["md", "html", "txt"].includes(src) && ["md", "html", "txt"].includes(tgt)) {
      let outputText2 = inputText;
      if (src === "md" && tgt === "html") outputText2 = markdownToHtml(inputText);
      else if (src === "md" && tgt === "txt") outputText2 = inputText.replace(/^#{1,6}\s+/gm, "").replace(/[*_`]/g, "");
      else if (src === "html" && tgt === "md") outputText2 = htmlToTextOrMarkdown(inputText, true);
      else if (src === "html" && tgt === "txt") outputText2 = htmlToTextOrMarkdown(inputText, false);
      else if (src === "txt" && tgt === "html") outputText2 = markdownToHtml(inputText);
      const bytes2 = new TextEncoder().encode(outputText2);
      const mime2 = getFormatById(tgt)?.mimeType ?? "text/plain";
      return {
        success: true,
        outputText: outputText2,
        outputBytes: bytes2,
        mimeType: mime2,
        targetExtension: tgt,
        warnings
      };
    }
    let parsed;
    if (src === "json") parsed = JSON.parse(inputText);
    else if (src === "csv") parsed = parseDelimitedText(inputText, options.csvDelimiter ?? ",");
    else if (src === "tsv") parsed = parseDelimitedText(inputText, "	");
    else if (src === "yaml") parsed = parseSimpleYaml(inputText);
    else if (src === "xml") parsed = parseSimpleXml(inputText);
    else if (src === "toml") parsed = parseToml(inputText);
    else if (src === "ini" || src === "env") parsed = parseIniOrEnv(inputText);
    else if (src === "sql") {
      const rows2 = [];
      const insertRe = /INSERT\s+INTO\s+\S+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;
      let m;
      while ((m = insertRe.exec(inputText)) !== null) {
        const cols = m[1].split(",").map((c) => c.trim().replace(/^["`]|["`]$/g, ""));
        const vals = m[2].split(",").map((v) => v.trim().replace(/^'|'$/g, ""));
        const obj = {};
        cols.forEach((c, idx) => {
          obj[c] = vals[idx] ?? "";
        });
        rows2.push(obj);
      }
      parsed = rows2;
    } else {
      parsed = { content: inputText };
    }
    const rows = normalizeToRows(parsed);
    const indent = options.indentSpaces ?? 2;
    let outputText = "";
    if (tgt === "json") {
      outputText = JSON.stringify(parsed, null, indent);
    } else if (tgt === "csv") {
      outputText = serializeDelimitedText(rows, options.csvDelimiter ?? ",");
    } else if (tgt === "tsv") {
      outputText = serializeDelimitedText(rows, "	");
    } else if (tgt === "yaml") {
      outputText = toSimpleYaml(parsed);
    } else if (tgt === "xml") {
      outputText = toSimpleXml(parsed);
    } else if (tgt === "toml" || tgt === "ini" || tgt === "env") {
      outputText = toTomlOrIni(parsed, tgt);
    } else if (tgt === "sql") {
      outputText = toSqlInserts(rows, options.sqlTableName ?? "records");
    } else if (tgt === "md") {
      const headers = Object.keys(rows[0] ?? {});
      if (headers.length === 0) {
        outputText = "";
      } else {
        const sep = headers.map(() => "---").join(" | ");
        const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")).join(" | ")).join("\n");
        outputText = `| ${headers.join(" | ")} |
| ${sep} |
${body.split("\n").map((l) => `| ${l} |`).join("\n")}`;
      }
    } else if (tgt === "html") {
      const headers = Object.keys(rows[0] ?? {});
      const ths = headers.map((h) => `<th>${h}</th>`).join("");
      const trs = rows.map((r) => `<tr>${headers.map((h) => `<td>${String(r[h] ?? "")}</td>`).join("")}</tr>`).join("\n");
      outputText = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left}th{background:#f1f5f9}</style></head><body><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
    } else {
      outputText = JSON.stringify(parsed, null, 2);
    }
    const bytes = new TextEncoder().encode(outputText);
    const mime = getFormatById(tgt)?.mimeType ?? "text/plain";
    return {
      success: true,
      outputText,
      outputBytes: bytes,
      mimeType: mime,
      targetExtension: tgt,
      rowCount: rows.length,
      warnings
    };
  } catch (err) {
    return {
      success: false,
      outputText: "",
      outputBytes: new Uint8Array(0),
      mimeType: "text/plain",
      targetExtension: targetFormat,
      warnings: [],
      errorMessage: err instanceof Error ? err.message : String(err)
    };
  }
}
var PDF_PAGE_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008]
};
function escapePdfText(str) {
  const safe = str.replace(/[^\x20-\x7E]/g, "?");
  return safe.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
function buildPdfBinary(objects, rootObjId = 1) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let cursor = 0;
  const pushStr = (s) => {
    const b = encoder.encode(s);
    chunks.push(b);
    cursor += b.length;
  };
  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  for (let i = 0; i < objects.length; i++) {
    offsets.push(cursor);
    pushStr(`${i + 1} 0 obj
${objects[i]}
endobj
`);
  }
  const xrefOffset = cursor;
  pushStr(`xref
0 ${objects.length + 1}
0000000000 65535 f 
`);
  for (const off of offsets) {
    pushStr(`${String(off).padStart(10, "0")} 00000 n 
`);
  }
  pushStr(`trailer
<< /Size ${objects.length + 1} /Root ${rootObjId} 0 R >>
startxref
${xrefOffset}
%%EOF
`);
  const out = new Uint8Array(cursor);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
function buildPdfWithBinaryStreams(textObjects, binaryStreams) {
  const encoder = new TextEncoder();
  const allIds = [
    ...textObjects.map((o) => ({ id: o.id, kind: "text", body: o.body })),
    ...binaryStreams.map((o) => ({ id: o.id, kind: "bin", dict: o.dict, data: o.data }))
  ].sort((a, b) => a.id - b.id);
  const chunks = [];
  const offsets = [];
  let cursor = 0;
  const pushBytes = (b) => {
    chunks.push(b);
    cursor += b.length;
  };
  const pushStr = (s) => pushBytes(encoder.encode(s));
  pushStr("%PDF-1.4\n");
  pushBytes(new Uint8Array([37, 226, 227, 207, 211, 10]));
  for (const obj of allIds) {
    offsets.push(cursor);
    if (obj.kind === "text") {
      pushStr(`${obj.id} 0 obj
${obj.body}
endobj
`);
    } else {
      pushStr(`${obj.id} 0 obj
${obj.dict}
stream
`);
      pushBytes(obj.data);
      pushStr(`
endstream
endobj
`);
    }
  }
  const xrefOffset = cursor;
  pushStr(`xref
0 ${allIds.length + 1}
0000000000 65535 f 
`);
  for (const off of offsets) {
    pushStr(`${String(off).padStart(10, "0")} 00000 n 
`);
  }
  pushStr(`trailer
<< /Size ${allIds.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`);
  const out = new Uint8Array(cursor);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
function generateTextPdf(title, lines, pageSize = "A4") {
  const [pageW, pageH] = PDF_PAGE_SIZES[pageSize];
  const margin = 48;
  const maxWidthChars = Math.floor((pageW - margin * 2) / 5.4);
  const lineHeight = 14.5;
  const wrapped = [
    { text: title, heading: true },
    { text: "", heading: false }
  ];
  for (const rawLine of lines) {
    const isHeading = rawLine.startsWith("#");
    const clean = rawLine.replace(/^#{1,6}\s+/, "");
    if (!clean) {
      wrapped.push({ text: "", heading: false });
      continue;
    }
    const words = clean.split(/\s+/);
    let current = "";
    for (const w of words) {
      if ((current + " " + w).trim().length > maxWidthChars) {
        wrapped.push({ text: current.trim(), heading: isHeading });
        current = w;
      } else {
        current = (current + " " + w).trim();
      }
    }
    if (current) wrapped.push({ text: current, heading: isHeading });
  }
  const linesPerPage = Math.max(10, Math.floor((pageH - margin * 2) / lineHeight));
  const pages = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([{ text: title, heading: true }]);
  const objects = [];
  const pageRefs = [];
  let nextObjId = 5;
  const pageObjects = [];
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    pageRefs.push(`${pageObjId} 0 R`);
    const cmds = ["BT"];
    let y = pageH - margin;
    for (const item of pages[pIdx]) {
      const font = item.heading ? "/F2" : "/F1";
      const size = item.heading ? 13 : 10;
      cmds.push(`${font} ${size} Tf`);
      cmds.push(`1 0 0 1 ${margin} ${y.toFixed(2)} Tm`);
      cmds.push(`(${escapePdfText(item.text)}) Tj`);
      y -= lineHeight;
    }
    cmds.push("ET");
    const stream = cmds.join("\n");
    pageObjects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    pageObjects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>
stream
${stream}
endstream`);
  }
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`);
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
  objects.push(...pageObjects);
  return buildPdfBinary(objects, 1);
}
async function generateImagePdf(imageBlob, sourceFormat, pageSize = "A4") {
  const decoded = await decodeImageDrawable(imageBlob, sourceFormat);
  try {
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(decoded.width, decoded.height) : (() => {
      const c = document.createElement("canvas");
      c.width = decoded.width;
      c.height = decoded.height;
      return c;
    })();
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable for PDF image embedding");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, decoded.width, decoded.height);
    ctx.drawImage(decoded.drawable, 0, 0, decoded.width, decoded.height);
    const jpegBlob = await canvasToBlobCompat(canvas, "image/jpeg", 0.92);
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
    const contentStream = `q
${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm
/Im1 Do
Q`;
    const contentBytes = new TextEncoder().encode(contentStream);
    return buildPdfWithBinaryStreams(
      [
        { id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` },
        { id: 2, body: `<< /Type /Pages /Kids [3 0 R] /Count 1 >>` },
        {
          id: 3,
          body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`
        }
      ],
      [
        {
          id: 4,
          dict: `<< /Type /XObject /Subtype /Image /Width ${decoded.width} /Height ${decoded.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`,
          data: jpegBytes
        },
        {
          id: 5,
          dict: `<< /Length ${contentBytes.length} >>`,
          data: contentBytes
        }
      ]
    );
  } finally {
    decoded.cleanup();
  }
}
var CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 4294967295;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
  }
  return (crc ^ 4294967295) >>> 0;
}
async function runCompressionStream(data, format, mode) {
  const StreamCtor = mode === "compress" ? globalThis.CompressionStream : globalThis.DecompressionStream;
  if (!StreamCtor) {
    throw new Error(`${mode === "compress" ? "CompressionStream" : "DecompressionStream"} unavailable`);
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
async function createZipArchive(entries) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;
  let centralSize = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replace(/^\/+/, ""));
    const checksum = crc32(entry.data);
    let compressed = entry.data;
    let method = 0;
    if (typeof CompressionStream !== "undefined" && entry.data.length > 64) {
      try {
        const deflated = await runCompressionStream(entry.data, "deflate-raw", "compress");
        if (deflated.length < entry.data.length) {
          compressed = deflated;
          method = 8;
        }
      } catch {
      }
    }
    const lfh = new ArrayBuffer(30);
    const lv = new DataView(lfh);
    lv.setUint32(0, 67324752, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 2048, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 21537, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localChunks.push(new Uint8Array(lfh), nameBytes, compressed);
    const cdh = new ArrayBuffer(46);
    const cv = new DataView(cdh);
    cv.setUint32(0, 33639248, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 2048, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 21537, true);
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
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 101010256, true);
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
async function convertDataOrArchiveLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal) {
  assertNotAborted(signal);
  if (targetFormat === "zip") {
    onProgress?.(25, "Compressing payload into local ZIP archive...");
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    let entryName = filename;
    let entryBytes = inputBytes;
    if (sourceFormat === "gz") {
      entryBytes = await runCompressionStream(inputBytes, "gzip", "decompress");
      entryName = filename.replace(/\.gz$/i, "") || "extracted.bin";
    }
    const zipBytes = await createZipArchive([{ name: entryName, data: entryBytes }]);
    onProgress?.(100, "ZIP archive generated locally");
    return {
      blob: new Blob([zipBytes.buffer], { type: "application/zip" }),
      bytes: zipBytes,
      mimeType: "application/zip",
      extension: "zip",
      filename: replaceExtension(filename, "zip"),
      warnings: []
    };
  }
  if (targetFormat === "gz") {
    onProgress?.(30, "Compressing via native CompressionStream (GZIP)...");
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    const gzBytes = await runCompressionStream(inputBytes, "gzip", "compress");
    onProgress?.(100, "GZIP archive generated");
    return {
      blob: new Blob([gzBytes.buffer], { type: "application/gzip" }),
      bytes: gzBytes,
      mimeType: "application/gzip",
      extension: "gz",
      filename: `${filename}.gz`,
      warnings: []
    };
  }
  if (targetFormat === "pdf") {
    const srcFormatInfo = getFormatById(sourceFormat);
    if (srcFormatInfo?.category === "image" || srcFormatInfo?.category === "vector") {
      onProgress?.(35, "Embedding image into printable PDF page...");
      const pdfBytes2 = await generateImagePdf(file, sourceFormat, options.pageSize ?? "A4");
      onProgress?.(100, "Image PDF generated locally");
      return {
        blob: new Blob([pdfBytes2.buffer], { type: "application/pdf" }),
        bytes: pdfBytes2,
        mimeType: "application/pdf",
        extension: "pdf",
        filename: replaceExtension(filename, "pdf"),
        warnings: []
      };
    }
    onProgress?.(35, "Typesetting document into A4/Letter PDF...");
    const rawText = await file.text();
    let lines;
    if (["csv", "tsv", "json", "yaml", "xml", "toml", "ini"].includes(sourceFormat)) {
      const mdTable = convertStructuredDataText(rawText, sourceFormat, "md", options);
      lines = (mdTable.success ? mdTable.outputText : rawText).split(/\r?\n/);
    } else if (sourceFormat === "html") {
      lines = htmlToTextOrMarkdown(rawText, false).split(/\r?\n/);
    } else {
      lines = rawText.split(/\r?\n/);
    }
    const pdfBytes = generateTextPdf(filename, lines, options.pageSize ?? "A4");
    onProgress?.(100, "PDF document generated locally");
    return {
      blob: new Blob([pdfBytes.buffer], { type: "application/pdf" }),
      bytes: pdfBytes,
      mimeType: "application/pdf",
      extension: "pdf",
      filename: replaceExtension(filename, "pdf"),
      warnings: []
    };
  }
  onProgress?.(30, `Transforming ${sourceFormat.toUpperCase()} -> ${targetFormat.toUpperCase()}...`);
  const inputText = await file.text();
  assertNotAborted(signal);
  const result = convertStructuredDataText(inputText, sourceFormat, targetFormat, options);
  if (!result.success) {
    throw new Error(result.errorMessage ?? `Failed to transform ${sourceFormat} to ${targetFormat}`);
  }
  onProgress?.(100, `${targetFormat.toUpperCase()} conversion complete`);
  const blob = new Blob([result.outputBytes.buffer], { type: result.mimeType });
  return {
    blob,
    bytes: result.outputBytes,
    mimeType: result.mimeType,
    extension: result.targetExtension,
    filename: replaceExtension(filename, result.targetExtension),
    warnings: result.warnings,
    metadata: result.rowCount !== void 0 ? { rows: result.rowCount } : void 0
  };
}
var sharedWasmLoader = new LazyWasmLoader();
async function executeLocalConversion(params) {
  const { file, filename, sourceFormat, targetFormat, engineId, options, onProgress, signal } = params;
  if (engineId === "canvas-2d") {
    return convertImageLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal);
  }
  if (engineId === "web-audio-pcm") {
    return convertAudioLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal);
  }
  if (engineId === "pure-data-tabular" || engineId === "pure-markup-doc" || engineId === "pure-archive-zip" || engineId === "pure-pdf-ops" || engineId === "compression-stream") {
    return convertDataOrArchiveLocal(file, filename, sourceFormat, targetFormat, options, onProgress, signal);
  }
  if (engineId === "wasm-ffmpeg" || engineId === "wasm-imagemagick") {
    const modId = engineId === "wasm-ffmpeg" ? "ffmpeg-wasm" : "imagemagick-wasm";
    await sharedWasmLoader.loadModuleBinary(modId, {
      signal,
      onProgress: (pct, stage) => onProgress?.(Math.min(50, pct * 0.5), stage)
    });
    throw new WasmLoaderError(
      `${modId} binary ready, delegating heavy codec execution to managed Server Fallback`,
      true
    );
  }
  throw new Error(`Unsupported local conversion engine: ${engineId}`);
}

// src/client/services/demo-generator.ts
async function generateDemoPng() {
  const width = 960;
  const height = 540;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.5, "#1e1b4b");
    grad.addColorStop(1, "#064e3b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
    ctx.beginPath();
    ctx.arc(220, 180, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(56, 189, 248, 0.22)";
    ctx.beginPath();
    ctx.arc(740, 360, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, width - 96, height - 96);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 54px system-ui, -apple-system, sans-serif";
    ctx.fillText("OmniConvert Engine", 96, 230);
    ctx.fillStyle = "#34d399";
    ctx.font = "600 26px system-ui, -apple-system, sans-serif";
    ctx.fillText("85-95% Zero-Upload Local Conversion", 96, 285);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px monospace";
    ctx.fillText("960x540 PNG  |  OffscreenCanvas  |  EXIF-Strip Ready", 96, 345);
  }
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error("Failed to create demo PNG")),
      "image/png"
    );
  });
  return new File([blob], "studio-portrait.png", { type: "image/png" });
}
function generateDemoCsv() {
  const csv = [
    "id,sku,product_name,category,price,stock,is_active",
    "101,PROD-1001,Wireless Noise-Canceling Headphones,Audio,299.99,450,true",
    "102,PROD-1002,Mechanical Keyboard - Cherry MX Blue,Accessories,149.50,120,true",
    "103,PROD-1003,Ergonomic Office Chair (Mesh),Furniture,499.00,85,true",
    "104,PROD-1004,27-inch 4K IPS Monitor,Displays,399.00,210,true",
    "105,PROD-1005,USB-C Docking Station (100W PD),Accessories,89.99,500,true",
    "106,PROD-1006,Bluetooth Optical Mouse,Accessories,45.00,800,false"
  ].join("\n");
  return new File([csv], "product-catalog.csv", { type: "text/csv" });
}
function generateDemoMarkdown() {
  const md = [
    "# OmniConvert v2.0 Release Notes",
    "",
    "## What's New in this Release",
    "We are excited to announce the latest major update to the **OmniConvert Engine**.",
    "",
    "### Key Features",
    "- **Invisible Hybrid Execution**: Users seamlessly get hardware-accelerated local conversion or high-precision server fallbacks without being asked.",
    "- **Enhanced Privacy**: Local conversions ensure *0 KB* of data leaves the device.",
    "- **Studio Quality Audio**: Support for downmixing, peak normalization, and resampling.",
    "",
    "### Fixes & Improvements",
    "1. Improved memory management for heavy PNG/WEBP exports.",
    "2. Added clean 2-space indentation presets for JSON.",
    "3. Optimized LibreOffice and Pandoc integration for document rendering.",
    "",
    "*Thank you for using OmniConvert!*"
  ].join("\n");
  return new File([md], "release-notes.md", { type: "text/markdown" });
}
function generateDemoWav() {
  const sampleRate = 44100;
  const durationSec = 1.4;
  const length = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const freqs = [440, 554.37, 659.25];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 0.04) * Math.min(1, (durationSec - t) / 0.25);
    let sample = 0;
    for (const f of freqs) {
      sample += Math.sin(2 * Math.PI * f * t);
    }
    sample = sample / freqs.length * 0.45 * env;
    left[i] = sample;
    right[i] = sample * 0.92;
  }
  const wavBytes = encodeChannelsToWav([left, right], sampleRate, { bitDepth: 16 });
  return new File([wavBytes.buffer], "ambient-synth.wav", { type: "audio/wav" });
}
async function generateDemoDocx() {
  const enc = new TextEncoder();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Executive Brief</w:t></w:r></w:p>
    <w:p><w:r><w:t>This confidential document outlines the strategic priorities for Q4 2026.</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const zipBytes = await createZipArchive([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(documentXml) }
  ]);
  return new File([zipBytes.buffer], "executive-brief.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}
async function createDemoSampleFiles() {
  const [png, docx] = await Promise.all([generateDemoPng(), generateDemoDocx()]);
  return [
    png,
    generateDemoCsv(),
    generateDemoMarkdown(),
    generateDemoWav(),
    docx
  ];
}

// src/client/services/server-fallback.ts
var ServerFallbackClient = class {
  baseUrl;
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async getHealth() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/health`, {
        headers: { Accept: "application/json" }
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }
  async getCapabilities() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/capabilities`, {
        headers: { Accept: "application/json" }
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }
  async triggerSweep() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/admin/sweep`, {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }
  async cancelJob(jobId) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE"
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
  async getJobStatus(jobId) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
        headers: { Accept: "application/json" }
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }
  async submitAndMonitorJob(params) {
    const { file, filename, sourceFormat, targetFormat, options, onProgress, signal } = params;
    if (signal?.aborted) {
      throw new DOMException("Server job aborted before upload", "AbortError");
    }
    onProgress?.({
      status: "uploading-server",
      progressPercent: 10,
      stageMessage: `Preparing high-precision conversion...`
    });
    const uploadResp = await fetch(`${this.baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: {
        "X-File-Name": encodeURIComponent(filename),
        "X-Source-Format": sourceFormat,
        "X-Target-Format": targetFormat,
        "X-Options-Json": JSON.stringify(options),
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file,
      signal
    });
    if (!uploadResp.ok) {
      let errMsg = `Server rejected upload (HTTP ${uploadResp.status})`;
      try {
        const errJson = await uploadResp.json();
        errMsg = errJson.error || errJson.message || errMsg;
      } catch {
      }
      throw new Error(errMsg);
    }
    const createdJob = await uploadResp.json();
    const jobId = createdJob.id;
    onProgress?.({
      status: createdJob.status,
      progressPercent: Math.max(20, createdJob.progressPercent ?? 20),
      stageMessage: createdJob.stageMessage || "Converting document...",
      jobRecord: createdJob
    });
    const abortHandler = () => {
      void this.cancelJob(jobId);
    };
    signal?.addEventListener("abort", abortHandler, { once: true });
    try {
      const completedJob = await this.waitForCompletion(jobId, createdJob, onProgress, signal);
      if (signal?.aborted) {
        throw new DOMException("Server conversion cancelled", "AbortError");
      }
      const downloadUrl = completedJob.downloadUrl || `${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/download`;
      onProgress?.({
        status: "processing-server",
        progressPercent: 95,
        stageMessage: "Finalizing output...",
        jobRecord: completedJob
      });
      const dlResp = await fetch(downloadUrl, { signal });
      if (!dlResp.ok) {
        throw new Error(`Failed to download converted file (HTTP ${dlResp.status})`);
      }
      const blob = await dlResp.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const base = filename.replace(/\.[^/.]+$/, "") || "converted";
      const outFilename = `${base}.${targetFormat}`;
      return {
        blob,
        bytes,
        mimeType: blob.type || dlResp.headers.get("content-type") || "application/octet-stream",
        filename: outFilename,
        jobRecord: completedJob
      };
    } finally {
      signal?.removeEventListener("abort", abortHandler);
    }
  }
  waitForCompletion(jobId, initialJob, onProgress, signal) {
    if (initialJob.status === "completed") return Promise.resolve(initialJob);
    if (initialJob.status === "failed") {
      return Promise.reject(new Error(initialJob.errorMessage || "Server conversion failed"));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      let eventSource = null;
      let pollTimer = null;
      const cleanup = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        signal?.removeEventListener("abort", onAbort);
      };
      const finish = (job) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (job.status === "completed") {
          resolve(job);
        } else if (job.status === "cancelled") {
          reject(new DOMException("Server job cancelled", "AbortError"));
        } else {
          reject(new Error(job.errorMessage || `Server job ${job.status}`));
        }
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new DOMException("Conversion cancelled by user", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      const handleUpdate = (raw) => {
        try {
          const data = JSON.parse(raw);
          onProgress?.({
            status: data.status,
            progressPercent: data.progressPercent ?? 50,
            stageMessage: data.stageMessage || "Converting document...",
            jobRecord: data
          });
          if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
            finish(data);
          }
        } catch {
        }
      };
      const startPolling = () => {
        if (pollTimer || settled) return;
        pollTimer = setInterval(async () => {
          if (settled) return;
          const job = await this.getJobStatus(jobId);
          if (!job) return;
          onProgress?.({
            status: job.status,
            progressPercent: job.progressPercent ?? 50,
            stageMessage: job.stageMessage || "Converting document...",
            jobRecord: job
          });
          if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
            finish(job);
          }
        }, 700);
      };
      if (typeof EventSource !== "undefined") {
        try {
          eventSource = new EventSource(
            `${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/events`
          );
          eventSource.onmessage = (evt) => handleUpdate(evt.data);
          const sseEvents = [
            "progress",
            "status",
            "completed",
            "failed",
            "job:updated",
            "job:progress",
            "job:completed",
            "job:failed"
          ];
          for (const evName of sseEvents) {
            eventSource.addEventListener(evName, (evt) => handleUpdate(evt.data));
          }
          eventSource.onerror = () => {
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            startPolling();
          };
        } catch {
          startPolling();
        }
      } else {
        startPolling();
      }
    });
  }
};

// src/client/workers/worker-pool.ts
var WASM_HIGH_WATER_MARK_BYTES = 512 * 1024 * 1024;
function clampWorkerConcurrency(hardwareConcurrency) {
  const cores = Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 ? hardwareConcurrency : 4;
  return Math.max(1, Math.min(4, Math.floor(cores) - 1));
}
var WorkerPool = class {
  maxWorkers;
  highWaterMarkBytes;
  slots;
  queue = [];
  totalJobsProcessed = 0;
  totalBytesProcessed = 0;
  recycledWorkersCount = 0;
  listeners = /* @__PURE__ */ new Set();
  constructor(hardwareConcurrency = typeof navigator !== "undefined" && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4, highWaterMarkBytes = WASM_HIGH_WATER_MARK_BYTES) {
    this.maxWorkers = clampWorkerConcurrency(hardwareConcurrency);
    this.highWaterMarkBytes = highWaterMarkBytes;
    this.slots = Array.from({ length: this.maxWorkers }, (_, idx) => ({
      slotId: idx + 1,
      busy: false,
      cumulativeBytes: 0,
      jobsRun: 0,
      isHeavyWasm: false,
      activeWorker: null,
      activeAbortController: null
    }));
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify() {
    const snapshot = this.getStats();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
  getStats() {
    return {
      maxWorkers: this.maxWorkers,
      activeCount: this.slots.filter((s) => s.busy).length,
      queuedCount: this.queue.length,
      totalJobsProcessed: this.totalJobsProcessed,
      totalBytesProcessed: this.totalBytesProcessed,
      recycledWorkersCount: this.recycledWorkersCount,
      highWaterMarkBytes: this.highWaterMarkBytes,
      slots: this.slots.map((s) => ({
        slotId: s.slotId,
        busy: s.busy,
        cumulativeBytes: s.cumulativeBytes,
        jobsRun: s.jobsRun,
        isHeavyWasm: s.isHeavyWasm
      }))
    };
  }
  enqueue(params) {
    if (params.signal?.aborted) {
      return Promise.reject(new DOMException("Conversion aborted by user", "AbortError"));
    }
    return new Promise((resolve, reject) => {
      const job = {
        id: params.id,
        inputBytes: params.inputBytes,
        isHeavyWasm: Boolean(params.isHeavyWasm),
        signal: params.signal,
        onProgress: params.onProgress,
        executor: params.executor,
        resolve,
        reject
      };
      if (params.signal) {
        const onAbort = () => {
          const queueIndex = this.queue.indexOf(job);
          if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
            this.notify();
            reject(new DOMException("Queued conversion cancelled", "AbortError"));
          }
        };
        params.signal.addEventListener("abort", onAbort, { once: true });
      }
      this.queue.push(job);
      this.notify();
      this.pump();
    });
  }
  pump() {
    while (this.queue.length > 0) {
      const freeSlot = this.slots.find((s) => !s.busy);
      if (!freeSlot) return;
      const job = this.queue.shift();
      if (!job) return;
      if (job.signal?.aborted) {
        job.reject(new DOMException("Conversion aborted by user", "AbortError"));
        continue;
      }
      void this.runInSlot(freeSlot, job);
    }
  }
  async runInSlot(slot, job) {
    slot.busy = true;
    slot.isHeavyWasm = job.isHeavyWasm;
    const localController = new AbortController();
    slot.activeAbortController = localController;
    const onExternalAbort = () => {
      localController.abort();
      if (slot.activeWorker) {
        try {
          slot.activeWorker.terminate();
        } catch {
        }
        slot.activeWorker = null;
        this.recycledWorkersCount++;
      }
    };
    if (job.signal) {
      job.signal.addEventListener("abort", onExternalAbort, { once: true });
    }
    this.notify();
    try {
      const result = await job.executor({
        slotId: slot.slotId,
        signal: localController.signal,
        reportProgress: (percent, stageMessage) => {
          if (!localController.signal.aborted) {
            job.onProgress?.(percent, stageMessage);
          }
        },
        registerWorker: (worker) => {
          slot.activeWorker = worker;
        }
      });
      if (localController.signal.aborted) {
        throw new DOMException("Conversion cancelled", "AbortError");
      }
      slot.cumulativeBytes += job.inputBytes;
      slot.jobsRun += 1;
      this.totalJobsProcessed += 1;
      this.totalBytesProcessed += job.inputBytes;
      if (slot.cumulativeBytes >= this.highWaterMarkBytes) {
        this.recycleSlot(slot);
      }
      job.resolve(result);
    } catch (err) {
      if (slot.activeWorker) {
        this.recycleSlot(slot);
      }
      job.reject(err);
    } finally {
      if (job.signal) {
        job.signal.removeEventListener("abort", onExternalAbort);
      }
      slot.busy = false;
      slot.activeAbortController = null;
      this.notify();
      this.pump();
    }
  }
  recycleSlot(slot) {
    if (slot.activeWorker) {
      try {
        slot.activeWorker.terminate();
      } catch {
      }
      slot.activeWorker = null;
    }
    slot.cumulativeBytes = 0;
    slot.isHeavyWasm = false;
    this.recycledWorkersCount += 1;
  }
  recycleAllHeavyWorkers() {
    for (const slot of this.slots) {
      if (!slot.busy && (slot.cumulativeBytes > 0 || slot.activeWorker)) {
        this.recycleSlot(slot);
      }
    }
    this.notify();
  }
};

// src/client/ui/format-picker.ts
var PICKER_CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "image", label: "Image" },
  { id: "audio", label: "Audio" },
  { id: "document", label: "Document" },
  { id: "data", label: "Data" },
  { id: "archive", label: "Archive" }
];
var formatRegistryByItem = /* @__PURE__ */ new Map();
var containerAbortControllers = /* @__PURE__ */ new WeakMap();
function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function normalizePickerCategory(category) {
  const normalized = category.trim().toLowerCase();
  switch (normalized) {
    case "image":
    case "vector":
      return "image";
    case "audio":
      return "audio";
    case "document":
    case "ebook":
      return "document";
    case "data":
      return "data";
    case "archive":
      return "archive";
    default:
      return "all";
  }
}
function filterPickerFormats(formats, query, category = "all") {
  const q = query.trim().toLowerCase();
  return formats.filter((fmt) => {
    if (category !== "all" && normalizePickerCategory(fmt.category) !== category) {
      return false;
    }
    if (!q) return true;
    const inId = fmt.id.toLowerCase().includes(q);
    const inLabel = fmt.label.toLowerCase().includes(q);
    const inName = fmt.name.toLowerCase().includes(q);
    const inDesc = (fmt.description ?? "").toLowerCase().includes(q);
    const inExt = (fmt.extensions ?? []).some((ext) => ext.toLowerCase().includes(q));
    return inId || inLabel || inName || inDesc || inExt;
  });
}
function serializeFormatsAttribute(formats) {
  const compact = formats.map((f) => ({
    id: f.id,
    label: f.label,
    name: f.name,
    category: f.category,
    description: f.description ?? f.name,
    extensions: f.extensions ?? [f.id]
  }));
  return escapeHtml(JSON.stringify(compact));
}
function parseFormatsAttribute(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.label === "string"
    );
  } catch {
    return [];
  }
}
function createFormatPickerTriggerHtml(itemId, currentTargetId, compatibleFormats) {
  formatRegistryByItem.set(itemId, [...compatibleFormats]);
  const normalizedCurrent = currentTargetId.trim().toLowerCase();
  const currentFmt = compatibleFormats.find((f) => f.id.toLowerCase() === normalizedCurrent);
  const displayLabel = currentFmt?.label ?? (currentTargetId ? currentTargetId.toUpperCase() : "SELECT");
  const displayTitle = currentFmt ? `${currentFmt.label} \u2014 ${currentFmt.name}` : `Output format: ${displayLabel}`;
  return `
    <div class="format-picker-wrap" data-format-picker-wrap data-item-id="${escapeHtml(itemId)}">
      <button
        type="button"
        class="format-picker-trigger"
        data-action="open-format-picker"
        data-id="${escapeHtml(itemId)}"
        data-item-id="${escapeHtml(itemId)}"
        data-target-id="${escapeHtml(normalizedCurrent)}"
        data-formats="${serializeFormatsAttribute(compatibleFormats)}"
        aria-haspopup="listbox"
        aria-expanded="false"
        title="${escapeHtml(displayTitle)}"
      >
        <span class="format-picker-trigger-label">${escapeHtml(displayLabel)}</span>
        <svg class="format-picker-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>
  `.trim();
}
var FormatPickerPopover = class {
  popoverEl = null;
  activeTrigger = null;
  activeItemId = null;
  currentTargetId = "";
  formats = [];
  searchQuery = "";
  activeCategory = "all";
  activeOptionIndex = 0;
  onSelectCallback = null;
  globalAbortController = null;
  isOpen() {
    return this.popoverEl !== null && !this.popoverEl.classList.contains("hidden");
  }
  getActiveItemId() {
    return this.activeItemId;
  }
  open(triggerEl, itemId, currentTargetId, formats, onSelect) {
    if (typeof document === "undefined") return;
    if (this.isOpen() && this.activeItemId === itemId && this.activeTrigger === triggerEl) {
      this.close();
      return;
    }
    this.close();
    this.activeTrigger = triggerEl;
    this.activeItemId = itemId;
    this.currentTargetId = currentTargetId.trim().toLowerCase();
    this.formats = [...formats];
    this.searchQuery = "";
    this.activeCategory = "all";
    this.activeOptionIndex = Math.max(
      0,
      this.formats.findIndex((f) => f.id.toLowerCase() === this.currentTargetId)
    );
    this.onSelectCallback = onSelect;
    triggerEl.setAttribute("aria-expanded", "true");
    triggerEl.classList.add("is-open");
    const popover = this.buildPopoverElement();
    this.popoverEl = popover;
    document.body.appendChild(popover);
    this.renderCategories();
    this.renderGrid();
    this.positionPopover();
    this.bindGlobalEvents();
    const searchInput = popover.querySelector(".format-picker-search");
    if (searchInput) {
      requestAnimationFrame(() => searchInput.focus({ preventScroll: true }));
    }
  }
  close(restoreFocus = false) {
    if (this.globalAbortController) {
      this.globalAbortController.abort();
      this.globalAbortController = null;
    }
    const prevTrigger = this.activeTrigger;
    if (prevTrigger) {
      prevTrigger.setAttribute("aria-expanded", "false");
      prevTrigger.classList.remove("is-open");
    }
    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
    }
    this.activeTrigger = null;
    this.activeItemId = null;
    this.onSelectCallback = null;
    if (restoreFocus && prevTrigger && prevTrigger.isConnected) {
      prevTrigger.focus({ preventScroll: true });
    }
  }
  destroy() {
    this.close(false);
  }
  buildPopoverElement() {
    const popover = document.createElement("div");
    popover.className = "format-picker-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Select output format");
    popover.innerHTML = `
      <div class="format-picker-search-wrap">
        <svg class="format-picker-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="search"
          class="format-picker-search"
          placeholder="Search format... e.g. WEBP, MP3, JSON"
          aria-label="Search target format"
          autocomplete="off"
          spellcheck="false"
        />
        <kbd class="format-picker-kbd" aria-hidden="true">ESC</kbd>
      </div>
      <div class="format-picker-tabs" role="tablist" aria-label="Format categories"></div>
      <div class="format-picker-grid" role="listbox" aria-label="Compatible output formats"></div>
      <div class="format-picker-footer">
        <span class="format-picker-desc-title"></span>
        <span class="format-picker-desc-body">Hover a format to inspect details</span>
      </div>
    `;
    const searchInput = popover.querySelector(".format-picker-search");
    searchInput?.addEventListener("input", () => {
      this.searchQuery = searchInput.value;
      this.activeOptionIndex = 0;
      this.renderGrid();
    });
    searchInput?.addEventListener("keydown", (e) => {
      this.handleKeyNavigation(e);
    });
    popover.addEventListener("keydown", (e) => {
      if (e.target !== searchInput) {
        this.handleKeyNavigation(e);
      }
    });
    const tabsEl = popover.querySelector(".format-picker-tabs");
    tabsEl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".format-picker-tab");
      if (!btn || btn.disabled) return;
      const cat = btn.dataset.category;
      if (!cat) return;
      this.activeCategory = cat;
      this.activeOptionIndex = 0;
      this.renderCategories();
      this.renderGrid();
    });
    const gridEl = popover.querySelector(".format-picker-grid");
    gridEl?.addEventListener("click", (e) => {
      const option = e.target.closest(".format-picker-option");
      if (!option) return;
      const formatId = option.dataset.formatId;
      if (!formatId) return;
      this.commitSelection(formatId);
    });
    gridEl?.addEventListener("mouseover", (e) => {
      const option = e.target.closest(".format-picker-option");
      if (!option) return;
      const formatId = option.dataset.formatId;
      if (formatId) this.updateFooterPreview(formatId);
    });
    gridEl?.addEventListener("focusin", (e) => {
      const option = e.target.closest(".format-picker-option");
      if (!option) return;
      const formatId = option.dataset.formatId;
      if (formatId) this.updateFooterPreview(formatId);
    });
    return popover;
  }
  renderCategories() {
    const tabsEl = this.popoverEl?.querySelector(".format-picker-tabs");
    if (!tabsEl) return;
    tabsEl.innerHTML = PICKER_CATEGORY_TABS.map((tab) => {
      const count = tab.id === "all" ? this.formats.length : this.formats.filter((f) => normalizePickerCategory(f.category) === tab.id).length;
      const isActive = this.activeCategory === tab.id;
      const isDisabled = tab.id !== "all" && count === 0;
      return `
        <button
          type="button"
          class="format-picker-tab ${isActive ? "is-active" : ""}"
          role="tab"
          aria-selected="${isActive ? "true" : "false"}"
          data-category="${tab.id}"
          ${isDisabled ? "disabled" : ""}
        >
          <span>${escapeHtml(tab.label)}</span>
          ${count > 0 && tab.id !== "all" ? `<span class="format-picker-tab-count">${count}</span>` : ""}
        </button>
      `;
    }).join("");
  }
  renderGrid() {
    const gridEl = this.popoverEl?.querySelector(".format-picker-grid");
    if (!gridEl) return;
    const filtered = filterPickerFormats(this.formats, this.searchQuery, this.activeCategory);
    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="format-picker-empty">
          No formats match <strong>${escapeHtml(this.searchQuery || this.activeCategory)}</strong>
        </div>
      `;
      this.updateFooterPreview(null);
      return;
    }
    if (this.activeOptionIndex >= filtered.length) {
      this.activeOptionIndex = 0;
    }
    gridEl.innerHTML = filtered.map((fmt, idx) => {
      const isSelected = fmt.id.toLowerCase() === this.currentTargetId;
      const isFocused = idx === this.activeOptionIndex;
      const desc = fmt.description ?? fmt.name;
      return `
          <button
            type="button"
            class="format-picker-option ${isSelected ? "is-selected" : ""} ${isFocused ? "is-highlighted" : ""}"
            role="option"
            aria-selected="${isSelected ? "true" : "false"}"
            data-format-id="${escapeHtml(fmt.id)}"
            title="${escapeHtml(`${fmt.name} \u2014 ${desc}`)}"
          >
            <span class="format-picker-option-top">
              <span class="format-picker-ext">${escapeHtml(fmt.label)}</span>
              ${isSelected ? `<svg class="format-picker-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ""}
            </span>
            <span class="format-picker-option-hint">${escapeHtml(desc)}</span>
          </button>
        `;
    }).join("");
    const previewTarget = filtered[this.activeOptionIndex]?.id ?? filtered.find((f) => f.id.toLowerCase() === this.currentTargetId)?.id ?? filtered[0]?.id ?? null;
    this.updateFooterPreview(previewTarget);
  }
  updateFooterPreview(formatId) {
    const titleEl = this.popoverEl?.querySelector(".format-picker-desc-title");
    const bodyEl = this.popoverEl?.querySelector(".format-picker-desc-body");
    if (!titleEl || !bodyEl) return;
    if (!formatId) {
      titleEl.textContent = "";
      bodyEl.textContent = "Try another keyword or switch to All";
      return;
    }
    const fmt = this.formats.find((f) => f.id.toLowerCase() === formatId.toLowerCase());
    if (!fmt) return;
    titleEl.textContent = fmt.name;
    bodyEl.textContent = fmt.description || `${fmt.label} output format`;
  }
  handleKeyNavigation(e) {
    if (!this.popoverEl) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close(true);
      return;
    }
    const options = Array.from(
      this.popoverEl.querySelectorAll(".format-picker-option")
    );
    if (options.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 3 : 1;
      this.activeOptionIndex = Math.min(options.length - 1, this.activeOptionIndex + step);
      this.syncHighlightedOption(options);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowUp" ? 3 : 1;
      this.activeOptionIndex = Math.max(0, this.activeOptionIndex - step);
      this.syncHighlightedOption(options);
      return;
    }
    if (e.key === "Enter") {
      const targetOption = options[this.activeOptionIndex] ?? options[0];
      const formatId = targetOption?.dataset.formatId;
      if (formatId) {
        e.preventDefault();
        this.commitSelection(formatId);
      }
    }
  }
  syncHighlightedOption(options) {
    options.forEach((opt, i) => {
      opt.classList.toggle("is-highlighted", i === this.activeOptionIndex);
    });
    const active = options[this.activeOptionIndex];
    if (active) {
      active.scrollIntoView({ block: "nearest" });
      const fmtId = active.dataset.formatId;
      if (fmtId) this.updateFooterPreview(fmtId);
    }
  }
  commitSelection(targetFormatId) {
    const itemId = this.activeItemId;
    const trigger = this.activeTrigger;
    const cb = this.onSelectCallback;
    if (trigger) {
      const fmt = this.formats.find((f) => f.id.toLowerCase() === targetFormatId.toLowerCase());
      const labelEl = trigger.querySelector(".format-picker-trigger-label");
      if (labelEl && fmt) {
        labelEl.textContent = fmt.label;
      }
      trigger.dataset.targetId = targetFormatId;
      const wrap = trigger.closest(".format-picker-wrap");
      const siblingSelect = wrap?.parentElement?.querySelector(
        `select[data-action="target"][data-id="${itemId ?? ""}"]`
      );
      if (siblingSelect && siblingSelect.value !== targetFormatId) {
        siblingSelect.value = targetFormatId;
      }
    }
    this.close(true);
    if (itemId && cb) {
      cb(itemId, targetFormatId);
    }
  }
  positionPopover() {
    if (!this.popoverEl || !this.activeTrigger) return;
    const triggerRect = this.activeTrigger.getBoundingClientRect();
    const popRect = this.popoverEl.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 6;
    const margin = 12;
    const popWidth = Math.min(popRect.width || 360, viewportW - margin * 2);
    const popHeight = popRect.height || 340;
    let left = triggerRect.left;
    if (left + popWidth > viewportW - margin) {
      left = Math.max(margin, triggerRect.right - popWidth);
    }
    left = Math.max(margin, Math.min(left, viewportW - popWidth - margin));
    const spaceBelow = viewportH - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    let top;
    if (spaceBelow >= popHeight || spaceBelow >= spaceAbove) {
      top = Math.min(triggerRect.bottom + gap, viewportH - popHeight - margin);
      this.popoverEl.dataset.placement = "bottom";
    } else {
      top = Math.max(margin, triggerRect.top - popHeight - gap);
      this.popoverEl.dataset.placement = "top";
    }
    this.popoverEl.style.left = `${Math.round(left)}px`;
    this.popoverEl.style.top = `${Math.round(top)}px`;
  }
  bindGlobalEvents() {
    this.globalAbortController = new AbortController();
    const { signal } = this.globalAbortController;
    document.addEventListener(
      "pointerdown",
      (e) => {
        const target = e.target;
        if (!target) return;
        if (this.popoverEl?.contains(target)) return;
        if (this.activeTrigger?.contains(target)) return;
        this.close(false);
      },
      { capture: true, signal }
    );
    window.addEventListener(
      "resize",
      () => {
        if (!this.activeTrigger?.isConnected) {
          this.close(false);
          return;
        }
        this.positionPopover();
      },
      { signal }
    );
    window.addEventListener(
      "scroll",
      (e) => {
        if (this.popoverEl && e.target instanceof Node && this.popoverEl.contains(e.target)) {
          return;
        }
        if (!this.activeTrigger?.isConnected) {
          this.close(false);
          return;
        }
        this.positionPopover();
      },
      { capture: true, signal }
    );
  }
};
var sharedPopover = new FormatPickerPopover();
function attachFormatPickerListeners(container, onSelect) {
  const prev = containerAbortControllers.get(container);
  if (prev) {
    prev.abort();
  }
  const controller = new AbortController();
  containerAbortControllers.set(container, controller);
  container.addEventListener(
    "click",
    (e) => {
      const trigger = e.target.closest(
        '[data-action="open-format-picker"], .format-picker-trigger'
      );
      if (!trigger || !container.contains(trigger)) return;
      if (trigger.disabled || trigger.getAttribute("aria-disabled") === "true") return;
      const itemId = trigger.dataset.itemId ?? trigger.dataset.id ?? "";
      if (!itemId) return;
      const currentTargetId = trigger.dataset.targetId ?? "";
      const formats = formatRegistryByItem.get(itemId) ?? parseFormatsAttribute(trigger.dataset.formats);
      sharedPopover.open(trigger, itemId, currentTargetId, formats, onSelect);
    },
    { signal: controller.signal }
  );
}

// src/client/ui/app.ts
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "webp", "avif", "gif", "bmp", "ico", "svg"]);
var TEXT_TARGET_IDS = /* @__PURE__ */ new Set([
  "json",
  "csv",
  "tsv",
  "yaml",
  "xml",
  "toml",
  "ini",
  "env",
  "sql",
  "md",
  "html",
  "txt"
]);
function escapeHtml2(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function computeSizeDelta(inputBytes, outputBytes) {
  const pct = (outputBytes - inputBytes) / Math.max(1, inputBytes) * 100;
  const rounded = Math.round(pct);
  const pctStr = rounded <= 0 ? `${rounded}%` : `+${rounded}%`;
  const savingsLabel = rounded < 0 ? `Saved ${Math.abs(rounded)}%` : rounded === 0 ? "Same size" : `+${rounded}% larger`;
  return { pct, pctStr, savingsLabel, isSmaller: rounded <= 0 };
}
function isBusyStatus(status) {
  return status === "inspecting" || status === "queued-local" || status === "processing-local" || status === "uploading-server" || status === "queued-server" || status === "processing-server";
}
function sanitizeStageMessage(status, rawMessage) {
  if (status === "pending") return "Ready to convert";
  if (status === "queued-local" || status === "queued-server") return "Waiting in queue...";
  if (status === "uploading-server") return "Preparing conversion...";
  if (status === "processing-server") return "Converting file...";
  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Conversion failed";
  if (!rawMessage) return "Converting...";
  return rawMessage.replace(/Server Fallback\s*\([^)]*\)/gi, "cloud engine").replace(/server lane[:\s]*\w+/gi, "processing queue").replace(/LOCAL_\w+/g, "browser");
}
function statusBadgeMeta(item) {
  if (isBusyStatus(item.status)) {
    return {
      label: `Converting... ${Math.round(item.progressPercent)}%`,
      pillClass: "server",
      inlineStyle: "cursor:default;"
    };
  }
  if (item.status === "completed" && item.output) {
    const { pctStr } = computeSizeDelta(item.file.size, item.output.bytes.length);
    return {
      label: `Done \xB7 ${pctStr}`,
      pillClass: "local",
      inlineStyle: "cursor:default;"
    };
  }
  if (item.status === "failed") {
    return {
      label: "Failed",
      pillClass: "",
      inlineStyle: "cursor:default;background:var(--accent-danger-bg);color:var(--accent-danger);border:1px solid var(--accent-danger-border);"
    };
  }
  if (item.status === "cancelled") {
    return {
      label: "Cancelled",
      pillClass: "",
      inlineStyle: "cursor:default;background:var(--surface-muted);color:var(--text-muted);border:1px solid var(--border);"
    };
  }
  return {
    label: "Ready",
    pillClass: "",
    inlineStyle: "cursor:default;background:var(--surface-muted);color:var(--text-secondary);border:1px solid var(--border);"
  };
}
function loadImageDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(
        img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null
      );
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
var OmniConvertApp = class {
  router = new ConversionRouter();
  serverClient = new ServerFallbackClient();
  device;
  workerPool;
  items = [];
  completedCount = 0;
  bytesProcessed = 0;
  tempPreviewUrls = [];
  dropzone = document.getElementById("dropzone");
  fileInput = document.getElementById("file-input");
  queueList = document.getElementById("queue-list");
  batchToolbar = document.getElementById("batch-toolbar");
  tierOverview = document.getElementById("tier-overview");
  heroHeader = document.getElementById("hero-header");
  queueCountLabel = document.getElementById("queue-count-label");
  queueRouteBreakdown = document.getElementById("queue-route-breakdown");
  downloadZipBtn = document.getElementById("download-zip-btn");
  batchTargetSelect = document.getElementById("batch-target-select");
  previewBackdrop = document.getElementById("preview-backdrop");
  previewTitle = document.getElementById("preview-title");
  previewBody = document.getElementById("preview-body");
  pasteModalBackdrop = document.getElementById("paste-modal-backdrop");
  formatsModalBackdrop = document.getElementById("formats-modal-backdrop");
  formatsExplorerList = document.getElementById("formats-explorer-list");
  async init() {
    this.initTheme();
    this.device = await DeviceProfiler.detect();
    this.workerPool = new WorkerPool(this.device.hardwareConcurrency);
    this.renderLandingCategoryTabs("image");
    this.populateBatchTargetDropdown();
    this.updateTopCounters();
    this.bindEvents();
  }
  initTheme() {
    const saved = localStorage.getItem("omniconvert-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    this.updateThemeIcons(theme);
  }
  updateThemeIcons(theme) {
    const moon = document.getElementById("theme-icon-moon");
    const sun = document.getElementById("theme-icon-sun");
    if (theme === "dark") {
      moon?.classList.add("hidden");
      sun?.classList.remove("hidden");
    } else {
      moon?.classList.remove("hidden");
      sun?.classList.add("hidden");
    }
  }
  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("omniconvert-theme", next);
    this.updateThemeIcons(next);
  }
  openPasteModal() {
    this.pasteModalBackdrop?.classList.remove("hidden");
    const textarea = document.getElementById("paste-textarea");
    textarea?.focus();
  }
  closePasteModal() {
    this.pasteModalBackdrop?.classList.add("hidden");
  }
  closePreviewModal() {
    this.previewBackdrop?.classList.add("hidden");
    if (this.previewBody) {
      this.previewBody.innerHTML = "";
    }
    for (const url of this.tempPreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.tempPreviewUrls = [];
  }
  bindEvents() {
    document.getElementById("theme-toggle-btn")?.addEventListener("click", () => this.toggleTheme());
    document.getElementById("browse-files-btn")?.addEventListener("click", () => {
      this.fileInput?.click();
    });
    this.fileInput?.addEventListener("change", () => {
      if (this.fileInput?.files && this.fileInput.files.length > 0) {
        void this.ingestFiles(Array.from(this.fileInput.files));
        this.fileInput.value = "";
      }
    });
    document.getElementById("load-demo-btn")?.addEventListener("click", async () => {
      const btn = document.getElementById("load-demo-btn");
      if (!btn) return;
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = "Generating sample batch...";
      try {
        const files = await createDemoSampleFiles();
        await this.ingestFiles(files);
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
    document.getElementById("paste-text-btn")?.addEventListener("click", () => this.openPasteModal());
    document.getElementById("paste-text-btn-hero")?.addEventListener("click", () => this.openPasteModal());
    document.getElementById("close-paste-modal-btn")?.addEventListener("click", () => this.closePasteModal());
    document.getElementById("cancel-paste-btn")?.addEventListener("click", () => this.closePasteModal());
    this.pasteModalBackdrop?.addEventListener("click", (e) => {
      if (e.target === this.pasteModalBackdrop) this.closePasteModal();
    });
    document.getElementById("paste-source-format")?.addEventListener("change", (e) => {
      const ext = e.target.value;
      const nameInput = document.getElementById("paste-filename");
      if (nameInput && /^snippet(\.[a-z0-9]+)?$/i.test(nameInput.value.trim())) {
        nameInput.value = `snippet.${ext}`;
      }
    });
    document.getElementById("add-paste-btn")?.addEventListener("click", () => {
      const textarea = document.getElementById("paste-textarea");
      const fmtSelect = document.getElementById("paste-source-format");
      const nameInput = document.getElementById("paste-filename");
      const text = textarea?.value.trim() ?? "";
      if (!text) return;
      const ext = fmtSelect?.value ?? "txt";
      const name = nameInput?.value.trim() || `snippet.${ext}`;
      const blob = new Blob([text], { type: "text/plain" });
      const file = new File([blob], name, { type: "text/plain" });
      void this.ingestFiles([file]);
      if (textarea) textarea.value = "";
      this.closePasteModal();
    });
    document.getElementById("open-formats-btn")?.addEventListener("click", () => {
      this.renderFormatsExplorer();
      this.formatsModalBackdrop?.classList.remove("hidden");
    });
    document.getElementById("close-formats-modal-btn")?.addEventListener("click", () => {
      this.formatsModalBackdrop?.classList.add("hidden");
    });
    this.formatsModalBackdrop?.addEventListener("click", (e) => {
      if (e.target === this.formatsModalBackdrop) {
        this.formatsModalBackdrop?.classList.add("hidden");
      }
    });
    document.getElementById("formats-search-input")?.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      this.renderFormatsExplorer(query);
    });
    if (this.dropzone) {
      ["dragenter", "dragover"].forEach((evtName) => {
        this.dropzone?.addEventListener(evtName, (e) => {
          e.preventDefault();
          this.dropzone?.classList.add("drag-active");
        });
      });
      ["dragleave", "drop"].forEach((evtName) => {
        this.dropzone?.addEventListener(evtName, (e) => {
          e.preventDefault();
          this.dropzone?.classList.remove("drag-active");
        });
      });
      this.dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt?.files && dt.files.length > 0) {
          void this.ingestFiles(Array.from(dt.files));
        }
      });
    }
    document.getElementById("convert-all-btn")?.addEventListener("click", () => {
      void this.convertAllReady();
    });
    document.getElementById("clear-completed-btn")?.addEventListener("click", () => {
      for (const item of this.items) {
        if (item.status === "completed" || item.status === "cancelled") {
          if (item.output?.objectUrl) URL.revokeObjectURL(item.output.objectUrl);
          if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        }
      }
      this.items = this.items.filter((i) => i.status !== "completed" && i.status !== "cancelled");
      this.renderQueue();
    });
    this.downloadZipBtn?.addEventListener("click", () => {
      void this.downloadAllAsZip();
    });
    this.batchTargetSelect?.addEventListener("change", () => {
      const target = this.batchTargetSelect?.value;
      if (!target) return;
      for (const item of this.items) {
        if (isBusyStatus(item.status)) continue;
        const compatible = getCompatibleTargets(item.sourceFormat);
        if (compatible.some((f) => f.id === target)) {
          item.targetFormat = target;
          item.presetId = "";
          this.resetCompletedItemForReconvert(item);
          this.recomputeRouting(item);
        }
      }
      if (this.batchTargetSelect) this.batchTargetSelect.value = "";
      this.renderQueue();
    });
    document.getElementById("landing-category-tabs")?.addEventListener("click", (e) => {
      const target = e.target.closest(".tab-btn");
      if (!target) return;
      document.querySelectorAll("#landing-category-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
      target.classList.add("active");
      const cat = target.dataset.cat;
      this.renderLandingCategoryTabs(cat);
    });
    document.getElementById("close-preview-btn")?.addEventListener("click", () => {
      this.closePreviewModal();
    });
    this.previewBackdrop?.addEventListener("click", (e) => {
      if (e.target === this.previewBackdrop) {
        this.closePreviewModal();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.previewBackdrop && !this.previewBackdrop.classList.contains("hidden")) {
        this.closePreviewModal();
      } else if (this.pasteModalBackdrop && !this.pasteModalBackdrop.classList.contains("hidden")) {
        this.closePasteModal();
      } else if (this.formatsModalBackdrop && !this.formatsModalBackdrop.classList.contains("hidden")) {
        this.formatsModalBackdrop.classList.add("hidden");
      }
    });
  }
  renderLandingCategoryTabs(category) {
    const container = document.getElementById("landing-format-chips");
    if (!container) return;
    const formats = CLIENT_FORMATS.filter((f) => f.category === category);
    container.innerHTML = formats.map(
      (f) => `
          <div class="format-chip">
            <strong>${escapeHtml2(f.label)}</strong>
            <span>${escapeHtml2(f.name)}</span>
          </div>
        `
    ).join("");
  }
  populateBatchTargetDropdown() {
    if (!this.batchTargetSelect) return;
    const popular = ["png", "jpg", "webp", "mp3", "wav", "json", "csv", "yaml", "pdf", "zip"];
    this.batchTargetSelect.innerHTML = `<option value="">Set all compatible to...</option>` + popular.map((id) => {
      const fmt = getFormatById(id);
      return `<option value="${id}">${fmt ? fmt.label : id.toUpperCase()}</option>`;
    }).join("");
  }
  renderFormatsExplorer(query = "") {
    const listEl = this.formatsExplorerList;
    if (!listEl) return;
    const filtered = CLIENT_FORMATS.filter((f) => {
      if (!query) return true;
      return f.id.includes(query) || f.name.toLowerCase().includes(query) || f.category.includes(query);
    });
    const categoryLabels = {
      image: "Image",
      audio: "Audio",
      video: "Video",
      data: "Data",
      document: "Document",
      ebook: "E-Book",
      archive: "Archive",
      font: "Font",
      vector: "Vector",
      cad: "CAD"
    };
    listEl.innerHTML = filtered.map(
      (f) => `
          <div class="format-row-item">
            <div>
              <strong>${escapeHtml2(f.label)}</strong> <span class="muted">(${escapeHtml2(f.mimeType)})</span>
              <div class="muted">${escapeHtml2(f.name)} \u2014 ${escapeHtml2(f.description)}</div>
            </div>
            <span class="fmt-pill">${escapeHtml2(categoryLabels[f.category] ?? f.category)}</span>
          </div>
        `
    ).join("");
  }
  updateTopCounters() {
    const el = document.getElementById("stats-counter-text");
    if (!el) return;
    if (this.completedCount === 0) {
      el.textContent = "Ready";
      return;
    }
    el.textContent = `${this.completedCount} converted \xB7 ${formatBytes(this.bytesProcessed)} processed`;
  }
  async ingestFiles(files) {
    for (const file of files) {
      const headerBuf = await file.slice(0, 512).arrayBuffer();
      const headerBytes = new Uint8Array(headerBuf);
      const magic = inspectFileMagicBytes(headerBytes, file.name);
      const sourceFormat = magic.detectedFormatId ?? "txt";
      const targetFormat = getDefaultTargetForSource(sourceFormat);
      const options = {
        quality: 85,
        stripMetadata: true,
        forceExecutionMode: "AUTO",
        autoDeleteServerFile: true
      };
      const routing = this.evaluateRoute(file, headerBytes, sourceFormat, targetFormat, options);
      let thumbnailUrl;
      if (file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(sourceFormat)) {
        thumbnailUrl = URL.createObjectURL(file);
      }
      this.items.push({
        id: crypto.randomUUID(),
        file,
        headerBytes,
        magic,
        sourceFormat,
        targetFormat,
        presetId: "",
        options,
        routing,
        status: "pending",
        progressPercent: 0,
        stageMessage: "Ready to convert",
        expandedSettings: false,
        thumbnailUrl
      });
    }
    this.renderQueue();
  }
  evaluateRoute(file, headerBytes, sourceFormat, targetFormat, options) {
    const autoOptions = {
      ...options,
      forceExecutionMode: "AUTO",
      autoDeleteServerFile: true
    };
    return this.router.route(
      { name: file.name, sizeBytes: file.size, headerBytes },
      sourceFormat,
      targetFormat,
      autoOptions,
      this.device
    );
  }
  resetCompletedItemForReconvert(item) {
    if (item.status === "completed" || item.status === "cancelled" || item.status === "failed") {
      if (item.output?.objectUrl) {
        URL.revokeObjectURL(item.output.objectUrl);
      }
      item.output = void 0;
      item.durationMs = void 0;
      item.errorMessage = void 0;
      item.status = "pending";
      item.progressPercent = 0;
      item.stageMessage = "Ready to convert";
    }
  }
  recomputeRouting(item) {
    item.options = {
      ...item.options,
      forceExecutionMode: "AUTO",
      autoDeleteServerFile: true
    };
    item.routing = this.evaluateRoute(
      item.file,
      item.headerBytes,
      item.sourceFormat,
      item.targetFormat,
      item.options
    );
    if (item.status === "pending" || item.status === "failed") {
      item.status = "pending";
      item.progressPercent = 0;
      item.errorMessage = void 0;
      item.stageMessage = "Ready to convert";
    }
  }
  renderQueue() {
    const hasItems = this.items.length > 0;
    this.batchToolbar?.classList.toggle("hidden", !hasItems);
    this.tierOverview?.classList.toggle("hidden", hasItems);
    this.heroHeader?.classList.toggle("compact", hasItems);
    this.dropzone?.classList.toggle("compact", hasItems);
    if (!this.queueList) return;
    if (!hasItems) {
      this.queueList.innerHTML = "";
      return;
    }
    const completedCount = this.items.filter((i) => i.status === "completed" && i.output).length;
    const busyCount = this.items.filter((i) => isBusyStatus(i.status)).length;
    if (this.queueCountLabel) {
      this.queueCountLabel.textContent = `${this.items.length} file${this.items.length === 1 ? "" : "s"}`;
    }
    if (this.queueRouteBreakdown) {
      if (completedCount === this.items.length) {
        this.queueRouteBreakdown.textContent = `All ${completedCount} converted`;
      } else if (busyCount > 0) {
        this.queueRouteBreakdown.textContent = `Converting ${busyCount} \xB7 ${completedCount} done`;
      } else if (completedCount > 0) {
        this.queueRouteBreakdown.textContent = `${completedCount} of ${this.items.length} converted`;
      } else {
        this.queueRouteBreakdown.textContent = "Ready to convert";
      }
    }
    this.downloadZipBtn?.classList.toggle("hidden", completedCount < 2);
    this.queueList.innerHTML = this.items.map((item) => this.renderJobCard(item)).join("");
    this.attachCardListeners();
  }
  renderTargetSelectOptions(sourceFormat, selectedTarget) {
    const compatible = getCompatibleTargets(sourceFormat);
    const byCategory = /* @__PURE__ */ new Map();
    for (const fmt of compatible) {
      const list = byCategory.get(fmt.category) ?? [];
      list.push(fmt);
      byCategory.set(fmt.category, list);
    }
    const categoryLabels = {
      image: "Image",
      audio: "Audio",
      video: "Video",
      data: "Structured Data",
      document: "Document & Markup",
      ebook: "E-Book",
      archive: "Archive",
      font: "Font",
      vector: "Vector",
      cad: "CAD"
    };
    return Array.from(byCategory.entries()).map(([cat, fmts]) => {
      const opts = fmts.map(
        (f) => `<option value="${escapeHtml2(f.id)}" ${f.id === selectedTarget ? "selected" : ""}>${escapeHtml2(f.label)} \u2014 ${escapeHtml2(f.name)}</option>`
      ).join("");
      return `<optgroup label="${escapeHtml2(categoryLabels[cat] ?? cat)}">${opts}</optgroup>`;
    }).join("");
  }
  renderContextualOptions(item) {
    const srcCat = getFormatById(item.sourceFormat)?.category;
    const tgt = item.targetFormat;
    const parts = [];
    if (["png", "jpg", "webp", "avif", "bmp", "ico"].includes(tgt) || srcCat === "image" && tgt !== "pdf") {
      if (["jpg", "webp", "avif"].includes(tgt)) {
        parts.push(`
          <label class="opt-field">
            <span>Quality: <strong data-quality-label="${item.id}">${item.options.quality ?? 85}%</strong></span>
            <input type="range" min="10" max="100" value="${item.options.quality ?? 85}" data-opt="quality" data-id="${item.id}" />
          </label>
        `);
      }
      parts.push(`
        <label class="opt-field">
          <span>Width (px)</span>
          <input type="number" placeholder="Auto" min="16" max="8192" value="${item.options.width ?? ""}" data-opt="width" data-id="${item.id}" />
        </label>
        <label class="opt-field">
          <span>Height (px)</span>
          <input type="number" placeholder="Auto" min="16" max="8192" value="${item.options.height ?? ""}" data-opt="height" data-id="${item.id}" />
        </label>
        <label class="opt-field">
          <input type="checkbox" ${item.options.stripMetadata !== false ? "checked" : ""} data-opt="stripMetadata" data-id="${item.id}" />
          <span>Strip EXIF metadata</span>
        </label>
      `);
    } else if (srcCat === "audio" || tgt === "wav" || tgt === "mp3" || tgt === "ogg" || tgt === "flac" || tgt === "aac") {
      parts.push(`
        <label class="opt-field">
          <span>Sample Rate</span>
          <select data-opt="sampleRate" data-id="${item.id}">
            <option value="" ${!item.options.sampleRate ? "selected" : ""}>Original</option>
            <option value="44100" ${item.options.sampleRate === 44100 ? "selected" : ""}>44.1 kHz</option>
            <option value="48000" ${item.options.sampleRate === 48e3 ? "selected" : ""}>48 kHz</option>
            <option value="16000" ${item.options.sampleRate === 16e3 ? "selected" : ""}>16 kHz Voice</option>
          </select>
        </label>
        <label class="opt-field">
          <span>Channels</span>
          <select data-opt="channels" data-id="${item.id}">
            <option value="" ${!item.options.channels ? "selected" : ""}>Auto</option>
            <option value="2" ${item.options.channels === 2 ? "selected" : ""}>Stereo</option>
            <option value="1" ${item.options.channels === 1 ? "selected" : ""}>Mono</option>
          </select>
        </label>
        <label class="opt-field">
          <input type="checkbox" ${item.options.normalizeAudio ? "checked" : ""} data-opt="normalizeAudio" data-id="${item.id}" />
          <span>Normalize (-1 dB)</span>
        </label>
      `);
    } else if (srcCat === "data" || TEXT_TARGET_IDS.has(tgt)) {
      if (["json", "xml", "yaml", "toml", "html"].includes(tgt) || srcCat === "data") {
        parts.push(`
          <label class="opt-field">
            <span>Indentation</span>
            <select data-opt="indentSpaces" data-id="${item.id}">
              <option value="2" ${(item.options.indentSpaces ?? 2) === 2 ? "selected" : ""}>2 spaces</option>
              <option value="4" ${item.options.indentSpaces === 4 ? "selected" : ""}>4 spaces</option>
              <option value="0" ${item.options.indentSpaces === 0 ? "selected" : ""}>Minified</option>
            </select>
          </label>
        `);
      }
      if (item.sourceFormat === "csv" || tgt === "csv") {
        parts.push(`
          <label class="opt-field">
            <span>CSV Delimiter</span>
            <select data-opt="csvDelimiter" data-id="${item.id}">
              <option value="," ${(item.options.csvDelimiter ?? ",") === "," ? "selected" : ""}>Comma (,)</option>
              <option value=";" ${item.options.csvDelimiter === ";" ? "selected" : ""}>Semicolon (;)</option>
              <option value="&#9;" ${item.options.csvDelimiter === "	" ? "selected" : ""}>Tab (\\t)</option>
              <option value="|" ${item.options.csvDelimiter === "|" ? "selected" : ""}>Pipe (|)</option>
            </select>
          </label>
        `);
      }
      if (tgt === "sql") {
        parts.push(`
          <label class="opt-field">
            <span>SQL Table</span>
            <input type="text" value="${escapeHtml2(item.options.sqlTableName ?? "records")}" data-opt="sqlTableName" data-id="${item.id}" style="width:120px" />
          </label>
        `);
      }
    }
    if (tgt === "pdf" || srcCat === "document") {
      parts.push(`
        <label class="opt-field">
          <span>Page Size</span>
          <select data-opt="pageSize" data-id="${item.id}">
            <option value="A4" ${(item.options.pageSize ?? "A4") === "A4" ? "selected" : ""}>A4</option>
            <option value="Letter" ${item.options.pageSize === "Letter" ? "selected" : ""}>Letter</option>
          </select>
        </label>
      `);
    }
    return parts.length > 0 ? `<div class="settings-row">${parts.join("")}</div>` : `<div class="muted">No additional options for ${escapeHtml2(tgt.toUpperCase())}.</div>`;
  }
  renderJobCard(item) {
    const srcDef = getFormatById(item.sourceFormat);
    const category = srcDef?.category ?? "document";
    const presets = getPresetsForCategory(category);
    const compatibleFormats = getCompatibleTargets(item.sourceFormat);
    const badge = statusBadgeMeta(item);
    const isBusy = isBusyStatus(item.status);
    let deltaBadge = "";
    if (item.status === "completed" && item.output) {
      const { pct, pctStr } = computeSizeDelta(item.file.size, item.output.bytes.length);
      const timing = item.durationMs !== void 0 ? ` \xB7 ${item.durationMs}ms` : "";
      deltaBadge = `<span class="delta-text ${pct > 0 ? "larger" : ""}">${formatBytes(item.output.bytes.length)} (${pctStr})${timing}</span>`;
    }
    const fileIconSvg = item.thumbnailUrl ? `<img src="${item.thumbnailUrl}" alt="" />` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
    return `
      <article class="job-card status-${item.status}" data-job-id="${item.id}">
        <div class="progress-line-track">
          <div class="progress-line-fill" style="width: ${item.progressPercent}%"></div>
        </div>
        <div class="job-main-row">
          <div class="job-file-col">
            <div class="file-thumb" aria-hidden="true">${fileIconSvg}</div>
            <div class="file-meta-col">
              <span class="file-name" title="${escapeHtml2(item.file.name)}">${escapeHtml2(item.file.name)}</span>
              <div class="file-subline">
                <span>${formatBytes(item.file.size)}</span>
                <span class="fmt-pill ${item.magic.isSpoofedOrMismatched ? "spoof" : ""}">${escapeHtml2(item.sourceFormat)}</span>
              </div>
            </div>
          </div>
          <div class="job-convert-col">
            <span class="arrow-muted" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </span>
            ${createFormatPickerTriggerHtml(item.id, item.targetFormat, compatibleFormats)}
            ${presets.length > 0 ? `
              <select class="preset-select" data-action="preset" data-id="${item.id}" ${isBusy ? "disabled" : ""}>
                <option value="">Preset...</option>
                ${presets.map((p) => `<option value="${escapeHtml2(p.id)}" ${item.presetId === p.id ? "selected" : ""}>${escapeHtml2(p.name)}</option>`).join("")}
              </select>` : ""}
            <button type="button" class="settings-toggle-btn ${item.expandedSettings ? "active" : ""}" data-action="toggle-settings" data-id="${item.id}" title="Conversion settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
          <div class="job-actions-col">
            <span class="route-pill ${badge.pillClass}" data-status-pill style="${badge.inlineStyle}">
              ${escapeHtml2(badge.label)}
            </span>
            ${deltaBadge}
            ${isBusy ? `<button type="button" class="btn btn-xs btn-danger" data-action="cancel" data-id="${item.id}">Cancel</button>` : item.status === "completed" && item.output ? `
                    <button type="button" class="btn btn-xs btn-ghost" data-action="preview" data-id="${item.id}">Preview</button>
                    <a class="btn btn-xs btn-success" href="${item.output.objectUrl}" download="${escapeHtml2(item.output.filename)}">Download</a>
                  ` : `<button type="button" class="btn btn-xs btn-primary" data-action="convert" data-id="${item.id}">Convert</button>`}
            <button type="button" class="icon-btn" data-action="remove" data-id="${item.id}" title="Remove file" style="width:28px;height:28px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        ${item.expandedSettings ? `<div class="job-settings-drawer">${this.renderContextualOptions(item)}</div>` : ""}
        ${item.errorMessage ? `<div class="inline-alert error">${escapeHtml2(item.errorMessage)}</div>` : ""}
        <div class="job-progress-bar">
          <span>${escapeHtml2(item.stageMessage)}</span>
          <span>${Math.round(item.progressPercent)}%</span>
        </div>
      </article>
    `;
  }
  attachCardListeners() {
    if (!this.queueList) return;
    attachFormatPickerListeners(this.queueList, (itemId, targetFormatId) => {
      const item = this.items.find((i) => i.id === itemId);
      if (!item) return;
      item.targetFormat = targetFormatId;
      item.presetId = "";
      this.resetCompletedItemForReconvert(item);
      this.recomputeRouting(item);
      this.renderQueue();
    });
    this.queueList.querySelectorAll('button[data-action="toggle-settings"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (!item) return;
        item.expandedSettings = !item.expandedSettings;
        this.renderQueue();
      });
    });
    this.queueList.querySelectorAll('select[data-action="target"]').forEach((el) => {
      el.addEventListener("change", () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        item.targetFormat = el.value;
        item.presetId = "";
        this.resetCompletedItemForReconvert(item);
        this.recomputeRouting(item);
        this.renderQueue();
      });
    });
    this.queueList.querySelectorAll('select[data-action="preset"]').forEach((el) => {
      el.addEventListener("change", () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        const cat = getFormatById(item.sourceFormat)?.category ?? "document";
        const preset = getPresetsForCategory(cat).find((p) => p.id === el.value);
        item.presetId = el.value;
        if (preset) {
          item.targetFormat = preset.targetFormat;
          item.options = {
            ...preset.options,
            forceExecutionMode: "AUTO",
            autoDeleteServerFile: true
          };
        }
        this.resetCompletedItemForReconvert(item);
        this.recomputeRouting(item);
        this.renderQueue();
      });
    });
    this.queueList.querySelectorAll('input[type="range"][data-opt="quality"]').forEach((el) => {
      el.addEventListener("input", () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        const q = Number(el.value);
        item.options.quality = q;
        const label = this.queueList?.querySelector(`[data-quality-label="${item.id}"]`);
        if (label) label.textContent = `${q}%`;
      });
    });
    this.queueList.querySelectorAll("[data-opt]").forEach((el) => {
      el.addEventListener("change", () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        const key = el.dataset.opt;
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          item.options[key] = el.checked;
        } else if (el instanceof HTMLInputElement && (el.type === "number" || el.type === "range")) {
          item.options[key] = el.value ? Number(el.value) : void 0;
        } else if (el instanceof HTMLSelectElement) {
          const val = el.value;
          item.options[key] = key === "sampleRate" || key === "channels" || key === "indentSpaces" ? val !== "" ? Number(val) : void 0 : val || void 0;
        } else if (el instanceof HTMLInputElement) {
          item.options[key] = el.value;
        }
        this.resetCompletedItemForReconvert(item);
        this.renderQueue();
      });
    });
    this.queueList.querySelectorAll('button[data-action="convert"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item) void this.runItem(item);
      });
    });
    this.queueList.querySelectorAll('button[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item?.abortController) {
          item.abortController.abort();
        }
      });
    });
    this.queueList.querySelectorAll('button[data-action="preview"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item) void this.openPreview(item);
      });
    });
    this.queueList.querySelectorAll('button[data-action="remove"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item?.abortController) item.abortController.abort();
        if (item?.output?.objectUrl) URL.revokeObjectURL(item.output.objectUrl);
        if (item?.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        this.items = this.items.filter((i) => i.id !== btn.dataset.id);
        this.renderQueue();
      });
    });
  }
  async convertAllReady() {
    const ready = this.items.filter((i) => i.status === "pending" || i.status === "failed");
    await Promise.all(ready.map((item) => this.runItem(item)));
  }
  async runItem(item) {
    if (item.output?.objectUrl) {
      URL.revokeObjectURL(item.output.objectUrl);
      item.output = void 0;
    }
    item.options = {
      ...item.options,
      forceExecutionMode: "AUTO",
      autoDeleteServerFile: true
    };
    item.errorMessage = void 0;
    item.abortController = new AbortController();
    const signal = item.abortController.signal;
    const startedAt = performance.now();
    try {
      if (item.routing.isLocal) {
        item.status = "queued-local";
        item.progressPercent = 5;
        item.stageMessage = "Waiting in queue...";
        this.renderQueue();
        try {
          const result = await this.workerPool.enqueue({
            id: item.id,
            inputBytes: item.file.size,
            isHeavyWasm: item.routing.selectedTier === "LOCAL_WASM",
            signal,
            onProgress: (pct, msg) => {
              item.status = "processing-local";
              item.progressPercent = pct;
              item.stageMessage = sanitizeStageMessage("processing-local", msg);
              this.updateCardProgressOnly(item);
            },
            executor: async (ctx) => {
              item.status = "processing-local";
              this.updateCardProgressOnly(item);
              return executeLocalConversion({
                file: item.file,
                filename: item.file.name,
                sourceFormat: item.sourceFormat,
                targetFormat: item.targetFormat,
                engineId: item.routing.selectedEngine,
                options: item.options,
                onProgress: ctx.reportProgress,
                signal: ctx.signal
              });
            }
          });
          const objectUrl2 = URL.createObjectURL(result.blob);
          item.output = {
            blob: result.blob,
            bytes: result.bytes,
            filename: result.filename,
            mimeType: result.mimeType,
            objectUrl: objectUrl2,
            metadata: result.metadata
          };
          item.status = "completed";
          item.progressPercent = 100;
          item.durationMs = Math.round(performance.now() - startedAt);
          item.stageMessage = `Converted in ${item.durationMs}ms`;
          this.completedCount += 1;
          this.bytesProcessed += item.file.size;
          this.updateTopCounters();
          this.renderQueue();
          return;
        } catch (localErr) {
          if (localErr instanceof DOMException && localErr.name === "AbortError") {
            throw localErr;
          }
          const canEscalate = item.routing.fallbackTier === "SERVER_FALLBACK" || localErr instanceof WasmLoaderError;
          if (!canEscalate) {
            throw localErr;
          }
          const errObj = localErr instanceof Error ? localErr : new Error(String(localErr));
          item.routing = this.router.escalateFailedLocalJobToServer(item.routing, errObj);
        }
      }
      item.status = "uploading-server";
      item.progressPercent = 10;
      item.stageMessage = "Preparing conversion...";
      this.renderQueue();
      const serverRes = await this.serverClient.submitAndMonitorJob({
        file: item.file,
        filename: item.file.name,
        sourceFormat: item.sourceFormat,
        targetFormat: item.targetFormat,
        options: item.options,
        signal,
        onProgress: (upd) => {
          item.status = upd.status;
          item.progressPercent = upd.progressPercent;
          item.stageMessage = sanitizeStageMessage(upd.status, upd.stageMessage);
          this.updateCardProgressOnly(item);
        }
      });
      const objectUrl = URL.createObjectURL(serverRes.blob);
      item.output = {
        blob: serverRes.blob,
        bytes: serverRes.bytes,
        filename: serverRes.filename,
        mimeType: serverRes.mimeType,
        objectUrl
      };
      item.status = "completed";
      item.progressPercent = 100;
      item.durationMs = Math.round(performance.now() - startedAt);
      item.stageMessage = `Converted in ${item.durationMs}ms`;
      this.completedCount += 1;
      this.bytesProcessed += item.file.size;
      this.updateTopCounters();
      this.renderQueue();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        item.status = "cancelled";
        item.progressPercent = 0;
        item.stageMessage = "Cancelled";
      } else {
        item.status = "failed";
        item.errorMessage = err instanceof Error ? err.message : String(err);
        item.stageMessage = "Conversion failed";
      }
      this.renderQueue();
    }
  }
  updateCardProgressOnly(item) {
    const card = this.queueList?.querySelector(`[data-job-id="${item.id}"]`);
    if (!card) return;
    const fill = card.querySelector(".progress-line-fill");
    const pill = card.querySelector("[data-status-pill]");
    const barSpans = card.querySelectorAll(".job-progress-bar span");
    if (fill) fill.style.width = `${item.progressPercent}%`;
    if (pill && isBusyStatus(item.status)) {
      pill.textContent = `Converting... ${Math.round(item.progressPercent)}%`;
    }
    if (barSpans[0]) barSpans[0].textContent = item.stageMessage;
    if (barSpans[1]) barSpans[1].textContent = `${Math.round(item.progressPercent)}%`;
  }
  async downloadAllAsZip() {
    const completed = this.items.filter((i) => i.status === "completed" && i.output);
    if (completed.length === 0) return;
    const entries = completed.map((i) => ({
      name: i.output.filename,
      data: i.output.bytes
    }));
    const zipBytes = await createZipArchive(entries);
    const blob = new Blob([zipBytes.buffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omniconvert-batch-${Date.now()}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5e3);
  }
  async openPreview(item) {
    if (!item.output || !this.previewBody || !this.previewBackdrop || !this.previewTitle) return;
    for (const url of this.tempPreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.tempPreviewUrls = [];
    const out = item.output;
    const mime = out.mimeType;
    const { pctStr, savingsLabel, isSmaller } = computeSizeDelta(item.file.size, out.bytes.length);
    const timingLabel = item.durationMs !== void 0 ? ` \xB7 ${item.durationMs}ms` : "";
    this.previewTitle.textContent = `${out.filename} \u2014 Studio Inspector`;
    const summaryBarHtml = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--surface-muted);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:0.82rem;">
          <span class="fmt-pill">${escapeHtml2(item.sourceFormat.toUpperCase())}</span>
          <span style="color:var(--text-muted);">\u2192</span>
          <span class="fmt-pill">${escapeHtml2(item.targetFormat.toUpperCase())}</span>
          <span style="color:var(--text-secondary);font-variant-numeric:tabular-nums;">${formatBytes(item.file.size)} \u2192 <strong>${formatBytes(out.bytes.length)}</strong></span>
          <span class="route-pill ${isSmaller ? "local" : ""}" style="cursor:default;${isSmaller ? "" : "background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);"}">${escapeHtml2(savingsLabel)} (${escapeHtml2(pctStr)})${escapeHtml2(timingLabel)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;" id="preview-toolbar-actions">
          <a class="btn btn-sm btn-success" href="${out.objectUrl}" download="${escapeHtml2(out.filename)}">Download ${escapeHtml2(item.targetFormat.toUpperCase())}</a>
        </div>
      </div>
    `;
    if (mime.startsWith("image/")) {
      let origUrl = item.thumbnailUrl;
      if (!origUrl) {
        origUrl = URL.createObjectURL(item.file);
        this.tempPreviewUrls.push(origUrl);
      }
      const checkerBg = "background-color:var(--surface-muted);background-image:linear-gradient(45deg,rgba(128,128,128,0.08) 25%,transparent 25%),linear-gradient(-45deg,rgba(128,128,128,0.08) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(128,128,128,0.08) 75%),linear-gradient(-45deg,transparent 75%,rgba(128,128,128,0.08) 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;";
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--surface-hover);font-size:0.78rem;">
              <div style="display:flex;align-items:center;gap:6px;">
                <strong>Original</strong>
                <span class="fmt-pill">${escapeHtml2(item.sourceFormat.toUpperCase())}</span>
              </div>
              <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.74rem;">
                <span id="preview-orig-dims">\u2014</span> \xB7 ${formatBytes(item.file.size)}
              </span>
            </div>
            <div style="padding:14px;display:flex;align-items:center;justify-content:center;min-height:220px;${checkerBg}">
              <img src="${origUrl}" alt="Original ${escapeHtml2(item.file.name)}" style="max-width:100%;max-height:46vh;object-fit:contain;border:none;border-radius:4px;" />
            </div>
          </div>
          <div style="border:1px solid var(--accent-local-border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--accent-local-bg);font-size:0.78rem;">
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="color:var(--accent-local);">Converted</strong>
                <span class="fmt-pill">${escapeHtml2(item.targetFormat.toUpperCase())}</span>
              </div>
              <span style="color:var(--text-secondary);font-family:var(--font-mono);font-size:0.74rem;">
                <span id="preview-out-dims">${out.metadata?.width && out.metadata?.height ? `${out.metadata.width} \xD7 ${out.metadata.height}` : "\u2014"}</span> \xB7 ${formatBytes(out.bytes.length)}
              </span>
            </div>
            <div style="padding:14px;display:flex;align-items:center;justify-content:center;min-height:220px;${checkerBg}">
              <img src="${out.objectUrl}" alt="Converted ${escapeHtml2(out.filename)}" style="max-width:100%;max-height:46vh;object-fit:contain;border:none;border-radius:4px;" />
            </div>
          </div>
        </div>
      `;
      this.previewBackdrop.classList.remove("hidden");
      void Promise.all([loadImageDimensions(origUrl), loadImageDimensions(out.objectUrl)]).then(
        ([origDims, outDims]) => {
          const origEl = document.getElementById("preview-orig-dims");
          const outEl = document.getElementById("preview-out-dims");
          if (origEl && origDims) origEl.textContent = `${origDims.width} \xD7 ${origDims.height}`;
          if (outEl && outDims) outEl.textContent = `${outDims.width} \xD7 ${outDims.height}`;
        }
      );
      return;
    }
    if (mime.startsWith("audio/")) {
      const sampleRateVal = out.metadata?.sampleRate ? `${(Number(out.metadata.sampleRate) / 1e3).toFixed(1).replace(/\.0$/, "")} kHz` : item.options.sampleRate ? `${(item.options.sampleRate / 1e3).toFixed(1).replace(/\.0$/, "")} kHz` : "Original";
      const channelsVal = out.metadata?.channels === 1 || item.options.channels === 1 ? "Mono (1 ch)" : out.metadata?.channels === 2 || item.options.channels === 2 ? "Stereo (2 ch)" : "Auto";
      const durationVal = out.metadata?.durationSec !== void 0 ? `${out.metadata.durationSec}s` : "\u2014";
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:18px;background:var(--surface);display:flex;flex-direction:column;gap:16px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
            <div class="kv-item">
              <span class="kv-label">Format</span>
              <strong class="kv-val">${escapeHtml2(item.targetFormat.toUpperCase())} (${escapeHtml2(mime)})</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Sample Rate</span>
              <strong class="kv-val">${escapeHtml2(sampleRateVal)}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Channels</span>
              <strong class="kv-val">${escapeHtml2(channelsVal)}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Duration</span>
              <strong class="kv-val" id="preview-audio-duration">${escapeHtml2(durationVal)}</strong>
            </div>
          </div>
          <div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-muted);">
            <div style="font-size:0.76rem;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">
              Converted Output \u2014 ${escapeHtml2(out.filename)}
            </div>
            <audio id="preview-audio-player" controls src="${out.objectUrl}" style="width:100%"></audio>
          </div>
        </div>
      `;
      const audioEl = document.getElementById("preview-audio-player");
      audioEl?.addEventListener("loadedmetadata", () => {
        const durEl = document.getElementById("preview-audio-duration");
        if (durEl && Number.isFinite(audioEl.duration)) {
          durEl.textContent = `${audioEl.duration.toFixed(2)}s`;
        }
      });
      this.previewBackdrop.classList.remove("hidden");
      return;
    }
    if (mime === "application/pdf") {
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <iframe src="${out.objectUrl}" title="PDF Preview" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff;"></iframe>
      `;
      this.previewBackdrop.classList.remove("hidden");
      return;
    }
    const isTextLike = mime.startsWith("text/") || mime.includes("json") || mime.includes("xml") || mime.includes("yaml") || mime.includes("sql") || mime.includes("toml") || mime.includes("csv") || TEXT_TARGET_IDS.has(item.targetFormat);
    if (isTextLike) {
      const fullText = await out.blob.text();
      const lineCount = fullText === "" ? 0 : fullText.split(/\r\n|\r|\n/).length;
      const maxPreviewChars = 5e4;
      const isTruncated = fullText.length > maxPreviewChars;
      const displayText = isTruncated ? fullText.slice(0, maxPreviewChars) : fullText;
      const rowStat = out.metadata?.rows !== void 0 ? ` \xB7 ${Number(out.metadata.rows).toLocaleString()} rows` : "";
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);">
          <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface-hover);">
            <span style="font-size:0.78rem;color:var(--text-secondary);font-family:var(--font-mono);">
              ${lineCount.toLocaleString()} lines \xB7 ${fullText.length.toLocaleString()} chars \xB7 ${formatBytes(out.bytes.length)}${escapeHtml2(rowStat)}
            </span>
            <button type="button" class="btn btn-xs btn-secondary" id="copy-preview-btn">Copy to clipboard</button>
          </div>
          <pre style="margin:0;border:none;border-radius:0;max-height:54vh;overflow:auto;"><code>${escapeHtml2(displayText)}</code></pre>
          ${isTruncated ? `<div style="padding:8px 14px;border-top:1px solid var(--border);font-size:0.75rem;color:var(--text-muted);background:var(--surface-hover);">Showing first ${maxPreviewChars.toLocaleString()} characters. Copy or Download for the complete file.</div>` : ""}
        </div>
      `;
      const copyBtn = document.getElementById("copy-preview-btn");
      copyBtn?.addEventListener("click", async () => {
        const copied = await copyTextToClipboard(fullText);
        if (!copyBtn) return;
        copyBtn.textContent = copied ? "Copied!" : "Copy failed";
        setTimeout(() => {
          copyBtn.textContent = "Copy to clipboard";
        }, 2e3);
      });
      this.previewBackdrop.classList.remove("hidden");
      return;
    }
    this.previewBody.innerHTML = `
      ${summaryBarHtml}
      <div style="padding:28px;text-align:center;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface-muted);">
        <p style="font-weight:600;margin-bottom:6px;">${escapeHtml2(out.filename)}</p>
        <p class="muted">${escapeHtml2(mime)} \xB7 ${formatBytes(out.bytes.length)}. Click Download above to save your converted file.</p>
      </div>
    `;
    this.previewBackdrop.classList.remove("hidden");
  }
};
if (typeof document !== "undefined") {
  const app = new OmniConvertApp();
  void app.init();
}
