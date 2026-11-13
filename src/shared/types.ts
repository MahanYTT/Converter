/**
 * OmniConvert — Core Shared TypeScript Contracts
 *
 * IMPORTANT FOR ALL SUBAGENTS:
 * - Compatible with Node 24 native TypeScript (`--experimental-strip-types`).
 * - Do NOT use TypeScript `enum` keyword or parameter properties; use union types & `as const` objects.
 * - Always use `import type { ... }` when importing types (`verbatimModuleSyntax: true`).
 * - Always include `.ts` extension in relative imports (e.g. `from './types.ts'`).
 */

export type FormatCategory =
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'ebook'
  | 'archive'
  | 'data'
  | 'font'
  | 'vector'
  | 'cad';

export const FORMAT_CATEGORIES: readonly FormatCategory[] = [
  'image',
  'audio',
  'video',
  'document',
  'ebook',
  'archive',
  'data',
  'font',
  'vector',
  'cad',
] as const;

/**
 * Execution Tiers ordered from lowest overhead (100% browser native) to managed server fallback:
 * - LOCAL_NATIVE: Browser OffscreenCanvas, WebAudio, WebCodecs, CompressionStream (~0 KB overhead)
 * - LOCAL_PURE_JS: Deterministic JS/TS inside Web Worker (CSV/JSON/YAML/XML/TOML/MD/ZIP/PDF)
 * - LOCAL_WASM: Lazy-loaded cached WebAssembly module inside isolated Worker (FFmpeg.wasm, Magick.wasm, DuckDB)
 * - SERVER_FALLBACK: Managed backend job queue with isolated temp workspace & native toolchains
 */
export type ExecutionTier =
  | 'LOCAL_NATIVE'
  | 'LOCAL_PURE_JS'
  | 'LOCAL_WASM'
  | 'SERVER_FALLBACK';

export type ConversionEngineId =
  | 'canvas-2d'
  | 'web-audio-pcm'
  | 'web-codecs'
  | 'compression-stream'
  | 'pure-data-tabular'
  | 'pure-markup-doc'
  | 'pure-archive-zip'
  | 'pure-pdf-ops'
  | 'wasm-ffmpeg'
  | 'wasm-imagemagick'
  | 'wasm-duckdb'
  | 'server-sharp-magick'
  | 'server-ffmpeg'
  | 'server-libreoffice'
  | 'server-pandoc'
  | 'server-archive-7z'
  | 'server-data-engine';

export type ServerQueueLane = 'fast' | 'document' | 'media';

export interface FormatDefinition {
  /** Canonical lowercase format ID, e.g. 'png', 'webp', 'mp4', 'docx', 'csv' */
  id: string;
  /** Human-readable name, e.g. 'Portable Network Graphics' */
  name: string;
  /** Short badge label, e.g. 'PNG' */
  label: string;
  /** Primary category */
  category: FormatCategory;
  /** File extensions without leading dot, e.g. ['jpg', 'jpeg'] */
  extensions: readonly string[];
  /** Primary IANA MIME type, e.g. 'image/png' */
  mimeType: string;
  /** Additional accepted MIME aliases */
  mimeAliases?: readonly string[];
  /** Whether the format is lossy, lossless, or container/text */
  compressionType: 'lossless' | 'lossy' | 'both' | 'uncompressed' | 'text' | 'container';
  /** Typical support in browser local engines */
  browserSupport: {
    canDecodeNative: boolean;
    canEncodeNative: boolean;
    canProcessPureJs: boolean;
    canProcessWasm: boolean;
  };
  /** Maximum recommended file size (in MB) for local browser processing on a standard 8GB RAM device */
  maxRecommendedLocalSizeMB: number;
  /** Brief description for UI tooltips & SEO */
  description: string;
}

export interface MagicSignature {
  /** Format ID matching FormatDefinition.id */
  formatId: string;
  /** Byte offset from start of file (usually 0, or 4 for ISO Base Media / ftyp) */
  offset: number;
  /** Hex bytes uppercase or lowercase, e.g. ['89', '50', '4E', '47', '0D', '0A', '1A', '0A'] */
  hexBytes: readonly string[];
  /** Optional mask bytes or secondary ASCII marker at a specific offset */
  asciiMarker?: {
    offset: number;
    value: string;
  };
  /** Priority when multiple signatures match (higher = more specific, e.g. DOCX vs generic ZIP) */
  priority: number;
  description: string;
}

export interface MagicDetectionResult {
  detectedFormatId: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedSignature?: MagicSignature;
  extensionFormatId: string | null;
  isSpoofedOrMismatched: boolean;
  warningMessage?: string;
}

export interface ConversionRouteRule {
  /** Source format ID or '*' for category-level rule */
  sourceFormat: string;
  /** Target format ID */
  targetFormat: string;
  /** Ordered list of supported execution tiers from most preferred (local) to fallback (server) */
  supportedTiers: readonly ExecutionTier[];
  /** Preferred engine per tier */
  enginesByTier: Partial<Record<ExecutionTier, ConversionEngineId>>;
  /** Estimated peak RAM multiplier relative to input file size (e.g., 4.0 means 50MB file -> ~200MB RAM) */
  memoryMultiplier: number;
  /** Hard ceiling in MB for browser local execution regardless of RAM */
  maxLocalFileSizeMB: number;
  /** Require Cross-Origin Isolation (SharedArrayBuffer) for local execution? */
  requiresCrossOriginIsolation?: boolean;
  /** Server queue lane if escalated to SERVER_FALLBACK */
  serverLane: ServerQueueLane;
  /** Quality /fidelity notes */
  notes?: string;
}

export interface DeviceCapabilityProfile {
  hardwareConcurrency: number;
  deviceMemoryGB: number;
  crossOriginIsolated: boolean;
  supportsOffscreenCanvas: boolean;
  supportsWebCodecs: boolean;
  supportsWebAudio: boolean;
  supportsCompressionStream: boolean;
  supportsOPFS: boolean;
  availableStorageQuotaMB: number;
  safeBrowserMemoryCapMB: number;
  supportedCanvasEncodeMimes: readonly string[];
}

export interface RoutingDecision {
  sourceFormat: string;
  targetFormat: string;
  selectedTier: ExecutionTier;
  selectedEngine: ConversionEngineId;
  isLocal: boolean;
  requiresUpload: boolean;
  fallbackTier: ExecutionTier | null;
  fallbackEngine: ConversionEngineId | null;
  estimatedPeakMemoryMB: number;
  serverLane: ServerQueueLane;
  reason: string;
  warnings: string[];
}

export interface ConversionPreset {
  id: string;
  name: string;
  category: FormatCategory;
  targetFormat: string;
  description: string;
  options: ConversionOptions;
}

export interface ConversionOptions {
  /** Image / Video / Audio quality (1-100) */
  quality?: number;
  /** Target width in pixels (aspect ratio preserved if height omitted) */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Resize fit mode */
  fit?: 'contain' | 'cover' | 'fill' | 'inside';
  /** Strip EXIF/metadata for privacy */
  stripMetadata?: boolean;
  /** Audio sample rate in Hz (e.g. 44100, 48000, 16000) */
  sampleRate?: number;
  /** Audio channels (1 = mono, 2 = stereo) */
  channels?: 1 | 2;
  /** Audio bitrate in kbps (e.g. 128, 192, 320) */
  audioBitrateKbps?: number;
  /** Normalize audio peak to -1 dB */
  normalizeAudio?: boolean;
  /** Trim start/end in seconds */
  trimStartSec?: number;
  trimEndSec?: number;
  /** Video CRF (0-51, lower is higher quality, e.g. 23) */
  videoCrf?: number;
  /** Video frame rate (fps) */
  fps?: number;
  /** Data formatting indentation spaces (0 for minified, 2 or 4 for pretty) */
  indentSpaces?: number;
  /** CSV delimiter character */
  csvDelimiter?: ',' | ';' | '\t' | '|';
  /** SQL table name for SQL INSERT generation */
  sqlTableName?: string;
  /** Document page size */
  pageSize?: 'A4' | 'Letter' | 'Legal';
  /** Force execution tier override ('AUTO' by default) */
  forceExecutionMode?: 'AUTO' | 'LOCAL_ONLY' | 'SERVER_ONLY';
  /** Auto-delete server file immediately after first download */
  autoDeleteServerFile?: boolean;
}

export type JobStatus =
  | 'pending'
  | 'inspecting'
  | 'queued-local'
  | 'processing-local'
  | 'uploading-server'
  | 'queued-server'
  | 'processing-server'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ConversionJobRecord {
  id: string;
  originalFilename: string;
  sanitizedFilename: string;
  inputBytes: number;
  outputBytes?: number;
  sourceFormat: string;
  targetFormat: string;
  options: ConversionOptions;
  routing: RoutingDecision;
  status: JobStatus;
  progressPercent: number;
  stageMessage: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt?: number;
  errorMessage?: string;
  downloadUrl?: string;
}

export interface DataTransformResult {
  success: boolean;
  outputText: string;
  outputBytes: Uint8Array;
  mimeType: string;
  targetExtension: string;
  rowCount?: number;
  warnings: string[];
  errorMessage?: string;
}

export interface ServerHealthMetrics {
  status: 'ok' | 'degraded' | 'overloaded';
  uptimeSeconds: number;
  activeJobsByLane: Record<ServerQueueLane, number>;
  queuedJobsByLane: Record<ServerQueueLane, number>;
  laneConcurrencyLimits: Record<ServerQueueLane, number>;
  totalCompletedJobs: number;
  totalFailedJobs: number;
  storage: {
    scratchDir: string;
    activeJobDirs: number;
    usedBytes: number;
    maxQuotaBytes: number;
    usagePercent: number;
    ttlMinutes: number;
    lastSweepAt: number;
    totalPurgedDirs: number;
  };
  detectedBinaries: {
    ffmpeg: boolean;
    imagemagick: boolean;
    libreoffice: boolean;
    pandoc: boolean;
    sevenZip: boolean;
  };
}
