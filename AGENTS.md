# AGENTS.md — OmniConvert Repository Memory & Subagent Rules

## Project Overview
**OmniConvert** (`https://github.com/MahanYTT/Converter`) is a local-first, server-fallback universal file converter web application.
- **85–95% Local Browser Execution**: Uses native browser APIs (`OffscreenCanvas`, `WebAudio`, `WebCodecs`, `CompressionStream`), Web Workers (`src/client/workers/`), pure JS transformers (`src/shared/converters/`), and lazy-loaded WebAssembly modules.
- **Managed Server Fallback**: Handles formats that cannot run in the browser (e.g. LibreOffice `DOCX/PPTX/XLSX -> PDF`, Pandoc, native FFmpeg/ImageMagick, 7z/RAR/RAW) or files that exceed safe client memory limits (`src/server/`).

## Strict File Ownership Boundaries for Subagents
To prevent merge conflicts during parallel execution, each subagent MUST only create/edit files within its assigned domain:

1. **Orchestrator (Main Agent)**:
   - Owns `ARCHITECTURE.md`, `PLAN.md`, `AGENTS.md`, `package.json`, `tsconfig.json`, `src/shared/types.ts`, `docs/architecture-preview.html`.
   - **Rule**: `src/shared/types.ts` is the frozen shared contract. Do not break existing interfaces in `src/shared/types.ts`.

2. **Flash 3.6 Subagent (`gemini-3.6-flash`)**:
   - Owns ONLY:
     - `src/shared/registry/formats.catalog.ts`
     - `src/shared/registry/signatures.ts`
     - `src/shared/registry/matrix.ts`
     - `src/shared/registry/presets.catalog.ts`
     - `src/shared/converters/data-tabular.ts`
     - `src/shared/converters/markup-doc.ts`
     - `src/shared/converters/units-encoding.ts`
     - `src/shared/index.ts`
     - `tests/shared/*`
   - **Rule**: Write pure, zero-dependency TypeScript that strictly conforms to `src/shared/types.ts`. Do NOT touch `src/client/*` or `src/server/*`.

3. **Pro 3.1 Subagent (`gemini-3.1-pro-preview`)**:
   - Owns ONLY:
     - `src/server/**`
     - `tests/server/**`
   - **Rule**: Import shared types from `../shared/types.js` (or `../shared/index.js`). Use Node.js built-in modules (`node:http`, `node:fs`, `node:child_process`, `node:crypto`, `node:stream`, `node:os`, `node:path`, `node:zlib`) so the server runs cleanly with zero native compilation issues via `node --experimental-strip-types` (Node 24 built-in TypeScript execution!).

4. **Hydrogen Subagent (`gemini-4-hydrogen`)**:
   - Owns ONLY:
     - `src/client/**`
     - `public/**`
     - `tests/client/**`
   - **Rule**: Build the Smart Hybrid Router (`ConversionRouter`), `DeviceProfiler`, `WorkerPool`, local browser conversion engines (Canvas Image, WebAudio WAV, Data/Archive/PDF), and the complete interactive Web UI (`src/client/index.html` + modular TS/JS).

## Runtime Notes (Windows / Node 24)
- **Node v24.22.1** is installed and natively runs `.ts` files via `node --experimental-strip-types` or `node --test`!
- Avoid adding heavy native C++ npm packages that require `node-gyp` on Windows. Prefer Node 24 built-ins + pure TypeScript/JS modules + optional CLI binary detection (`ffmpeg`, `magick`, `soffice`, `pandoc`, `7z`).
