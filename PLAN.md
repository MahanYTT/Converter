# OmniConvert — Master Implementation Plan & Subagent Orchestration Guide

## 1. Executive Summary

**OmniConvert** (`https://github.com/MahanYTT/Converter`) is a privacy-first, hybrid universal file converter web application.
- **Primary Goal**: Execute **85–95% of all file conversions locally inside the user's browser** using native Web APIs (`OffscreenCanvas`, `WebAudio`, `WebCodecs`, `CompressionStream`), Web Workers, and lazy-loaded WebAssembly modules.
- **Secondary Goal**: Provide a **bulletproof, managed Server Fallback Engine** for formats that cannot be converted in a browser (e.g., LibreOffice `DOCX/PPTX/XLSX` $\rightarrow$ `PDF`, Pandoc publishing formats, CAD/RAW/7z) or when a file exceeds safe client device memory limits.
- **Operational Excellence**: Full lifecycle management including magic-byte file verification, priority multi-lane server job queues, real-time SSE progress streaming, automatic 15-minute TTL ephemeral storage sweeping, disk-quota circuit breakers, and live system telemetry.

---

## 2. Project Directory Structure & Module Boundaries

```
Converter/
├── ARCHITECTURE.md                  # System topology, routing rules, security & lifecycle design
├── PLAN.md                          # Phased roadmap, subagent briefs, and verification criteria
├── AGENTS.md                        # Persistent repo memory & strict file-ownership rules
├── package.json                     # Unified scripts & dependencies
├── tsconfig.json                    # Strict TypeScript configuration
├── docs/
│   └── architecture-preview.html    # Interactive visual architecture & routing simulator
├── src/
│   ├── shared/                      # [OWNED BY: Orchestrator + gemini-3.6-flash]
│   │   ├── types.ts                 # Immutable core TypeScript interfaces (Frozen by Orchestrator)
│   │   ├── index.ts                 # Barrel exports for shared module
│   │   ├── registry/
│   │   │   ├── formats.catalog.ts   # 120+ file format definitions, MIME types, categories
│   │   │   ├── signatures.ts        # Binary magic-byte signatures & file buffer sniffer
│   │   │   ├── matrix.ts            # Conversion compatibility matrix & tier assignments
│   │   │   └── presets.catalog.ts   # Quality, resolution, bitrate & target presets
│   │   └── converters/
│   │       ├── data-tabular.ts      # Pure CSV <-> JSON <-> YAML <-> XML <-> TOML <-> INI
│   │       ├── markup-doc.ts        # Pure Markdown <-> HTML <-> TXT <-> SQL <-> LaTeX table
│   │       └── units-encoding.ts    # Base64, Hex, URL, Hash, and Color/Unit helpers
│   │
│   ├── client/                      # [OWNED BY: gemini-4-hydrogen]
│   │   ├── index.html               # Main Web Application Entry
│   │   ├── styles/                  # Modern dark/light glassmorphic UI styles
│   │   ├── router/
│   │   │   ├── device-profiler.ts   # Detects RAM, CPU cores, SharedArrayBuffer, OffscreenCanvas
│   │   │   └── conversion-router.ts # Smart Local-First vs Server-Fallback decision engine
│   │   ├── workers/
│   │   │   ├── worker-pool.ts       # Bounded Web Worker pool, cancellation & OOM recycling
│   │   │   ├── image.worker.ts      # Local OffscreenCanvas & SVG/BMP/PNG/JPEG/WEBP/ICO engine
│   │   │   ├── audio.worker.ts      # Local WebAudio decode + PCM WAV / trim / normalize engine
│   │   │   ├── data.worker.ts       # Local structured data, markup & archive (ZIP/TAR/GZ) worker
│   │   │   └── wasm-loader.ts       # Lazy on-demand WASM loader with CacheStorage persistence
│   │   ├── services/
│   │   │   └── server-fallback.ts   # Chunked upload, SSE progress client & auto-fallback retry
│   │   └── ui/
│   │       └── app.ts               # Interactive Batch Queue, Format Picker, Routing Badge & Admin Modal
│   │
│   └── server/                      # [OWNED BY: gemini-3.1-pro-preview]
│       ├── index.ts                 # HTTP Server entry with COOP/COEP headers & static serving
│       ├── config.ts                # Server limits, TTLs, lane concurrencies, scratch paths
│       ├── management/
│       │   ├── storage-manager.ts   # Quarantined temp dirs, 15m TTL sweeper & disk quota breaker
│       │   ├── job-queue.ts         # 3-lane priority scheduler (fast, document, media) + cancellation
│       │   └── telemetry.ts         # Live metrics: queue depth, local/server ratio, binary probes
│       ├── security/
│       │   ├── file-validator.ts    # Server-side magic-byte check, filename sanitizer, zip-bomb guard
│       │   └── rate-limiter.ts      # Token-bucket per-IP rate & concurrent upload limiter
│       ├── adapters/
│       │   ├── adapter-registry.ts  # Maps (source, target) to available server adapters
│       │   ├── image.adapter.ts     # Server image conversion (Sharp / ImageMagick CLI / fallback)
│       │   ├── document.adapter.ts  # Server document conversion (LibreOffice / Pandoc / PDF)
│       │   ├── media.adapter.ts     # Server audio/video conversion (FFmpeg spawn with progress parsing)
│       │   └── archive-data.adapter.ts # Server archive & tabular conversion
│       └── routes/
│           └── api.ts               # REST + SSE endpoints (/api/v1/jobs, /api/v1/capabilities, /api/v1/health)
└── tests/
    ├── shared/                      # Unit tests for registry, magic bytes & pure data converters
    ├── server/                      # Unit & integration tests for queue, storage sweeper & API
    └── client/                      # Unit tests for smart router & device capability scoring
```

---

## 3. Subagent Strategy & Guardrails

### Why Each Model Was Chosen & How It Is Managed

1. **`gemini-3.6-flash` (1x Flash 3.6 — High-Token Structured Catalog & Pure Transformers)**
   - **Strength**: Huge token throughput and fast generation when given a concrete schema and repetitive structural patterns.
   - **Risk**: Can hallucinate imports or over-complicate architecture if asked to design open-ended systems.
   - **Mitigation & Assignment**:
     - We lock `src/shared/types.ts` **before** launching Flash 3.6.
     - Flash 3.6 is strictly confined to `src/shared/registry/*`, `src/shared/converters/*`, and `tests/shared/*`.
     - Zero external npm dependencies required in its files: pure TypeScript implementing our exact interfaces (`FormatDefinition`, `MagicSignature`, `ConversionRouteRule`, `ConversionPreset`, `DataTransformResult`).
     - We use its token capacity to build an **industrial-grade 120+ format registry**, binary magic-byte inspector, preset catalog, and zero-dependency parsers/serializers for `JSON`, `CSV`, `TSV`, `YAML`, `XML`, `TOML`, `INI`, `ENV`, `Markdown Tables`, `HTML Tables`, and `SQL INSERT` statements.

2. **`gemini-3.1-pro-preview` (1x Pro 3.1 — Backend Fallback Server, Queue/Storage Management & Security)**
   - **Strength**: Strong analytical reasoning, defensive systems programming, concurrency edge cases, and security engineering.
   - **Assignment**:
     - Confined to `src/server/*` and `tests/server/*`.
     - Builds the complete backend management layer:
       - `StorageManager`: Quarantined per-job directories, immediate delete-on-download option, 15-minute TTL sweeper, and disk quota circuit breaker.
       - `JobQueueManager`: Multi-lane priority queue (`fast`, `document`, `media`), `AbortController` process termination on job cancel, and real-time EventEmitter/SSE progress streams.
       - `Security`: Magic-byte validation on upload, path traversal prevention, zip-bomb ratio checks, and per-IP rate limiting.
       - `Server Adapters`: Modular CLI wrapper (`spawn` with `shell: false` + FFmpeg stderr progress parser) plus pure Node fallbacks so the server works out-of-the-box even on machines where optional CLI tools (`libreoffice`, `pandoc`, `ffmpeg`) are not yet installed, while dynamically unlocking them via capability probing when installed.

3. **`gemini-4-hydrogen` (1x Hydrogen — Smart Hybrid Router, Browser Worker Engine & Web UI)**
   - **Strength**: High-cohesion frontend & browser systems engineering, state management, and UX polish.
   - **Assignment**:
     - Confined to `src/client/*`, `public/*`, and `tests/client/*`.
     - Builds the `DeviceProfiler` & `ConversionRouter` that decides `LOCAL_NATIVE` vs `LOCAL_PURE_JS` vs `LOCAL_WASM` vs `SERVER_FALLBACK` with transparent explanations for every file.
     - Builds the `WorkerPool` manager and browser-side conversion engines (Canvas image pipeline, WebAudio WAV/PCM resampler/trimmer, pure data/archive pipeline, and lazy WASM loader).
     - Builds the responsive, keyboard-accessible Web UI featuring drag-and-drop batch queues, per-file route badges (`⚡ Local Browser` vs `☁️ Server Fallback`), format search matrix, preset tuning Drawer, and a live Server & Worker Management Dashboard.

---

## 4. Phased Execution Roadmap

- **Phase 1: Architecture & Shared Contracts (Orchestrator — Current)**
  - Author `ARCHITECTURE.md`, `PLAN.md`, `AGENTS.md`, `docs/architecture-preview.html`.
  - Author `src/shared/types.ts`, `package.json`, `tsconfig.json`.
  - Initialize Git commit on `main` so all subagents have a clean, conflict-free base.
- **Phase 2: Parallel Subagent Execution**
  - Launch **Subagent 1 (`gemini-3.6-flash`)** on `src/shared/registry/` & `src/shared/converters/`.
  - Launch **Subagent 2 (`gemini-3.1-pro-preview`)** on `src/server/` & `tests/server/`.
  - Launch **Subagent 3 (`gemini-4-hydrogen`)** on `src/client/` & `tests/client/`.
- **Phase 3: Integration & Verification**
  - Run automated tests across `tests/shared`, `tests/server`, and `tests/client`.
  - Verify end-to-end local browser conversions and automatic server fallback management.
