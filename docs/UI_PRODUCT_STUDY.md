# OmniConvert — UI/UX Production Study & Commercial Design System Specification

## 1. Executive Summary: From Developer Project to Flagship Consumer Product

Most open-source or developer-built file converters fail the "3-second consumer trust test" because they expose their internal plumbing. They clutter the interface with hardware telemetry ("16 CPU Cores • 1536 MB Safe Budget"), execution mode switches ("Auto / Force Local / Force Server"), internal queue identifiers (`lane: document`, `LOCAL_NATIVE`), and architecture blueprint links.

**Flagship commercial utilities—such as CloudConvert, Squoosh.app, Linear, Raycast, and WeTransfer—do the exact opposite:**
1. **Zero Cognitive Load**: The user has one job: *drop a file, pick a target format, and get the output immediately*.
2. **Invisible Hybrid Intelligence**: OmniConvert's 4-tier hybrid engine (85–95% local browser execution via OffscreenCanvas, WebAudio, pure JS workers, and WebAssembly, with automatic fallback to an isolated multi-lane server) operates **100% invisibly**. The user is never asked to choose between "Local" and "Server".
3. **Tactile Precision over Decorative Noise**: Instead of glowing neon gradients, dark glassmorphism, or marketing fluff, the interface uses a daylight-first Swiss-utilitarian surface (`#F8FAFC` alabaster canvas, `#FFFFFF` pure elevated cards, `1px solid #E2E8F0` hairline borders, and tabular monospace metrics).

---

## 2. Competitive Benchmark Analysis

| Product | Core UX Strength | Key Takeaway Applied to OmniConvert |
| :--- | :--- | :--- |
| **Squoosh.app (Google Chrome Labs)** | Instant visual feedback, side-by-side comparison, zero-upload privacy, and immediate size-delta calculation (`-94%`). | Built the **Studio Output Inspector** (`openPreview`) with side-by-side Original vs. Converted image comparison, resolution inspection, and live byte-savings badges (`Saved 97%`). |
| **CloudConvert** | Clean horizontal file rows, custom searchable format picker popover with category tabs, and contextual per-file gear settings. | Replaced native `<select>` target dropdowns with **`FormatPickerPopover`**—a floating searchable popover with category tabs (`All`, `Image`, `Audio`, `Document`, `Data`, `Archive`) and keyboard navigation. |
| **Linear & Raycast** | Crisp 1px borders, high-contrast typography, subtle keyboard shortcuts (`ESC`), and zero visual bloat. | Adopted `Inter` + `JetBrains Mono` (`tabular-nums`), compact 2px top progress tracks on every file card, and instant keyboard-accessible modals. |
| **WeTransfer / Apple iCloud** | Calm, trustworthy, consumer-safe copywriting that reassures without technical jargon. | Replaced all internal engine terms (`LOCAL_PURE_JS`, `SERVER_FALLBACK`, `lane: fast`) with calm consumer states (`Ready`, `Converting... 65%`, `Done · -97%`). |

---

## 3. Strict Consumer Product Rules ("Locked-In" Invariants)

1. **No Manual Local/Server Toggle**:
   - The `Auto / Force Local / Force Server` segmented control is completely removed from file cards and settings drawers.
   - `forceExecutionMode: 'AUTO'` is enforced automatically under the hood.
2. **No Developer Telemetry or Debug Drawers**:
   - Removed `#ops-drawer-backdrop`, `#open-ops-drawer-btn`, `#stats-counter-pill`, worker pool slots, RAM budget readouts, and `/architecture` links from the consumer workspace.
3. **Custom Searchable Format Picker Popover (`src/client/ui/format-picker.ts`)**:
   - Clicking a file's target format button opens a floating, viewport-aware popover (`FormatPickerPopover`) with instant search filtering, category tabs, and format description footer.
4. **Adaptive Workspace Geometry**:
   - **Empty State**: Displays the centered magnetic dropzone, quick format pills (`PNG → WEBP`, `WAV → MP3`, `CSV → JSON`, `MD → PDF`, `DOCX → PDF`), and the browsable Supported Formats Directory.
   - **Active Queue State**: As soon as files are added, the hero and dropzone compact into a slim top bar (`is-compact`), elevating the batch toolbar and file queue list above the fold.

---

## 4. Design Token System (`src/client/styles/main.css`)

### 4.1 Color Palette (Daylight-First + Obsidian Dark Mode)

| Token | Light Mode (Default) | Dark Mode (`[data-theme="dark"]`) | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F8FAFC` | `#090D16` | Page background canvas |
| `--surface-card` | `#FFFFFF` | `#111827` | File cards, dropzone, modals |
| `--surface-muted` | `#F1F5F9` | `#1E293B` | Secondary pills, code blocks, tabs |
| `--border` | `#E2E8F0` | `#1E293B` | Crisp 1px structural borders |
| `--text-primary` | `#0F172A` | `#F8FAFC` | Primary headings & filenames |
| `--text-secondary` | `#475569` | `#94A3B8` | Supporting labels & metadata |
| `--accent-primary` | `#2563EB` | `#3B82F6` | Primary CTAs, active format pills |
| `--accent-local` | `#059669` | `#10B981` | Completed status & savings badges |
| `--accent-danger` | `#DC2626` | `#EF4444` | Error states & cancel actions |

### 4.2 Typography Scale
- **UI Sans (`--font-sans`)**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` with `-0.025em` headline tracking.
- **Technical Mono (`--font-mono`)**: `'JetBrains Mono', monospace` with `font-variant-numeric: tabular-nums` for file sizes, percentages, and durations (`122ms`).

---

## 5. End-to-End User Flows

1. **Instant Drag-and-Drop / Sample Batch**:
   - User drops files or clicks **Load Sample Files** (`studio-portrait.png`, `product-catalog.csv`, `release-notes.md`, `ambient-synth.wav`, `executive-brief.docx`).
   - Binary magic bytes are inspected in `< 2ms` to detect true file types and prevent spoofed extensions.
2. **Format Selection & Fine-Tuning**:
   - User clicks the format trigger (e.g., `WEBP ▾`) to open the searchable **Format Picker Popover**, or selects a one-click **Preset** (e.g., `Web Optimized (WebP · 82%)`, `Print-Ready PDF (A4)`).
   - Clicking the gear icon expands contextual studio controls (Quality slider, Resize dimensions, Sample rate, Indentation, Page size).
3. **One-Click Batch Conversion & Studio Inspection**:
   - Clicking **Convert All** processes compatible files concurrently in browser workers while seamlessly routing heavy office formats (`DOCX → PDF`) to the backend without user intervention.
   - Clicking **Preview** opens the **Studio Output Inspector** for side-by-side image comparison, audio playback, syntax-formatted code inspection with one-click copy, or embedded PDF viewing.
