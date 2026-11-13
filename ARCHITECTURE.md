# OmniConvert — Hybrid Local-First & Server-Fallback Universal File Converter Architecture

> **Core Architectural Mantra**: *"Convert on the user's device whenever physically possible; seamlessly escalate to a managed, isolated server pipeline only when format complexity or device hardware demands it."*

---

## 1. High-Level System Topology

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  BROWSER CLIENT (SPA / PWA)                             │
│                                                                                         │
│  ┌──────────────────────┐    ┌───────────────────────────┐    ┌──────────────────────┐  │
│  │  Dropzone & Batch UI │───▶│  Magic-Byte Inspector &   │───▶│  Smart Hybrid Router │  │
│  │  (Queue, Presets,    │    │  Device Capability Probe  │    │  (Decision Engine)   │  │
│  │   Live Telemetry)    │    └───────────────────────────┘    └──────────┬───────────┘  │
│  └──────────────────────┘                                                │              │
│             ▲                                                            │              │
│             │           ┌────────────────────────────────────────────────┼──────┐       │
│             │           │ (85–95% of Jobs: Zero Upload, 100% Private)    │      │       │
│             │           ▼                                                │      │       │
│  ┌──────────┴────────────────────────────────────────────────┐           │      │       │
│  │             LOCAL BROWSER EXECUTION ENGINE                │           │      │       │
│  │                                                           │           │      │       │
│  │  ┌─────────────────┐  ┌────────────────┐  ┌────────────┐  │           │      │       │
│  │  │ Tier 1: Native  │  │ Tier 2: Pure   │  │ Tier 3:    │  │           │      │       │
│  │  │ Browser APIs    │  │ Worker Compute │  │ Lazy WASM  │  │           │      │       │
│  │  │ • OffscreenCnvs │  │ • CSV/JSON/XML │  │ Sandboxes  │  │           │      │       │
│  │  │ • WebCodecs     │  │ • YAML/TOML/MD │  │ • FFmpeg   │  │           │      │       │
│  │  │ • WebAudio API  │  │ • fflate ZIP   │  │ • Magick   │  │           │      │       │
│  │  │ • Compression   │  │ • PDF-lib      │  │ • DuckDB   │  │           │      │       │
│  │  └─────────────────┘  └────────────────┘  └────────────┘  │           │      │       │
│  │           │                   │                  │        │           │      │       │
│  │           └───────────────────┼──────────────────┘        │           │      │       │
│  │                               ▼                           │           │      │       │
│  │        Web Worker Pool + OPFS (Origin Private FS)         │           │      │       │
│  │        Zero-Copy ArrayBuffer Transfer & OOM Watchdog      │           │      │       │
│  └───────────────────────────────────────────────────────────┘           │      │       │
└──────────────────────────────────────────────────────────────────────────┼──────┼───────┘
                                                                           │      │
                  ┌────────────────────────────────────────────────────────┘      │
                  │ Tier 4: Automatic Fallback                                    │
                  │ • Unsupported in WASM (LibreOffice DOCX/PPTX->PDF, CAD, RAW)  │
                  │ • File exceeds device RAM / SharedArrayBuffer unavailable     │
                  │ • Local WASM worker OOM / timeout recovery                    │
                  ▼                                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        MANAGED SERVER FALLBACK & ORCHESTRATION ENGINE                   │
│                                                                                         │
│  ┌──────────────────────┐    ┌───────────────────────────┐    ┌──────────────────────┐  │
│  │  Ingestion Gateway   │───▶│  Priority Job Scheduler   │───▶│ Isolated Worker Pool │  │
│  │  • Chunked Upload    │    │  • Fast / Media / Office  │    │ • FFmpeg Native      │  │
│  │  • Magic-Byte Guard  │    │  • Concurrency Semaphore  │    │ • LibreOffice Headl. │  │
│  │  • Rate Limiter      │    │  • SSE Progress Emitter   │    │ • Sharp / Magick     │  │
│  │  • Zip-Bomb Shield   │    │  • Cancellation Token     │    │ • Pandoc / 7z        │  │
│  └──────────────────────┘    └───────────────────────────┘    └──────────┬───────────┘  │
│                                                                          │              │
│  ┌───────────────────────────────────────────────────────────────────────▼───────────┐  │
│  │               EPHEMERAL STORAGE & LIFECYCLE MANAGER (`StorageManager`)            │  │
│  │  • Per-Job Quarantined Scratch Dir (`/tmp/omniconvert/jobs/<jobId>`)              │  │
│  │  • Immediate Delete-on-Download Option + Strict 15-Minute TTL Background Sweeper  │  │
│  │  • Disk Quota Circuit Breaker (Rejects new heavy jobs at >85% scratch capacity)   │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Four-Tier Conversion Execution Model

Every conversion pair `(sourceFormat, targetFormat)` is mapped in the **Shared Format Registry** (`src/shared/registry/`) to one or more execution tiers, ordered by preference:

### Tier 1: `LOCAL_NATIVE` (Zero External Dependencies, Instantaneous)
Uses built-in browser hardware-accelerated APIs inside a Web Worker:
- **Images**: `createImageBitmap` + `OffscreenCanvas.convertToBlob()` for `PNG`, `JPEG`, `WEBP`, `BMP`, `GIF` (static), `ICO`, `AVIF` (where supported by browser encoder), and `SVG` rasterization.
- **Audio**: `OfflineAudioContext` + `AudioContext.decodeAudioData()` + custom PCM/WAV encoder for decoding browser-supported audio (`MP3`, `AAC`, `OGG`, `OPUS`, `WAV`, `FLAC`, `WEBM`) to uncompressed `WAV` (16/24/32-bit PCM), channel mixing (stereo $\leftrightarrow$ mono), sample-rate resampling, and audio trimming/normalization.
- **Compression Streams**: Browser native `CompressionStream` / `DecompressionStream` (`gzip`, `deflate`, `deflate-raw`).

### Tier 2: `LOCAL_PURE_JS` (Lightweight Worker Bundles, < 50 KB)
Runs deterministic, memory-safe TypeScript/JS transformers inside dedicated Web Workers:
- **Structured Data & Tabular**: `JSON` $\leftrightarrow$ `YAML` $\leftrightarrow$ `CSV` $\leftrightarrow$ `TSV` $\leftrightarrow$ `XML` $\leftrightarrow$ `TOML` $\leftrightarrow$ `INI` $\leftrightarrow$ `ENV` $\leftrightarrow$ `Markdown Table` $\leftrightarrow$ `HTML Table` $\leftrightarrow$ `SQL INSERT`.
- **Documents & Markup**: `Markdown` $\leftrightarrow$ `HTML` $\leftrightarrow$ `TXT` $\leftrightarrow$ `RTF` (basic), `JSON/CSV` $\rightarrow$ printable `PDF` table.
- **Archives**: Streaming `ZIP` and `TAR` / `TAR.GZ` creation and extraction via `fflate` in a worker without blocking the main thread.
- **PDF Operations**: Merge, split, rotate, watermark, extract images, and images-to-PDF via `pdf-lib`.

### Tier 3: `LOCAL_WASM` (On-Demand Cached WebAssembly Sandboxes)
Heavy codecs compiled to WebAssembly, **never included in the initial page load**, fetched lazily on demand and persisted in the browser's `CacheStorage` / `IndexedDB`:
- **Audio/Video Transcoding (`ffmpeg.wasm`)**: `MP4`, `MKV`, `MOV`, `AVI`, `WEBM`, `FLV`, `MP3`, `OGG`, `OPUS`, `FLAC`, `AAC`, `M4A`, `GIF` (animated video-to-GIF with palettegen).
- **Advanced Raster & Photography (`imagemagick-wasm` / `vips-wasm`)**: `TIFF`, `PSD`, `TGA`, `HEIC`/`HEIF`, `JXL`, `DDS`, `HDR`/`EXR`.
- **Analytical Data (`duckdb-wasm` / `sql.js`)**: `Parquet` $\leftrightarrow$ `CSV` / `JSON` / `Arrow` / `SQLite`.

### Tier 4: `SERVER_FALLBACK` (Managed Backend Pipeline)
Triggered automatically or by user override when:
1. **Format requires server-only native toolchains**:
   - Office Suites: `DOCX`, `PPTX`, `XLSX`, `ODT`, `ODS`, `ODP` $\leftrightarrow$ `PDF` (via headless LibreOffice).
   - Complex Publishing: `EPUB`, `MOBI`, `AZW3`, `LATEX`, `RST`, `DOCX` $\leftrightarrow$ `MD`/`HTML`/`PDF` (via Pandoc).
   - Rare Archives & CAD: `7Z`, `RAR`, `XZ`, `BZ2`, `ZSTD`, `DWG`, `DXF`, `RAW` (`CR2`, `NEF`, `ARW`, `DNG`).
2. **Hardware / Resource Guardrails Triggered**:
   - File size exceeds safe local memory limits for the user's device (`maxLocalSizeMB` scaled by `navigator.deviceMemory`).
   - Browser lacks `SharedArrayBuffer` (Cross-Origin Isolation) for multi-threaded video transcoding and file is $> 100\text{ MB}$.
   - Local Tier 3 WASM worker fails, runs out of memory (OOM), or exceeds the local stall timeout — the router seamlessly offers/executes transparent server fallback.

---

## 3. Smart Hybrid Routing Algorithm (`ConversionRouter`)

```
Input: File, TargetFormat, UserPreferences, DeviceCapabilities, ServerCapabilities
Output: RoutePlan { tier, engine, estimatedMemoryMB, requiresUpload, fallbackAvailable, reason }
```

1. **Magic-Byte Identification**:
   - Reads the first 64 bytes (`file.slice(0, 64).arrayBuffer()`) to verify the actual binary signature (`89 50 4E 47` for PNG, `50 4B 03 04` for ZIP/DOCX/XLSX/EPUB, `25 50 44 46` for PDF, `66 74 79 70` at offset 4 for MP4/MOV/HEIC, etc.).
   - If the file extension mismatches the magic bytes, warns the user and routes based on the true detected format.
2. **Device Capability Profiling**:
   - Detects `hardwareConcurrency` (CPU cores), `deviceMemory` (RAM estimate in GB), `crossOriginIsolated` (`SharedArrayBuffer` support), `OffscreenCanvas` support, `WebCodecs` support, and `navigator.storage.estimate()` (available OPFS quota).
3. **Safe Memory Budgeting**:
   - Calculates `estimatedPeakMemoryMB = (file.size / 1MB) * engine.memoryMultiplier`.
   - Compares against `safeBrowserMemoryCapMB` (default: `min(1536, deviceMemoryGB * 250)`).
   - If `estimatedPeakMemoryMB <= safeBrowserMemoryCapMB` and a local tier (`LOCAL_NATIVE`, `LOCAL_PURE_JS`, or `LOCAL_WASM`) supports `(sourceFormat -> targetFormat)`:
     - Select the lowest-overhead local tier (`LOCAL_NATIVE` > `LOCAL_PURE_JS` > `LOCAL_WASM`).
   - Else if `SERVER_FALLBACK` supports `(sourceFormat -> targetFormat)` and server is reachable:
     - Route to `SERVER_FALLBACK` with an explicit human-readable reason (e.g., *"File size (650 MB) exceeds safe browser memory limit; routing to server hardware acceleration"* or *"DOCX to PDF layout rendering requires server LibreOffice engine"*).

---

## 4. Client Memory & Worker Management (`WorkerManager`)

Browser tabs crash if WebAssembly heaps grow unbounded or if large files are copied multiple times across `postMessage`. Our client architecture prevents this via:
1. **Bounded Worker Pool**:
   - Spawns at most `clamp(navigator.hardwareConcurrency - 1, 1, 4)` concurrent workers.
   - Separates lightweight workers (`data-worker`, `image-canvas-worker`) from heavy WASM workers (`ffmpeg-worker`, `magick-worker`).
2. **Zero-Copy Transferables & OPFS Streaming**:
   - Passes `ArrayBuffer` payloads in the transfer list (`worker.postMessage(msg, [buffer])`) so ownership moves in $O(1)$ time with zero memory duplication.
   - For files $> 50\text{ MB}$, stages input/output in **Origin Private File System (OPFS)** via `FileSystemSyncAccessHandle` inside the worker.
3. **WASM Heap Recycling & Watchdog**:
   - Because WebAssembly linear memory (`WebAssembly.Memory.grow`) can never shrink once grown, heavy WASM workers track cumulative bytes processed and automatically recycle (terminate & respawn fresh on next job) after exceeding a high-water mark (e.g., `512 MB` cumulative or 60s idle).
   - Instant cancellation: Clicking "Cancel" on an active local conversion immediately terminates the dedicated worker and frees 100% of its RAM.

---

## 5. Server Management, Queueing & Security (`src/server/`)

When a job routes to `SERVER_FALLBACK`, the server enforces production-grade operational management:

### 5.1 Priority Queue & Concurrency Lanes (`JobQueueManager`)
Instead of a single FIFO queue where one 1GB video blocks twenty 50KB document conversions, the server manages **3 isolated concurrency lanes**:
- **`lane:fast`** (Concurrency: `CPU_CORES`, Timeout: `30s`): Sharp/ImageMagick images, structured data, small archives.
- **`lane:document`** (Concurrency: `max(2, CPU_CORES / 2)`, Timeout: `120s`): LibreOffice / Pandoc document conversions.
- **`lane:media`** (Concurrency: `max(1, CPU_CORES / 2)`, Timeout: `600s`): FFmpeg audio/video transcoding.

### 5.2 Ephemeral Storage & Lifecycle Sweeper (`StorageManager`)
- **Isolated Job Sandboxes**: Every job gets a UUID v4 directory `/tmp/omniconvert/jobs/<jobId>/input` and `/tmp/omniconvert/jobs/<jobId>/output`.
- **Zero-Trust Filenames**: User-supplied filenames are stored only as metadata; disk files use sanitized random UUIDs (`input.<ext>`) so path traversal (`../../`) and shell injection via filenames are impossible.
- **Auto-Purge Lifecycle**:
  - Supports `autoDeleteAfterDownload: true` (default optional toggle in UI).
  - Background `StorageSweeper` runs every `60 seconds` and deletes any job directory whose `expiresAt < Date.now()` (default TTL: `15 minutes`), plus any orphaned directories from crashed processes.
  - **Disk Quota Circuit Breaker**: Tracks total bytes in `/tmp/omniconvert`. If scratch usage exceeds `MAX_SCRATCH_BYTES` (configurable, e.g. `5 GB`), triggers an immediate emergency sweep of completed jobs before rejecting new uploads with `HTTP 507 Insufficient Storage`.

### 5.3 Process Sandboxing & Anti-Abuse Security
- **No Shell Execution**: Server adapters invoke binaries exclusively via `child_process.spawn(binaryPath, argsArray, { shell: false })`.
- **Magic-Byte Enforcement**: Server re-verifies magic bytes upon upload before invoking any native binary.
- **Decompression Bomb Protection**: Archive extractors track cumulative unpacked bytes and abort immediately if unpacked size exceeds threshold or compression ratio exceeds `100:1`.
- **COOP / COEP Headers**: Server serves `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` so the browser client unlocks `SharedArrayBuffer` for multi-threaded local WASM!

---

## 6. Subagent Architecture & Strict Ownership Matrix

To build this system cleanly in parallel without merge conflicts, the repository is partitioned into **three strictly isolated domains** matching the strengths of each subagent model:

| Subagent Profile | Assigned Domain & Directories | Why This Model Fits |
| :--- | :--- | :--- |
| **Orchestrator (Main Agent)** | `ARCHITECTURE.md`, `PLAN.md`, `AGENTS.md`, `package.json`, `tsconfig.json`, `src/shared/types.ts`, `docs/architecture-preview.html` | Defines the master architecture, exact TypeScript contracts, and coordinates integration. |
| **1x `gemini-3.6-flash`** *(High-Volume Token Engine)* | `src/shared/registry/*`, `src/shared/converters/*`, `tests/shared/*` | **High-token, strictly templated work**: Generates the 120+ format catalog, magic-byte signature table, conversion capability matrix, quality presets, and pure synchronous data transformers (`CSV/JSON/YAML/XML/TOML/MD/SQL/HTML`) following the rigid types in `src/shared/types.ts`. |
| **1x `gemini-3.1-pro-preview`** *(Backend Systems & Security Architect)* | `src/server/*`, `tests/server/*` | **Rigorous systems & security engineering**: Builds the Server Fallback Engine (`JobQueueManager` with 3 concurrency lanes, `StorageManager` with TTL sweeper & quota breaker, Magic-Byte & Zip-Bomb security guards, SSE live progress stream, Native CLI/Node conversion adapters, and Admin Health/Metrics API). |
| **1x `gemini-4-hydrogen`** *(Frontend, Smart Router & Local Worker Engine)* | `src/client/*`, `public/*`, `tests/client/*` | **Deep full-stack UI & browser systems**: Builds the `ConversionRouter` (local-first decision engine), `WorkerManager` (Web Worker pool, OPFS, memory watchdog), Local Browser Conversion Engines (Canvas Image, WebAudio WAV, Archive ZIP/TAR, PDF, Data worker), and the Modern Reactive Web Application UI. |
