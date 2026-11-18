import type {
  ConversionOptions,
  DeviceCapabilityProfile,
  FormatCategory,
  FormatDefinition,
  JobStatus,
  MagicDetectionResult,
  RoutingDecision,
} from '../../shared/types.ts';
import { ConversionRouter } from '../router/conversion-router.ts';
import { DeviceProfiler } from '../router/device-profiler.ts';
import {
  CLIENT_FORMATS,
  getCompatibleTargets,
  getDefaultTargetForSource,
  getFormatById,
  getPresetsForCategory,
  inspectFileMagicBytes,
} from '../router/format-catalog.ts';
import { createDemoSampleFiles } from '../services/demo-generator.ts';
import { ServerFallbackClient } from '../services/server-fallback.ts';
import {
  createZipArchive,
  executeLocalConversion,
} from '../workers/local-engines.ts';
import { WasmLoaderError } from '../workers/wasm-loader.ts';
import { WorkerPool } from '../workers/worker-pool.ts';
import {
  attachFormatPickerListeners,
  createFormatPickerTriggerHtml,
} from './format-picker.ts';

interface BatchQueueItem {
  id: string;
  file: File;
  headerBytes: Uint8Array;
  magic: MagicDetectionResult;
  sourceFormat: string;
  targetFormat: string;
  presetId: string;
  options: ConversionOptions;
  routing: RoutingDecision;
  status: JobStatus;
  progressPercent: number;
  stageMessage: string;
  durationMs?: number;
  errorMessage?: string;
  abortController?: AbortController;
  expandedSettings?: boolean;
  thumbnailUrl?: string;
  output?: {
    blob: Blob;
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    objectUrl: string;
    metadata?: Record<string, string | number>;
  };
}

type QueueFilterMode = 'all' | 'pending' | 'completed' | 'failed';

interface CommandActionItem {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  shortcut?: string;
  execute: () => void;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'ico', 'svg']);
const TEXT_TARGET_IDS = new Set([
  'json',
  'csv',
  'tsv',
  'yaml',
  'xml',
  'toml',
  'ini',
  'env',
  'sql',
  'md',
  'html',
  'txt',
]);

const PASTE_TEMPLATES: Record<string, { ext: string; target: string; filename: string; content: string }> = {
  json: {
    ext: 'json',
    target: 'yaml',
    filename: 'api-payload.json',
    content: JSON.stringify(
      {
        service: 'OmniConvert Studio',
        version: '2.4.0',
        localFirst: true,
        supportedCodecs: 85,
        pipelines: [
          { tier: 'LOCAL_NATIVE', engine: 'OffscreenCanvas / WebAudio', latencyMs: 12 },
          { tier: 'LOCAL_WASM', engine: 'WebAssembly Worker Thread', latencyMs: 38 },
          { tier: 'SERVER_FALLBACK', engine: 'Isolated Container Lane', autoPurge: true },
        ],
      },
      null,
      2,
    ),
  },
  csv: {
    ext: 'csv',
    target: 'json',
    filename: 'product-inventory.csv',
    content: [
      'id,sku,product_name,category,price_usd,in_stock',
      '101,ST-901,Studio Condenser Microphone,Audio,249.00,true',
      '102,ST-902,Tactile Mechanical Console,Hardware,189.50,true',
      '103,ST-903,4K Reference OLED Monitor,Displays,799.00,true',
      '104,ST-904,Thunderbolt DSP Audio Interface,Audio,349.00,false',
      '105,ST-905,Braided XLR Studio Cable (3m),Accessories,29.99,true',
    ].join('\n'),
  },
  yaml: {
    ext: 'yaml',
    target: 'json',
    filename: 'deployment.yaml',
    content: [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: omniconvert-worker',
      '  environment: production',
      'spec:',
      '  replicas: 4',
      '  zeroUploadLocal: true',
      '  maxMemoryMB: 512',
    ].join('\n'),
  },
  md: {
    ext: 'md',
    target: 'pdf',
    filename: 'studio-architecture.md',
    content: [
      '# OmniConvert Studio Specification',
      '',
      '## 1. Local-First Execution Pipeline',
      'OmniConvert executes **85-95% of conversions** directly inside the browser sandbox using `OffscreenCanvas`, `WebAudio`, and dedicated Web Workers.',
      '',
      '### Core Guarantees',
      '- **Zero Upload Latency**: Instant byte-to-byte transcoding on your hardware.',
      '- **Forensic Magic-Byte Inspection**: Every 512-byte header is verified before execution.',
      '- **Automatic Fallback**: Heavy office documents seamlessly route and self-purge.',
    ].join('\n'),
  },
  xml: {
    ext: 'xml',
    target: 'json',
    filename: 'catalog.xml',
    content: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<catalog>',
      '  <instrument id="OP-1">',
      '    <name>Field Synthesizer</name>',
      '    <category>Audio</category>',
      '    <price>1299</price>',
      '  </instrument>',
      '  <instrument id="TX-6">',
      '    <name>Ultra-Portable Mixer</name>',
      '    <category>Hardware</category>',
      '    <price>1199</price>',
      '  </instrument>',
      '</catalog>',
    ].join('\n'),
  },
};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function computeSizeDelta(inputBytes: number, outputBytes: number): {
  pct: number;
  pctStr: string;
  savingsLabel: string;
  isSmaller: boolean;
} {
  const pct = ((outputBytes - inputBytes) / Math.max(1, inputBytes)) * 100;
  const rounded = Math.round(pct);
  const pctStr = rounded <= 0 ? `${rounded}%` : `+${rounded}%`;
  const savingsLabel =
    rounded < 0 ? `Saved ${Math.abs(rounded)}%` : rounded === 0 ? 'Same size' : `+${rounded}% larger`;
  return { pct, pctStr, savingsLabel, isSmaller: rounded <= 0 };
}

function isBusyStatus(status: JobStatus): boolean {
  return (
    status === 'inspecting' ||
    status === 'queued-local' ||
    status === 'processing-local' ||
    status === 'uploading-server' ||
    status === 'queued-server' ||
    status === 'processing-server'
  );
}

function sanitizeStageMessage(status: JobStatus, rawMessage?: string): string {
  if (status === 'pending') return 'Ready to convert';
  if (status === 'queued-local' || status === 'queued-server') return 'Waiting in queue...';
  if (status === 'uploading-server') return 'Preparing conversion...';
  if (status === 'processing-server') return 'Converting file...';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'failed') return 'Conversion failed';
  if (!rawMessage) return 'Converting...';
  return rawMessage
    .replace(/Server Fallback\s*\([^)]*\)/gi, 'cloud engine')
    .replace(/server lane[:\s]*\w+/gi, 'processing queue')
    .replace(/LOCAL_\w+/g, 'browser');
}

function statusBadgeMeta(item: BatchQueueItem): {
  label: string;
  pillClass: string;
  inlineStyle: string;
} {
  if (isBusyStatus(item.status)) {
    return {
      label: `Converting... ${Math.round(item.progressPercent)}%`,
      pillClass: 'server',
      inlineStyle: 'cursor:default;',
    };
  }
  if (item.status === 'completed' && item.output) {
    const { pctStr } = computeSizeDelta(item.file.size, item.output.bytes.length);
    return {
      label: `Done · ${pctStr}`,
      pillClass: 'local',
      inlineStyle: 'cursor:default;',
    };
  }
  if (item.status === 'failed') {
    return {
      label: 'Failed',
      pillClass: '',
      inlineStyle:
        'cursor:default;background:var(--accent-danger-bg);color:var(--accent-danger);border:1px solid var(--accent-danger-border);',
    };
  }
  if (item.status === 'cancelled') {
    return {
      label: 'Cancelled',
      pillClass: '',
      inlineStyle:
        'cursor:default;background:var(--surface-muted);color:var(--text-muted);border:1px solid var(--border);',
    };
  }
  return {
    label: item.routing.isLocal ? 'Local · Ready' : 'Cloud · Ready',
    pillClass: item.routing.isLocal ? 'local' : 'server',
    inlineStyle: 'cursor:default;',
  };
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? { width: img.naturalWidth, height: img.naturalHeight }
          : null,
      );
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function detectTextFormatFromContent(raw: string): { ext: string; name: string } {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return { ext: 'json', name: 'clipboard.json' };
    } catch {
      // continue
    }
  }
  if (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.endsWith('>') && !trimmed.toLowerCase().startsWith('<!doctype html'))) {
    return { ext: 'xml', name: 'clipboard.xml' };
  }
  if (trimmed.toLowerCase().startsWith('<!doctype html') || trimmed.toLowerCase().startsWith('<html')) {
    return { ext: 'html', name: 'clipboard.html' };
  }
  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2 && lines[0].includes(',') && lines[1].includes(',')) {
    const c0 = lines[0].split(',').length;
    const c1 = lines[1].split(',').length;
    if (c0 >= 2 && c0 === c1) {
      return { ext: 'csv', name: 'clipboard.csv' };
    }
  }
  if (trimmed.startsWith('# ') || trimmed.includes('\n## ') || trimmed.includes('**')) {
    return { ext: 'md', name: 'clipboard.md' };
  }
  if (/^[a-zA-Z0-9_-]+:\s+.+/m.test(trimmed)) {
    return { ext: 'yaml', name: 'clipboard.yaml' };
  }
  return { ext: 'txt', name: 'clipboard.txt' };
}

function highlightCodeLine(line: string, format: string): string {
  const esc = escapeHtml(line);
  if (format === 'json') {
    return esc
      .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="tok-key">$1</span>$2')
      .replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="tok-string">$1</span>')
      .replace(/\b(true|false)\b/g, '<span class="tok-boolean">$1</span>')
      .replace(/\b(null)\b/g, '<span class="tok-null">$1</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  }
  if (format === 'yaml' || format === 'toml' || format === 'ini' || format === 'env') {
    if (esc.trim().startsWith('#') || esc.trim().startsWith(';')) {
      return `<span class="tok-comment">${esc}</span>`;
    }
    return esc
      .replace(/^(\s*[a-zA-Z0-9_.-]+)(\s*[:=])/, '<span class="tok-key">$1</span>$2')
      .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-string">$1</span>')
      .replace(/\b(true|false)\b/gi, '<span class="tok-boolean">$1</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  }
  if (format === 'xml' || format === 'html' || format === 'svg') {
    return esc
      .replace(/(&lt;\/?[a-zA-Z0-9:_-]+)/g, '<span class="tok-tag">$1</span>')
      .replace(/([a-zA-Z0-9:_-]+)=(&quot;[^&]*?&quot;)/g, '<span class="tok-attr">$1</span>=<span class="tok-string">$2</span>');
  }
  if (format === 'sql') {
    return esc
      .replace(/\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|CREATE|TABLE|PRIMARY|KEY|TEXT|INTEGER|REAL|NULL|BEGIN|COMMIT)\b/gi, '<span class="tok-key">$1</span>')
      .replace(/(&#39;[^&]*?&#39;)/g, '<span class="tok-string">$1</span>');
  }
  return esc;
}

function renderSyntaxHighlightedBlock(text: string, format: string): string {
  const lines = text.split(/\r\n|\r|\n/);
  return lines
    .map(
      (line, idx) =>
        `<span class="code-line"><span class="code-line-num">${idx + 1}</span>${highlightCodeLine(line, format)}</span>`,
    )
    .join('\n');
}

function tryParseTabularPreview(text: string, format: string): { headers: string[]; rows: string[][] } | null {
  try {
    if (format === 'json') {
      const parsed = JSON.parse(text) as unknown;
      const arr = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as Record<string, unknown>).rows)
          ? ((parsed as Record<string, unknown>).rows as unknown[])
          : null;
      if (!arr || arr.length === 0 || typeof arr[0] !== 'object' || arr[0] === null) return null;
      const headers = Array.from(
        new Set(arr.slice(0, 50).flatMap((r) => (typeof r === 'object' && r ? Object.keys(r) : []))),
      );
      if (headers.length === 0) return null;
      const rows = arr.slice(0, 100).map((r) => {
        const obj = (r ?? {}) as Record<string, unknown>;
        return headers.map((h) => {
          const val = obj[h];
          return val === undefined || val === null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
        });
      });
      return { headers, rows };
    }
    if (format === 'csv' || format === 'tsv') {
      const delim = format === 'tsv' ? '\t' : ',';
      const lines = text
        .split(/\r\n|\r|\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) return null;
      const headers = lines[0].split(delim).map((h) => h.replace(/^"|"$/g, '').trim());
      const rows = lines.slice(1, 101).map((line) => line.split(delim).map((c) => c.replace(/^"|"$/g, '').trim()));
      return { headers, rows };
    }
  } catch {
    return null;
  }
  return null;
}

class OmniConvertApp {
  router = new ConversionRouter();
  serverClient = new ServerFallbackClient();
  device!: DeviceCapabilityProfile;
  workerPool!: WorkerPool;
  items: BatchQueueItem[] = [];
  queueFilter: QueueFilterMode = 'all';
  completedCount = 0;
  bytesProcessed = 0;
  private tempPreviewUrls: string[] = [];
  private cmdActiveIdx = 0;
  private currentCmdItems: CommandActionItem[] = [];

  dropzone = document.getElementById('dropzone');
  fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  queueList = document.getElementById('queue-list');
  batchToolbar = document.getElementById('batch-toolbar');
  tierOverview = document.getElementById('tier-overview');
  heroHeader = document.getElementById('hero-header');
  queueCountLabel = document.getElementById('queue-count-label');
  queueRouteBreakdown = document.getElementById('queue-route-breakdown');
  downloadZipBtn = document.getElementById('download-zip-btn') as HTMLButtonElement | null;
  batchTargetSelect = document.getElementById('batch-target-select') as HTMLSelectElement | null;
  previewBackdrop = document.getElementById('preview-backdrop');
  previewTitle = document.getElementById('preview-title');
  previewBody = document.getElementById('preview-body');
  pasteModalBackdrop = document.getElementById('paste-modal-backdrop');
  formatsModalBackdrop = document.getElementById('formats-modal-backdrop');
  formatsExplorerList = document.getElementById('formats-explorer-list');
  cmdModalBackdrop = document.getElementById('cmd-modal-backdrop');
  cmdPaletteInput = document.getElementById('cmd-palette-input') as HTMLInputElement | null;
  cmdResultsList = document.getElementById('cmd-results-list');
  toastStack = document.getElementById('toast-stack');

  async init(): Promise<void> {
    this.initTheme();
    this.device = await DeviceProfiler.detect();
    this.workerPool = new WorkerPool(this.device.hardwareConcurrency);
    this.updateDeviceCapabilityPill();
    this.renderLandingCategoryTabs('image');
    this.populateBatchTargetDropdown();
    this.updateTopCounters();
    this.bindEvents();
  }

  private updateDeviceCapabilityPill(): void {
    const el = document.getElementById('device-capability-pill');
    if (!el || !this.device) return;
    const parts: string[] = [`${this.device.hardwareConcurrency} Threads`];
    if (this.device.supportsOffscreenCanvas) parts.push('OffscreenCanvas');
    if (this.device.supportsWebAudio) parts.push('WebAudio DSP');
    parts.push('512B Magic Inspector');
    el.textContent = parts.join(' · ');
  }

  private showToast(message: string, type: 'info' | 'success' = 'info'): void {
    if (!this.toastStack) return;
    const toast = document.createElement('div');
    toast.className = `toast-card ${type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `
      <span class="status-indicator ${type === 'success' ? 'dot-emerald' : 'dot-amber'}"></span>
      <span>${escapeHtml(message)}</span>
    `;
    this.toastStack.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  private initTheme(): void {
    const saved = localStorage.getItem('omniconvert-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeIcons(theme);
  }

  private updateThemeIcons(theme: string): void {
    const moon = document.getElementById('theme-icon-moon');
    const sun = document.getElementById('theme-icon-sun');
    if (theme === 'dark') {
      moon?.classList.add('hidden');
      sun?.classList.remove('hidden');
    } else {
      moon?.classList.remove('hidden');
      sun?.classList.add('hidden');
    }
  }

  private toggleTheme(): void {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('omniconvert-theme', next);
    this.updateThemeIcons(next);
    this.showToast(`Switched to ${next === 'dark' ? 'Studio Darkroom' : 'Warm Studio Paper'} theme`);
  }

  private openPasteModal(presetExt?: string, presetTarget?: string, sampleContent?: string): void {
    const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
    const tgtSelect = document.getElementById('paste-target-format') as HTMLSelectElement | null;
    const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
    const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;

    if (presetExt && fmtSelect) {
      fmtSelect.value = presetExt;
      fmtSelect.dispatchEvent(new Event('change'));
    }
    if (tgtSelect) {
      tgtSelect.value = presetTarget ?? '';
    }
    if (sampleContent !== undefined && textarea) {
      textarea.value = sampleContent;
      this.updatePasteEditorMeta();
    }
    if (presetExt && nameInput) {
      nameInput.value = `snippet.${presetExt}`;
    }

    this.pasteModalBackdrop?.classList.remove('hidden');
    textarea?.focus();
  }

  private closePasteModal(): void {
    this.pasteModalBackdrop?.classList.add('hidden');
  }

  private updatePasteEditorMeta(): void {
    const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
    const metaEl = document.getElementById('paste-editor-meta');
    if (!textarea || !metaEl) return;
    const val = textarea.value;
    const lines = val ? val.split(/\r\n|\r|\n/).length : 0;
    const bytes = new TextEncoder().encode(val).length;
    metaEl.textContent = `${lines} line${lines === 1 ? '' : 's'} · ${formatBytes(bytes)}`;
  }

  private openCommandPalette(): void {
    if (!this.cmdModalBackdrop) return;
    this.cmdModalBackdrop.classList.remove('hidden');
    if (this.cmdPaletteInput) {
      this.cmdPaletteInput.value = '';
      this.renderCommandPaletteResults('');
      requestAnimationFrame(() => this.cmdPaletteInput?.focus());
    }
  }

  private closeCommandPalette(): void {
    this.cmdModalBackdrop?.classList.add('hidden');
  }

  private buildCommandActions(query: string): CommandActionItem[] {
    const q = query.trim().toLowerCase();
    const actions: CommandActionItem[] = [
      {
        id: 'act-demo',
        badge: '⚡',
        title: 'Load 5-File Studio Sample Batch',
        subtitle: 'Generates test PNG, WAV synth triad, CSV catalog, Markdown & DOCX',
        shortcut: 'DEMO',
        execute: () => {
          document.getElementById('load-demo-btn')?.click();
        },
      },
      {
        id: 'act-browse',
        badge: '📁',
        title: 'Choose Files from Computer...',
        subtitle: 'Open native file dialog for batch upload',
        shortcut: 'OPEN',
        execute: () => {
          this.fileInput?.click();
        },
      },
      {
        id: 'act-paste',
        badge: '📋',
        title: 'Open Live Data & Markup Paste Workbench',
        subtitle: 'Author or paste JSON, CSV, YAML, XML, TOML, Markdown, HTML, SQL',
        shortcut: 'PASTE',
        execute: () => {
          this.openPasteModal();
        },
      },
      {
        id: 'act-convert-all',
        badge: '▶',
        title: 'Convert All Ready Files in Queue',
        subtitle: `Run batch conversion across ${this.items.length} queued file(s)`,
        shortcut: 'RUN',
        execute: () => {
          void this.convertAllReady();
        },
      },
      {
        id: 'act-theme',
        badge: '◐',
        title: 'Toggle Studio Light / Darkroom Theme',
        subtitle: 'Switch between Warm Studio Paper and Studio Darkroom',
        shortcut: 'THEME',
        execute: () => {
          this.toggleTheme();
        },
      },
      {
        id: 'act-formats',
        badge: '85+',
        title: 'Browse Full 85+ Supported Formats Directory',
        subtitle: 'Inspect MIME types, categories, and codecs',
        shortcut: 'DIR',
        execute: () => {
          this.renderFormatsExplorer();
          this.formatsModalBackdrop?.classList.remove('hidden');
        },
      },
    ];

    if (this.items.some((i) => i.status === 'completed' && i.output)) {
      actions.unshift({
        id: 'act-zip',
        badge: 'ZIP',
        title: 'Download All Completed Files (.ZIP)',
        subtitle: 'Bundle all finished outputs into a single archive',
        shortcut: 'SAVE',
        execute: () => {
          void this.downloadAllAsZip();
        },
      });
    }

    // Recipe commands for popular pairs
    const recipes: Array<{ src: string; tgt: string; desc: string }> = [
      { src: 'csv', tgt: 'json', desc: 'Convert tabular CSV into structured JSON' },
      { src: 'json', tgt: 'yaml', desc: 'Convert JSON payload to clean YAML config' },
      { src: 'json', tgt: 'csv', desc: 'Flatten JSON array into CSV spreadsheet' },
      { src: 'md', tgt: 'pdf', desc: 'Render Markdown document into formatted PDF' },
      { src: 'md', tgt: 'html', desc: 'Compile Markdown into standalone HTML5' },
      { src: 'xml', tgt: 'json', desc: 'Transform XML tree into JSON object' },
    ];

    for (const r of recipes) {
      actions.push({
        id: `recipe-${r.src}-${r.tgt}`,
        badge: `${r.src.toUpperCase()}→${r.tgt.toUpperCase()}`,
        title: `Quick Recipe: ${r.src.toUpperCase()} to ${r.tgt.toUpperCase()}`,
        subtitle: r.desc,
        shortcut: 'RECIPE',
        execute: () => {
          const tpl = PASTE_TEMPLATES[r.src];
          this.openPasteModal(r.src, r.tgt, tpl?.content);
        },
      });
    }

    // Format catalog items
    for (const fmt of CLIENT_FORMATS) {
      actions.push({
        id: `fmt-${fmt.id}`,
        badge: fmt.label,
        title: `${fmt.label} — ${fmt.name}`,
        subtitle: `${fmt.description} (${fmt.mimeType})`,
        shortcut: fmt.category.toUpperCase(),
        execute: () => {
          if (this.items.length > 0) {
            let applied = 0;
            for (const item of this.items) {
              if (isBusyStatus(item.status)) continue;
              const compat = getCompatibleTargets(item.sourceFormat);
              if (compat.some((c) => c.id === fmt.id)) {
                item.targetFormat = fmt.id;
                item.presetId = '';
                this.resetCompletedItemForReconvert(item);
                this.recomputeRouting(item);
                applied++;
              }
            }
            if (applied > 0) {
              this.renderQueue();
              this.showToast(`Set target format to ${fmt.label} for ${applied} file(s)`, 'success');
              return;
            }
          }
          if (TEXT_TARGET_IDS.has(fmt.id)) {
            const tpl = PASTE_TEMPLATES[fmt.id];
            this.openPasteModal(fmt.id, undefined, tpl?.content);
          } else {
            this.fileInput?.click();
          }
        },
      });
    }

    if (!q) {
      return actions.slice(0, 14);
    }

    return actions
      .filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.subtitle.toLowerCase().includes(q) ||
          a.badge.toLowerCase().includes(q),
      )
      .slice(0, 18);
  }

  private renderCommandPaletteResults(query: string): void {
    if (!this.cmdResultsList) return;
    this.currentCmdItems = this.buildCommandActions(query);
    this.cmdActiveIdx = 0;

    if (this.currentCmdItems.length === 0) {
      this.cmdResultsList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.83rem;">No matching commands or formats found.</div>`;
      return;
    }

    this.cmdResultsList.innerHTML = this.currentCmdItems
      .map(
        (item, idx) => `
        <button type="button" class="cmd-item ${idx === this.cmdActiveIdx ? 'is-active' : ''}" data-cmd-idx="${idx}" role="option">
          <div class="cmd-item-left">
            <span class="cmd-item-icon">${escapeHtml(item.badge.slice(0, 4))}</span>
            <div>
              <div class="cmd-item-title">${escapeHtml(item.title)}</div>
              <div class="cmd-item-sub">${escapeHtml(item.subtitle)}</div>
            </div>
          </div>
          ${item.shortcut ? `<kbd class="keycap">${escapeHtml(item.shortcut)}</kbd>` : ''}
        </button>
      `,
      )
      .join('');
  }

  private closePreviewModal(): void {
    this.previewBackdrop?.classList.add('hidden');
    if (this.previewBody) {
      this.previewBody.innerHTML = '';
    }
    for (const url of this.tempPreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.tempPreviewUrls = [];
  }

  private bindEvents(): void {
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

    // Command Palette bindings
    document.getElementById('open-cmd-palette-btn')?.addEventListener('click', () => this.openCommandPalette());
    this.cmdModalBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.cmdModalBackdrop) this.closeCommandPalette();
    });
    this.cmdPaletteInput?.addEventListener('input', () => {
      this.renderCommandPaletteResults(this.cmdPaletteInput?.value ?? '');
    });
    this.cmdPaletteInput?.addEventListener('keydown', (e) => {
      if (this.currentCmdItems.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.cmdActiveIdx = (this.cmdActiveIdx + 1) % this.currentCmdItems.length;
        this.syncCommandHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.cmdActiveIdx = (this.cmdActiveIdx - 1 + this.currentCmdItems.length) % this.currentCmdItems.length;
        this.syncCommandHighlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = this.currentCmdItems[this.cmdActiveIdx];
        if (chosen) {
          this.closeCommandPalette();
          chosen.execute();
        }
      }
    });
    this.cmdResultsList?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.cmd-item');
      if (!btn) return;
      const idx = Number(btn.dataset.cmdIdx ?? '0');
      const chosen = this.currentCmdItems[idx];
      if (chosen) {
        this.closeCommandPalette();
        chosen.execute();
      }
    });

    // Browse & File Input
    document.getElementById('browse-files-btn')?.addEventListener('click', () => {
      this.fileInput?.click();
    });
    this.fileInput?.addEventListener('change', () => {
      if (this.fileInput?.files && this.fileInput.files.length > 0) {
        void this.ingestFiles(Array.from(this.fileInput.files));
        this.fileInput.value = '';
      }
    });

    // Demo Sample Batch Generator
    document.getElementById('load-demo-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('load-demo-btn') as HTMLButtonElement | null;
      if (!btn) return;
      btn.disabled = true;
      const oldHtml = btn.innerHTML;
      btn.textContent = 'Synthesizing 5 studio files...';
      try {
        const files = await createDemoSampleFiles();
        await this.ingestFiles(files);
        this.showToast('Loaded 5-file studio sample batch (PNG, CSV, MD, WAV, DOCX)', 'success');
      } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    });

    // Paste Modal (header & dropzone hero buttons)
    document.getElementById('paste-text-btn')?.addEventListener('click', () => this.openPasteModal());
    document.getElementById('paste-text-btn-hero')?.addEventListener('click', () => this.openPasteModal());
    document.getElementById('close-paste-modal-btn')?.addEventListener('click', () => this.closePasteModal());
    document.getElementById('cancel-paste-btn')?.addEventListener('click', () => this.closePasteModal());
    this.pasteModalBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.pasteModalBackdrop) this.closePasteModal();
    });

    // Paste Template chips
    document.querySelectorAll<HTMLButtonElement>('[data-paste-template]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.pasteTemplate ?? 'json';
        const tpl = PASTE_TEMPLATES[key];
        if (!tpl) return;
        const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
        const tgtSelect = document.getElementById('paste-target-format') as HTMLSelectElement | null;
        const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
        const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
        if (fmtSelect) fmtSelect.value = tpl.ext;
        if (tgtSelect) tgtSelect.value = tpl.target;
        if (nameInput) nameInput.value = tpl.filename;
        if (textarea) textarea.value = tpl.content;
        this.updatePasteEditorMeta();
      });
    });

    document.getElementById('paste-textarea')?.addEventListener('input', () => {
      this.updatePasteEditorMeta();
    });

    document.getElementById('paste-source-format')?.addEventListener('change', (e) => {
      const ext = (e.target as HTMLSelectElement).value;
      const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
      if (nameInput) {
        const base = nameInput.value.trim().replace(/\.[a-z0-9]+$/i, '') || 'snippet';
        nameInput.value = `${base}.${ext}`;
      }
      const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
      if (textarea) {
        const placeholders: Record<string, string> = {
          json: '{\n  "key": "value"\n}',
          csv: 'id,name\n1,test',
          yaml: 'key: value\nlist:\n  - item1',
          xml: '<?xml version="1.0"?>\n<root>\n  <key>value</key>\n</root>',
          toml: '[table]\nkey = "value"',
          md: '# Heading\n**bold** text',
          html: '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>',
          ini: '[section]\nkey=value',
          txt: 'Type your text here...',
        };
        textarea.placeholder = placeholders[ext] || placeholders['txt'];
      }
    });

    const handlePasteSubmit = async (convertImmediately: boolean) => {
      const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
      const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
      const tgtSelect = document.getElementById('paste-target-format') as HTMLSelectElement | null;
      const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
      const text = textarea?.value.trim() ?? '';
      if (!text) return;
      const ext = fmtSelect?.value ?? 'txt';
      const targetOverride = tgtSelect?.value || undefined;
      const name = nameInput?.value.trim() || `snippet.${ext}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], name, { type: 'text/plain' });
      const created = await this.ingestFiles([file], targetOverride);
      if (textarea) textarea.value = '';
      this.updatePasteEditorMeta();
      this.closePasteModal();
      if (convertImmediately && created.length > 0) {
        void this.runItem(created[0]);
      }
    };

    document.getElementById('add-paste-btn')?.addEventListener('click', () => {
      void handlePasteSubmit(false);
    });
    document.getElementById('convert-paste-now-btn')?.addEventListener('click', () => {
      void handlePasteSubmit(true);
    });

    // Global Clipboard Paste Interceptor (Ctrl+V anywhere outside inputs)
    document.addEventListener('paste', (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        void this.ingestFiles(Array.from(files));
        this.showToast(`Pasted ${files.length} file(s) from clipboard`, 'success');
        return;
      }
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text) {
        e.preventDefault();
        const detected = detectTextFormatFromContent(text);
        const file = new File([new Blob([text], { type: 'text/plain' })], detected.name, {
          type: 'text/plain',
        });
        void this.ingestFiles([file]);
        this.showToast(`Pasted ${detected.ext.toUpperCase()} snippet from clipboard`, 'success');
      }
    });

    // Formats Directory Modal
    const openFormatsDirectory = () => {
      this.renderFormatsExplorer();
      this.formatsModalBackdrop?.classList.remove('hidden');
    };
    document.getElementById('open-formats-btn')?.addEventListener('click', openFormatsDirectory);
    document.getElementById('open-full-directory-btn')?.addEventListener('click', openFormatsDirectory);
    document.getElementById('close-formats-modal-btn')?.addEventListener('click', () => {
      this.formatsModalBackdrop?.classList.add('hidden');
    });
    this.formatsModalBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.formatsModalBackdrop) {
        this.formatsModalBackdrop?.classList.add('hidden');
      }
    });
    document.getElementById('formats-search-input')?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderFormatsExplorer(query);
    });

    // Clicking a row in Formats Directory
    this.formatsExplorerList?.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-dir-format]');
      if (!row) return;
      const fmtId = row.dataset.dirFormat;
      if (!fmtId) return;
      this.formatsModalBackdrop?.classList.add('hidden');
      if (TEXT_TARGET_IDS.has(fmtId)) {
        const tpl = PASTE_TEMPLATES[fmtId];
        this.openPasteModal(fmtId, undefined, tpl?.content);
      } else {
        this.fileInput?.click();
      }
    });

    // Drag and drop on Dropzone & Full Window
    if (this.dropzone) {
      ['dragenter', 'dragover'].forEach((evt) => {
        this.dropzone?.addEventListener(evt, (e) => {
          e.preventDefault();
          this.dropzone?.classList.add('drag-active');
        });
      });
      ['dragleave', 'drop'].forEach((evt) => {
        this.dropzone?.addEventListener(evt, (e) => {
          e.preventDefault();
          this.dropzone?.classList.remove('drag-active');
        });
      });
      this.dropzone.addEventListener('drop', (e) => {
        const dt = (e as DragEvent).dataTransfer;
        if (dt?.files && dt.files.length > 0) {
          void this.ingestFiles(Array.from(dt.files));
        }
      });
      this.dropzone.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, select')) return;
        this.fileInput?.click();
      });
    }

    // Batch Toolbar Controls
    document.getElementById('convert-all-btn')?.addEventListener('click', () => {
      void this.convertAllReady();
    });
    document.getElementById('clear-completed-btn')?.addEventListener('click', () => {
      for (const item of this.items) {
        if (item.status === 'completed' || item.status === 'cancelled') {
          if (item.output?.objectUrl) URL.revokeObjectURL(item.output.objectUrl);
          if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        }
      }
      this.items = this.items.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');
      this.renderQueue();
    });
    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
      for (const item of this.items) {
        if (item.abortController) item.abortController.abort();
        if (item.output?.objectUrl) URL.revokeObjectURL(item.output.objectUrl);
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      }
      this.items = [];
      this.queueFilter = 'all';
      this.renderQueue();
    });
    this.downloadZipBtn?.addEventListener('click', () => {
      void this.downloadAllAsZip();
    });

    // Queue Status Filter Tabs
    document.getElementById('queue-filter-tabs')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.queue-filter-btn');
      if (!btn) return;
      const mode = (btn.dataset.filter as QueueFilterMode) || 'all';
      this.queueFilter = mode;
      document.querySelectorAll('#queue-filter-tabs .queue-filter-btn').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      this.renderQueue();
    });

    this.batchTargetSelect?.addEventListener('change', () => {
      const target = this.batchTargetSelect?.value;
      if (!target) return;
      let count = 0;
      for (const item of this.items) {
        if (isBusyStatus(item.status)) continue;
        const compatible = getCompatibleTargets(item.sourceFormat);
        if (compatible.some((f) => f.id === target)) {
          item.targetFormat = target;
          item.presetId = '';
          this.resetCompletedItemForReconvert(item);
          this.recomputeRouting(item);
          count++;
        }
      }
      if (this.batchTargetSelect) this.batchTargetSelect.value = '';
      this.renderQueue();
      if (count > 0) {
        this.showToast(`Updated target format to ${target.toUpperCase()} for ${count} file(s)`, 'success');
      }
    });

    // Landing Category Tabs
    document.getElementById('landing-category-tabs')?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab-btn');
      if (!target) return;
      document.querySelectorAll('#landing-category-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      target.classList.add('active');
      const cat = target.dataset.cat as FormatCategory;
      this.renderLandingCategoryTabs(cat);
    });

    // Preview modal close
    document.getElementById('close-preview-btn')?.addEventListener('click', () => {
      this.closePreviewModal();
    });
    this.previewBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.previewBackdrop) {
        this.closePreviewModal();
      }
    });

    // Global Keyboard Shortcuts (Ctrl+K / Cmd+K & Escape)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.cmdModalBackdrop && !this.cmdModalBackdrop.classList.contains('hidden')) {
          this.closeCommandPalette();
        } else {
          this.openCommandPalette();
        }
        return;
      }
      if (e.key !== 'Escape') return;
      if (this.cmdModalBackdrop && !this.cmdModalBackdrop.classList.contains('hidden')) {
        this.closeCommandPalette();
      } else if (this.previewBackdrop && !this.previewBackdrop.classList.contains('hidden')) {
        this.closePreviewModal();
      } else if (this.pasteModalBackdrop && !this.pasteModalBackdrop.classList.contains('hidden')) {
        this.closePasteModal();
      } else if (this.formatsModalBackdrop && !this.formatsModalBackdrop.classList.contains('hidden')) {
        this.formatsModalBackdrop.classList.add('hidden');
      }
    });

    // Interactive Quick-Format Recipe Pills in Dropzone
    document.querySelectorAll<HTMLElement>('.quick-format-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = pill.dataset.recipeSrc ?? '';
        const tgt = pill.dataset.recipeTgt ?? '';
        if (src && TEXT_TARGET_IDS.has(src)) {
          const tpl = PASTE_TEMPLATES[src];
          this.openPasteModal(src, tgt || undefined, tpl?.content);
        } else {
          this.fileInput?.click();
        }
      });
    });

    // Format chips click delegation
    document.getElementById('landing-format-chips')?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.format-chip') as HTMLElement | null;
      if (!target) return;
      const fmtId = target.getAttribute('data-pick-format');
      if (!fmtId) return;
      if (TEXT_TARGET_IDS.has(fmtId)) {
        const tpl = PASTE_TEMPLATES[fmtId];
        this.openPasteModal(fmtId, undefined, tpl?.content);
      } else {
        this.fileInput?.click();
      }
    });
  }

  private syncCommandHighlight(): void {
    if (!this.cmdResultsList) return;
    const buttons = Array.from(this.cmdResultsList.querySelectorAll<HTMLButtonElement>('.cmd-item'));
    buttons.forEach((b, i) => b.classList.toggle('is-active', i === this.cmdActiveIdx));
    buttons[this.cmdActiveIdx]?.scrollIntoView({ block: 'nearest' });
  }

  private renderLandingCategoryTabs(category: FormatCategory): void {
    const container = document.getElementById('landing-format-chips');
    if (!container) return;
    const formats = CLIENT_FORMATS.filter((f) => f.category === category);
    container.innerHTML = formats
      .map((f) => {
        const targetsCount = getCompatibleTargets(f.id).length;
        return `
          <button type="button" class="format-chip" data-pick-format="${escapeHtml(f.id)}" data-cat="${escapeHtml(f.category)}">
            <div class="format-chip-top">
              <strong>${escapeHtml(f.label)}</strong>
              <span class="format-chip-targets">${targetsCount} targets</span>
            </div>
            <span>${escapeHtml(f.name)}</span>
          </button>
        `;
      })
      .join('');
  }

  private populateBatchTargetDropdown(): void {
    if (!this.batchTargetSelect) return;
    const popular = ['webp', 'png', 'jpg', 'avif', 'mp3', 'wav', 'json', 'csv', 'yaml', 'pdf', 'zip'];
    this.batchTargetSelect.innerHTML =
      `<option value="">Set all compatible to...</option>` +
      popular
        .map((id) => {
          const fmt = getFormatById(id);
          return `<option value="${id}">${fmt ? fmt.label : id.toUpperCase()}</option>`;
        })
        .join('');
  }

  private renderFormatsExplorer(query = ''): void {
    const listEl = this.formatsExplorerList;
    if (!listEl) return;
    const filtered = CLIENT_FORMATS.filter((f) => {
      if (!query) return true;
      return (
        f.id.includes(query) ||
        f.name.toLowerCase().includes(query) ||
        f.category.includes(query) ||
        f.mimeType.toLowerCase().includes(query)
      );
    });
    const categoryLabels: Record<FormatCategory, string> = {
      image: 'Image',
      audio: 'Audio',
      video: 'Video',
      data: 'Data',
      document: 'Document',
      ebook: 'E-Book',
      archive: 'Archive',
      font: 'Font',
      vector: 'Vector',
      cad: 'CAD',
    };
    listEl.innerHTML = filtered
      .map((f) => {
        const compatCount = getCompatibleTargets(f.id).length;
        return `
          <div class="format-row-item" data-dir-format="${escapeHtml(f.id)}" title="Click to start a ${escapeHtml(f.label)} conversion">
            <div>
              <strong>${escapeHtml(f.label)}</strong> <span class="muted">(${escapeHtml(f.mimeType)})</span>
              <div class="muted">${escapeHtml(f.name)} — ${escapeHtml(f.description)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span class="muted" style="font-family:var(--font-mono);font-size:0.72rem;">→ ${compatCount} targets</span>
              <span class="fmt-pill" data-cat="${escapeHtml(f.category)}">${escapeHtml(categoryLabels[f.category] ?? f.category)}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private updateTopCounters(): void {
    const el = document.getElementById('stats-counter-text');
    if (!el) return;
    if (this.completedCount === 0) {
      el.textContent = '0 converted · Ready';
      return;
    }
    el.textContent = `${this.completedCount} converted · ${formatBytes(this.bytesProcessed)}`;
  }

  private async ingestFiles(files: File[], targetOverride?: string): Promise<BatchQueueItem[]> {
    const added: BatchQueueItem[] = [];
    for (const file of files) {
      const headerBuf = await file.slice(0, 512).arrayBuffer();
      const headerBytes = new Uint8Array(headerBuf);
      const magic = inspectFileMagicBytes(headerBytes, file.name);
      const sourceFormat = magic.detectedFormatId ?? 'txt';
      const defaultTarget = getDefaultTargetForSource(sourceFormat);
      const compatible = getCompatibleTargets(sourceFormat);
      const targetFormat =
        targetOverride && compatible.some((c) => c.id === targetOverride) ? targetOverride : defaultTarget;

      const options: ConversionOptions = {
        quality: 85,
        stripMetadata: true,
        forceExecutionMode: 'AUTO',
        autoDeleteServerFile: true,
      };
      const routing = this.evaluateRoute(file, headerBytes, sourceFormat, targetFormat, options);
      let thumbnailUrl: string | undefined;
      if (file.type.startsWith('image/') || IMAGE_EXTENSIONS.has(sourceFormat)) {
        thumbnailUrl = URL.createObjectURL(file);
      }
      const item: BatchQueueItem = {
        id: crypto.randomUUID(),
        file,
        headerBytes,
        magic,
        sourceFormat,
        targetFormat,
        presetId: '',
        options,
        routing,
        status: 'pending',
        progressPercent: 0,
        stageMessage: 'Ready to convert',
        expandedSettings: false,
        thumbnailUrl,
      };
      this.items.push(item);
      added.push(item);
    }
    this.renderQueue();
    return added;
  }

  private evaluateRoute(
    file: File,
    headerBytes: Uint8Array,
    sourceFormat: string,
    targetFormat: string,
    options: ConversionOptions,
  ): RoutingDecision {
    const autoOptions: ConversionOptions = {
      ...options,
      forceExecutionMode: 'AUTO',
      autoDeleteServerFile: true,
    };
    return this.router.route(
      { name: file.name, sizeBytes: file.size, headerBytes },
      sourceFormat,
      targetFormat,
      autoOptions,
      this.device,
    );
  }

  private resetCompletedItemForReconvert(item: BatchQueueItem): void {
    if (item.status === 'completed' || item.status === 'cancelled' || item.status === 'failed') {
      if (item.output?.objectUrl) {
        URL.revokeObjectURL(item.output.objectUrl);
      }
      item.output = undefined;
      item.durationMs = undefined;
      item.errorMessage = undefined;
      item.status = 'pending';
      item.progressPercent = 0;
      item.stageMessage = 'Ready to convert';
    }
  }

  private recomputeRouting(item: BatchQueueItem): void {
    item.options = {
      ...item.options,
      forceExecutionMode: 'AUTO',
      autoDeleteServerFile: true,
    };
    item.routing = this.evaluateRoute(
      item.file,
      item.headerBytes,
      item.sourceFormat,
      item.targetFormat,
      item.options,
    );
    if (item.status === 'pending' || item.status === 'failed') {
      item.status = 'pending';
      item.progressPercent = 0;
      item.errorMessage = undefined;
      item.stageMessage = 'Ready to convert';
    }
  }

  private getFilteredItems(): BatchQueueItem[] {
    if (this.queueFilter === 'pending') {
      return this.items.filter((i) => i.status === 'pending' || isBusyStatus(i.status));
    }
    if (this.queueFilter === 'completed') {
      return this.items.filter((i) => i.status === 'completed');
    }
    if (this.queueFilter === 'failed') {
      return this.items.filter((i) => i.status === 'failed' || i.status === 'cancelled');
    }
    return this.items;
  }

  private renderQueue(): void {
    const hasItems = this.items.length > 0;
    this.batchToolbar?.classList.toggle('hidden', !hasItems);
    this.tierOverview?.classList.toggle('hidden', hasItems);
    this.heroHeader?.classList.toggle('compact', hasItems);
    this.dropzone?.classList.toggle('compact', hasItems);
    if (!this.queueList) return;
    if (!hasItems) {
      this.queueList.innerHTML = '';
      return;
    }

    const completedCount = this.items.filter((i) => i.status === 'completed' && i.output).length;
    const busyCount = this.items.filter((i) => isBusyStatus(i.status)).length;
    const localCount = this.items.filter((i) => i.routing.isLocal).length;

    if (this.queueCountLabel) {
      this.queueCountLabel.textContent = `${this.items.length} file${this.items.length === 1 ? '' : 's'}`;
    }
    if (this.queueRouteBreakdown) {
      if (completedCount === this.items.length) {
        this.queueRouteBreakdown.textContent = `All ${completedCount} converted`;
      } else if (busyCount > 0) {
        this.queueRouteBreakdown.textContent = `Converting ${busyCount} · ${completedCount} done`;
      } else if (completedCount > 0) {
        this.queueRouteBreakdown.textContent = `${completedCount}/${this.items.length} done · ${localCount} on-device`;
      } else {
        this.queueRouteBreakdown.textContent = `${localCount} local zero-upload · ${this.items.length - localCount} cloud fallback`;
      }
    }

    this.downloadZipBtn?.classList.toggle('hidden', completedCount < 2);

    const visibleItems = this.getFilteredItems();
    if (visibleItems.length === 0) {
      this.queueList.innerHTML = `
        <div class="surface-card" style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem;">
          No files match the "${escapeHtml(this.queueFilter)}" filter.
        </div>
      `;
      return;
    }

    this.queueList.innerHTML = visibleItems.map((item) => this.renderJobCard(item)).join('');
    this.attachCardListeners();
  }

  private renderContextualOptions(item: BatchQueueItem): string {
    const srcCat = getFormatById(item.sourceFormat)?.category;
    const tgt = item.targetFormat;
    const parts: string[] = [];
    if (['png', 'jpg', 'webp', 'avif', 'bmp', 'ico'].includes(tgt) || (srcCat === 'image' && tgt !== 'pdf')) {
      if (['jpg', 'webp', 'avif'].includes(tgt)) {
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
          <input type="number" placeholder="Auto" min="16" max="8192" value="${item.options.width ?? ''}" data-opt="width" data-id="${item.id}" />
        </label>
        <label class="opt-field">
          <span>Height (px)</span>
          <input type="number" placeholder="Auto" min="16" max="8192" value="${item.options.height ?? ''}" data-opt="height" data-id="${item.id}" />
        </label>
        <label class="opt-field">
          <input type="checkbox" ${item.options.stripMetadata !== false ? 'checked' : ''} data-opt="stripMetadata" data-id="${item.id}" />
          <span>Strip EXIF metadata</span>
        </label>
      `);
    } else if (srcCat === 'audio' || tgt === 'wav' || tgt === 'mp3' || tgt === 'ogg' || tgt === 'flac' || tgt === 'aac') {
      parts.push(`
        <label class="opt-field">
          <span>Sample Rate</span>
          <select data-opt="sampleRate" data-id="${item.id}">
            <option value="" ${!item.options.sampleRate ? 'selected' : ''}>Original</option>
            <option value="44100" ${item.options.sampleRate === 44100 ? 'selected' : ''}>44.1 kHz</option>
            <option value="48000" ${item.options.sampleRate === 48000 ? 'selected' : ''}>48 kHz</option>
            <option value="16000" ${item.options.sampleRate === 16000 ? 'selected' : ''}>16 kHz Voice</option>
          </select>
        </label>
        <label class="opt-field">
          <span>Channels</span>
          <select data-opt="channels" data-id="${item.id}">
            <option value="" ${!item.options.channels ? 'selected' : ''}>Auto</option>
            <option value="2" ${item.options.channels === 2 ? 'selected' : ''}>Stereo</option>
            <option value="1" ${item.options.channels === 1 ? 'selected' : ''}>Mono</option>
          </select>
        </label>
        <label class="opt-field">
          <input type="checkbox" ${item.options.normalizeAudio ? 'checked' : ''} data-opt="normalizeAudio" data-id="${item.id}" />
          <span>Normalize (-1 dB)</span>
        </label>
      `);
    } else if (srcCat === 'data' || TEXT_TARGET_IDS.has(tgt)) {
      if (['json', 'xml', 'yaml', 'toml', 'html'].includes(tgt) || srcCat === 'data') {
        parts.push(`
          <label class="opt-field">
            <span>Indentation</span>
            <select data-opt="indentSpaces" data-id="${item.id}">
              <option value="2" ${(item.options.indentSpaces ?? 2) === 2 ? 'selected' : ''}>2 spaces</option>
              <option value="4" ${item.options.indentSpaces === 4 ? 'selected' : ''}>4 spaces</option>
              <option value="0" ${item.options.indentSpaces === 0 ? 'selected' : ''}>Minified</option>
            </select>
          </label>
        `);
      }
      if (item.sourceFormat === 'csv' || tgt === 'csv') {
        parts.push(`
          <label class="opt-field">
            <span>CSV Delimiter</span>
            <select data-opt="csvDelimiter" data-id="${item.id}">
              <option value="," ${(item.options.csvDelimiter ?? ',') === ',' ? 'selected' : ''}>Comma (,)</option>
              <option value=";" ${item.options.csvDelimiter === ';' ? 'selected' : ''}>Semicolon (;)</option>
              <option value="&#9;" ${item.options.csvDelimiter === '\t' ? 'selected' : ''}>Tab (\\t)</option>
              <option value="|" ${item.options.csvDelimiter === '|' ? 'selected' : ''}>Pipe (|)</option>
            </select>
          </label>
        `);
      }
      if (tgt === 'sql') {
        parts.push(`
          <label class="opt-field">
            <span>SQL Table</span>
            <input type="text" value="${escapeHtml(item.options.sqlTableName ?? 'records')}" data-opt="sqlTableName" data-id="${item.id}" style="width:120px" />
          </label>
        `);
      }
    }
    if (tgt === 'pdf' || srcCat === 'document') {
      parts.push(`
        <label class="opt-field">
          <span>Page Size</span>
          <select data-opt="pageSize" data-id="${item.id}">
            <option value="A4" ${(item.options.pageSize ?? 'A4') === 'A4' ? 'selected' : ''}>A4</option>
            <option value="Letter" ${item.options.pageSize === 'Letter' ? 'selected' : ''}>Letter</option>
          </select>
        </label>
      `);
    }
    return parts.length > 0
      ? `<div class="settings-row">${parts.join('')}</div>`
      : `<div class="muted">No additional options for ${escapeHtml(tgt.toUpperCase())}.</div>`;
  }

  private renderJobCard(item: BatchQueueItem): string {
    const srcDef = getFormatById(item.sourceFormat);
    const category = srcDef?.category ?? 'document';
    const presets = getPresetsForCategory(category);
    const compatibleFormats = getCompatibleTargets(item.sourceFormat);
    const badge = statusBadgeMeta(item);
    const isBusy = isBusyStatus(item.status);
    let deltaBadge = '';
    if (item.status === 'completed' && item.output) {
      const { pct, pctStr } = computeSizeDelta(item.file.size, item.output.bytes.length);
      const timing = item.durationMs !== undefined ? ` · ${item.durationMs}ms` : '';
      deltaBadge = `<span class="delta-text ${pct > 0 ? 'larger' : ''}">${formatBytes(item.output.bytes.length)} (${pctStr})${timing}</span>`;
    }
    const fileIconSvg = item.thumbnailUrl
      ? `<img src="${item.thumbnailUrl}" alt="" />`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;

    const magicTag = item.magic.isSpoofedOrMismatched
      ? `<span class="fmt-pill spoof" title="Header magic bytes differ from extension">MAGIC: ${escapeHtml(item.sourceFormat)}</span>`
      : item.magic.confidence === 'magic'
        ? `<span class="magic-verified-tag" title="Verified by 512-byte magic signature">✓ sig</span>`
        : '';

    return `
      <article class="job-card status-${item.status}" data-job-id="${item.id}">
        <div class="progress-line-track">
          <div class="progress-line-fill ${item.routing.isLocal ? '' : 'server'}" style="width: ${item.progressPercent}%"></div>
        </div>
        <div class="job-main-row">
          <div class="job-file-col">
            <div class="file-thumb" data-cat="${escapeHtml(category)}" aria-hidden="true">${fileIconSvg}</div>
            <div class="file-meta-col">
              <span class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span>
              <div class="file-subline">
                <span>${formatBytes(item.file.size)}</span>
                <span class="fmt-pill" data-cat="${escapeHtml(category)}">${escapeHtml(item.sourceFormat)}</span>
                ${magicTag}
              </div>
            </div>
          </div>
          <div class="job-convert-col">
            <span class="arrow-muted" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </span>
            ${createFormatPickerTriggerHtml(item.id, item.targetFormat, compatibleFormats)}
            ${
              presets.length > 0
                ? `
              <select class="preset-select" data-action="preset" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>
                <option value="">Preset...</option>
                ${presets.map((p) => `<option value="${escapeHtml(p.id)}" ${item.presetId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
              </select>`
                : ''
            }
            <button type="button" class="settings-toggle-btn ${item.expandedSettings ? 'active' : ''}" data-action="toggle-settings" data-id="${item.id}" title="Conversion parameters">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
          <div class="job-actions-col">
            <span class="route-pill ${badge.pillClass}" data-status-pill style="${badge.inlineStyle}">
              ${escapeHtml(badge.label)}
            </span>
            ${deltaBadge}
            ${
              isBusy
                ? `<button type="button" class="btn btn-xs btn-danger" data-action="cancel" data-id="${item.id}">Cancel</button>`
                : item.status === 'completed' && item.output
                  ? `
                    <button type="button" class="btn btn-xs btn-secondary" data-action="preview" data-id="${item.id}">Inspect</button>
                    <a class="btn btn-xs btn-success" href="${item.output.objectUrl}" download="${escapeHtml(item.output.filename)}">Download</a>
                  `
                  : `<button type="button" class="btn btn-xs btn-primary" data-action="convert" data-id="${item.id}">Convert</button>`
            }
            <button type="button" class="icon-btn" data-action="remove" data-id="${item.id}" title="Remove file" style="width:28px;height:28px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        ${
          item.expandedSettings
            ? `<div class="job-settings-drawer">${this.renderContextualOptions(item)}</div>`
            : ''
        }
        ${item.errorMessage ? `<div class="inline-alert error">${escapeHtml(item.errorMessage)}</div>` : ''}
        <div class="job-progress-bar">
          <span>${escapeHtml(item.stageMessage)}</span>
          <span>${Math.round(item.progressPercent)}%</span>
        </div>
      </article>
    `;
  }

  private attachCardListeners(): void {
    if (!this.queueList) return;
    attachFormatPickerListeners(this.queueList, (itemId, targetFormatId) => {
      const item = this.items.find((i) => i.id === itemId);
      if (!item) return;
      item.targetFormat = targetFormatId;
      item.presetId = '';
      this.resetCompletedItemForReconvert(item);
      this.recomputeRouting(item);
      this.renderQueue();
    });

    this.queueList.querySelectorAll<HTMLButtonElement>('button[data-action="toggle-settings"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (!item) return;
        item.expandedSettings = !item.expandedSettings;
        this.renderQueue();
      });
    });

    this.queueList.querySelectorAll<HTMLSelectElement>('select[data-action="preset"]').forEach((el) => {
      el.addEventListener('change', () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        const cat = getFormatById(item.sourceFormat)?.category ?? 'document';
        const preset = getPresetsForCategory(cat).find((p) => p.id === el.value);
        item.presetId = el.value;
        if (preset) {
          item.targetFormat = preset.targetFormat;
          item.options = {
            ...preset.options,
            forceExecutionMode: 'AUTO',
            autoDeleteServerFile: true,
          };
        }
        this.resetCompletedItemForReconvert(item);
        this.recomputeRouting(item);
        this.renderQueue();
      });
    });

    this.queueList.querySelectorAll<HTMLInputElement>('input[type="range"][data-opt="quality"]').forEach((el) => {
      el.addEventListener('input', () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        const q = Number(el.value);
        item.options.quality = q;
        const label = this.queueList?.querySelector<HTMLElement>(`[data-quality-label="${item.id}"]`);
        if (label) label.textContent = `${q}%`;
      });
    });

    this.queueList.querySelectorAll<HTMLElement>('[data-opt]').forEach((el) => {
      el.addEventListener('change', () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        const key = el.dataset.opt as keyof ConversionOptions;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          (item.options as Record<string, unknown>)[key] = el.checked;
        } else if (el instanceof HTMLInputElement && (el.type === 'number' || el.type === 'range')) {
          (item.options as Record<string, unknown>)[key] = el.value ? Number(el.value) : undefined;
        } else if (el instanceof HTMLSelectElement) {
          const val = el.value;
          (item.options as Record<string, unknown>)[key] =
            key === 'sampleRate' || key === 'channels' || key === 'indentSpaces'
              ? val !== ''
                ? Number(val)
                : undefined
              : val || undefined;
        } else if (el instanceof HTMLInputElement) {
          (item.options as Record<string, unknown>)[key] = el.value;
        }
        this.resetCompletedItemForReconvert(item);
        this.renderQueue();
      });
    });

    this.queueList.querySelectorAll<HTMLButtonElement>('button[data-action="convert"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item) void this.runItem(item);
      });
    });

    this.queueList.querySelectorAll<HTMLButtonElement>('button[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item?.abortController) {
          item.abortController.abort();
        }
      });
    });

    this.queueList.querySelectorAll<HTMLButtonElement>('button[data-action="preview"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item) void this.openPreview(item);
      });
    });

    this.queueList.querySelectorAll<HTMLButtonElement>('button[data-action="remove"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (item?.abortController) item.abortController.abort();
        if (item?.output?.objectUrl) URL.revokeObjectURL(item.output.objectUrl);
        if (item?.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
        this.items = this.items.filter((i) => i.id !== btn.dataset.id);
        this.renderQueue();
      });
    });
  }

  private async convertAllReady(): Promise<void> {
    const ready = this.items.filter((i) => i.status === 'pending' || i.status === 'failed');
    if (ready.length === 0) return;
    await Promise.all(ready.map((item) => this.runItem(item)));
    this.showToast(`Batch conversion finished (${ready.length} file${ready.length === 1 ? '' : 's'})`, 'success');
  }

  private async runItem(item: BatchQueueItem): Promise<void> {
    if (item.output?.objectUrl) {
      URL.revokeObjectURL(item.output.objectUrl);
      item.output = undefined;
    }
    item.options = {
      ...item.options,
      forceExecutionMode: 'AUTO',
      autoDeleteServerFile: true,
    };
    item.errorMessage = undefined;
    item.abortController = new AbortController();
    const signal = item.abortController.signal;
    const startedAt = performance.now();
    try {
      if (item.routing.isLocal) {
        item.status = 'queued-local';
        item.progressPercent = 5;
        item.stageMessage = 'Waiting in queue...';
        this.renderQueue();
        try {
          const result = await this.workerPool.enqueue({
            id: item.id,
            inputBytes: item.file.size,
            isHeavyWasm: item.routing.selectedTier === 'LOCAL_WASM',
            signal,
            onProgress: (pct, msg) => {
              item.status = 'processing-local';
              item.progressPercent = pct;
              item.stageMessage = sanitizeStageMessage('processing-local', msg);
              this.updateCardProgressOnly(item);
            },
            executor: async (ctx) => {
              item.status = 'processing-local';
              this.updateCardProgressOnly(item);
              return executeLocalConversion({
                file: item.file,
                filename: item.file.name,
                sourceFormat: item.sourceFormat,
                targetFormat: item.targetFormat,
                engineId: item.routing.selectedEngine,
                options: item.options,
                onProgress: ctx.reportProgress,
                signal: ctx.signal,
              });
            },
          });
          const objectUrl = URL.createObjectURL(result.blob);
          item.output = {
            blob: result.blob,
            bytes: result.bytes,
            filename: result.filename,
            mimeType: result.mimeType,
            objectUrl,
            metadata: result.metadata,
          };
          item.status = 'completed';
          item.progressPercent = 100;
          item.durationMs = Math.round(performance.now() - startedAt);
          item.stageMessage = `Converted in ${item.durationMs}ms`;
          this.completedCount += 1;
          this.bytesProcessed += item.file.size;
          this.updateTopCounters();
          this.renderQueue();
          return;
        } catch (localErr) {
          if (localErr instanceof DOMException && localErr.name === 'AbortError') {
            throw localErr;
          }
          const canEscalate =
            item.routing.fallbackTier === 'SERVER_FALLBACK' || localErr instanceof WasmLoaderError;
          if (!canEscalate) {
            throw localErr;
          }
          const errObj = localErr instanceof Error ? localErr : new Error(String(localErr));
          item.routing = this.router.escalateFailedLocalJobToServer(item.routing, errObj);
        }
      }
      item.status = 'uploading-server';
      item.progressPercent = 10;
      item.stageMessage = 'Preparing conversion...';
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
        },
      });
      const objectUrl = URL.createObjectURL(serverRes.blob);
      item.output = {
        blob: serverRes.blob,
        bytes: serverRes.bytes,
        filename: serverRes.filename,
        mimeType: serverRes.mimeType,
        objectUrl,
      };
      item.status = 'completed';
      item.progressPercent = 100;
      item.durationMs = Math.round(performance.now() - startedAt);
      item.stageMessage = `Converted in ${item.durationMs}ms`;
      this.completedCount += 1;
      this.bytesProcessed += item.file.size;
      this.updateTopCounters();
      this.renderQueue();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        item.status = 'cancelled';
        item.progressPercent = 0;
        item.stageMessage = 'Cancelled';
      } else {
        item.status = 'failed';
        item.errorMessage = err instanceof Error ? err.message : String(err);
        item.stageMessage = 'Conversion failed';
      }
      this.renderQueue();
    }
  }

  private updateCardProgressOnly(item: BatchQueueItem): void {
    const card = this.queueList?.querySelector<HTMLElement>(`[data-job-id="${item.id}"]`);
    if (!card) return;
    const fill = card.querySelector<HTMLElement>('.progress-line-fill');
    const pill = card.querySelector<HTMLElement>('[data-status-pill]');
    const barSpans = card.querySelectorAll<HTMLElement>('.job-progress-bar span');
    if (fill) fill.style.width = `${item.progressPercent}%`;
    if (pill && isBusyStatus(item.status)) {
      pill.textContent = `Converting... ${Math.round(item.progressPercent)}%`;
    }
    if (barSpans[0]) barSpans[0].textContent = item.stageMessage;
    if (barSpans[1]) barSpans[1].textContent = `${Math.round(item.progressPercent)}%`;
  }

  private async downloadAllAsZip(): Promise<void> {
    const completed = this.items.filter((i) => i.status === 'completed' && i.output);
    if (completed.length === 0) return;
    const entries = completed.map((i) => ({
      name: i.output!.filename,
      data: i.output!.bytes,
    }));
    const zipBytes = await createZipArchive(entries);
    const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omniconvert-batch-${Date.now()}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    this.showToast(`Downloaded batch ZIP (${completed.length} files)`, 'success');
  }

  private async renderAudioWaveformCanvas(canvas: HTMLCanvasElement, bytes: Uint8Array, audioEl: HTMLAudioElement): Promise<void> {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(300, rect.width || 640);
    const height = Math.max(64, rect.height || 76);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const barCount = 96;
    const peaks = new Float32Array(barCount);

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const actx = new AudioCtx();
      const copyBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const audioBuffer = await actx.decodeAudioData(copyBuf);
      const channelData = audioBuffer.getChannelData(0);
      const step = Math.max(1, Math.floor(channelData.length / barCount));
      for (let i = 0; i < barCount; i++) {
        let max = 0;
        const start = i * step;
        for (let j = 0; j < step && start + j < channelData.length; j++) {
          const v = Math.abs(channelData[start + j]);
          if (v > max) max = v;
        }
        peaks[i] = Math.max(0.08, Math.min(1, max));
      }
      void actx.close();
    } catch {
      // Deterministic fallback envelope from byte stream
      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bytes.length);
        const norm = (bytes[idx] ?? 128) / 255;
        peaks[i] = 0.15 + Math.abs(Math.sin(i * 0.25) * 0.55 + norm * 0.3);
      }
    }

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);
      const progress = audioEl.duration ? audioEl.currentTime / audioEl.duration : 0;
      const gap = 3;
      const barW = Math.max(2, (width - (barCount - 1) * gap) / barCount);

      for (let i = 0; i < barCount; i++) {
        const x = i * (barW + gap);
        const h = Math.max(6, peaks[i] * (height - 12));
        const y = (height - h) / 2;
        const isPlayed = i / barCount <= progress;
        ctx.fillStyle = isPlayed ? '#E04428' : 'rgba(130, 127, 119, 0.42)';
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 2);
        ctx.fill();
      }
    };

    drawFrame();
    audioEl.addEventListener('timeupdate', drawFrame);
    audioEl.addEventListener('play', drawFrame);
    audioEl.addEventListener('pause', drawFrame);
    audioEl.addEventListener('ended', drawFrame);

    canvas.addEventListener('click', (e) => {
      if (!Number.isFinite(audioEl.duration) || audioEl.duration <= 0) return;
      const b = canvas.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
      audioEl.currentTime = ratio * audioEl.duration;
      drawFrame();
    });
  }

  private async openPreview(item: BatchQueueItem): Promise<void> {
    if (!item.output || !this.previewBody || !this.previewBackdrop || !this.previewTitle) return;
    for (const url of this.tempPreviewUrls) {
      URL.revokeObjectURL(url);
    }
    this.tempPreviewUrls = [];
    const out = item.output;
    const mime = out.mimeType;
    const { pctStr, savingsLabel, isSmaller } = computeSizeDelta(item.file.size, out.bytes.length);
    const timingLabel = item.durationMs !== undefined ? ` · ${item.durationMs}ms` : '';
    this.previewTitle.textContent = `${out.filename} — Studio Output Inspector`;

    const buildSummaryBarHtml = (extraRightHtml = '') => `
      <div class="inspector-summary-bar">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:0.82rem;">
          <span class="fmt-pill">${escapeHtml(item.sourceFormat.toUpperCase())}</span>
          <span style="color:var(--text-muted);">→</span>
          <span class="fmt-pill">${escapeHtml(item.targetFormat.toUpperCase())}</span>
          <span style="color:var(--text-secondary);font-variant-numeric:tabular-nums;">${formatBytes(item.file.size)} → <strong>${formatBytes(out.bytes.length)}</strong></span>
          <span class="route-pill ${isSmaller ? 'local' : ''}" style="cursor:default;">${escapeHtml(savingsLabel)} (${escapeHtml(pctStr)})${escapeHtml(timingLabel)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;" id="preview-toolbar-actions">
          ${extraRightHtml}
          <a class="btn btn-sm btn-success" href="${out.objectUrl}" download="${escapeHtml(out.filename)}">Download ${escapeHtml(item.targetFormat.toUpperCase())}</a>
        </div>
      </div>
    `;

    // 1. IMAGE INSPECTOR (Interactive Split-Curtain Slider + Side-by-Side Toggle)
    if (mime.startsWith('image/')) {
      let origUrl = item.thumbnailUrl;
      if (!origUrl) {
        origUrl = URL.createObjectURL(item.file);
        this.tempPreviewUrls.push(origUrl);
      }

      const modeToggleHtml = `
        <div class="inspector-mode-tabs" id="img-inspector-tabs">
          <button type="button" class="inspector-mode-btn active" data-img-mode="split">Split Curtain</button>
          <button type="button" class="inspector-mode-btn" data-img-mode="side">Side-by-Side</button>
        </div>
      `;

      this.previewBody.innerHTML = `
        ${buildSummaryBarHtml(modeToggleHtml)}
        <div id="img-split-view" class="split-compare-container preview-checkerboard">
          <div class="split-stage-inner">
            <img class="split-img-after" src="${out.objectUrl}" alt="Converted ${escapeHtml(out.filename)}" />
            <div class="split-img-before-clip" id="split-before-clip" style="clip-path: inset(0 50% 0 0);">
              <img src="${origUrl}" alt="Original ${escapeHtml(item.file.name)}" />
            </div>
            <div class="split-divider-line" id="split-divider-line" style="left: 50%;">
              <div class="split-divider-handle">⇄</div>
            </div>
            <input type="range" min="0" max="100" value="50" class="split-range-input" id="split-range-slider" aria-label="Before and after split comparison slider" />
          </div>
          <div class="split-corner-tag left">ORIGINAL · ${escapeHtml(item.sourceFormat.toUpperCase())} · <span id="split-orig-dims">—</span> · ${formatBytes(item.file.size)}</div>
          <div class="split-corner-tag right">CONVERTED · ${escapeHtml(item.targetFormat.toUpperCase())} · <span id="split-out-dims">—</span> · ${formatBytes(out.bytes.length)}</div>
        </div>

        <div id="img-side-view" class="preview-comparison-grid hidden">
          <div class="preview-pane">
            <div class="preview-pane-header">
              <div class="preview-pane-title">
                <strong>Original</strong>
                <span class="fmt-pill">${escapeHtml(item.sourceFormat.toUpperCase())}</span>
              </div>
              <span class="preview-pane-meta"><span id="preview-orig-dims">—</span> · ${formatBytes(item.file.size)}</span>
            </div>
            <div class="preview-pane-stage preview-checkerboard">
              <img src="${origUrl}" alt="Original ${escapeHtml(item.file.name)}" />
            </div>
          </div>
          <div class="preview-pane">
            <div class="preview-pane-header">
              <div class="preview-pane-title">
                <strong style="color:var(--accent-local);">Converted</strong>
                <span class="fmt-pill">${escapeHtml(item.targetFormat.toUpperCase())}</span>
              </div>
              <span class="preview-pane-meta"><span id="preview-out-dims">—</span> · ${formatBytes(out.bytes.length)}</span>
            </div>
            <div class="preview-pane-stage preview-checkerboard">
              <img src="${out.objectUrl}" alt="Converted ${escapeHtml(out.filename)}" />
            </div>
          </div>
        </div>
      `;

      const slider = document.getElementById('split-range-slider') as HTMLInputElement | null;
      const beforeClip = document.getElementById('split-before-clip');
      const dividerLine = document.getElementById('split-divider-line');
      slider?.addEventListener('input', () => {
        const pct = Number(slider.value);
        if (beforeClip) beforeClip.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
        if (dividerLine) dividerLine.style.left = `${pct}%`;
      });

      document.getElementById('img-inspector-tabs')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-img-mode]');
        if (!btn) return;
        const mode = btn.dataset.imgMode;
        document.querySelectorAll('#img-inspector-tabs .inspector-mode-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.getElementById('img-split-view')?.classList.toggle('hidden', mode !== 'split');
        document.getElementById('img-side-view')?.classList.toggle('hidden', mode !== 'side');
      });

      this.previewBackdrop.classList.remove('hidden');
      void Promise.all([loadImageDimensions(origUrl), loadImageDimensions(out.objectUrl)]).then(
        ([origDims, outDims]) => {
          const oText = origDims ? `${origDims.width} × ${origDims.height}` : '—';
          const cText = outDims ? `${outDims.width} × ${outDims.height}` : '—';
          const el1 = document.getElementById(' preview-orig-dims') ?? document.getElementById('preview-orig-dims');
          const el2 = document.getElementById('preview-out-dims');
          const el3 = document.getElementById('split-orig-dims');
          const el4 = document.getElementById('split-out-dims');
          if (el1) el1.textContent = oText;
          if (el2) el2.textContent = cText;
          if (el3) el3.textContent = oText;
          if (el4) el4.textContent = cText;
        },
      );
      return;
    }

    // 2. AUDIO INSPECTOR (With Interactive Canvas PCM Waveform Visualizer)
    if (mime.startsWith('audio/')) {
      const sampleRateVal = out.metadata?.sampleRate
        ? `${(Number(out.metadata.sampleRate) / 1000).toFixed(1).replace(/\.0$/, '')} kHz`
        : item.options.sampleRate
          ? `${(item.options.sampleRate / 1000).toFixed(1).replace(/\.0$/, '')} kHz`
          : '44.1 kHz';
      const channelsVal =
        out.metadata?.channels === 1 || item.options.channels === 1
          ? 'Mono (1 ch)'
          : out.metadata?.channels === 2 || item.options.channels === 2
            ? 'Stereo (2 ch)'
            : 'Stereo';
      const durationVal = out.metadata?.durationSec !== undefined ? `${out.metadata.durationSec}s` : '—';

      this.previewBody.innerHTML = `
        ${buildSummaryBarHtml()}
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:18px;background:var(--surface);display:flex;flex-direction:column;gap:16px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
            <div class="kv-item">
              <span class="kv-label">Codec &amp; MIME</span>
              <strong class="kv-val">${escapeHtml(item.targetFormat.toUpperCase())} (${escapeHtml(mime)})</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Sample Rate</span>
              <strong class="kv-val">${escapeHtml(sampleRateVal)}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Channel Layout</span>
              <strong class="kv-val">${escapeHtml(channelsVal)}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Duration</span>
              <strong class="kv-val" id="preview-audio-duration">${escapeHtml(durationVal)}</strong>
            </div>
          </div>
          <div class="audio-waveform-box" title="Click anywhere on waveform to seek">
            <canvas id="preview-waveform-canvas" class="audio-waveform-canvas"></canvas>
          </div>
          <div style="padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-muted);">
            <audio id="preview-audio-player" controls src="${out.objectUrl}" style="width:100%;height:36px;"></audio>
          </div>
        </div>
      `;
      this.previewBackdrop.classList.remove('hidden');

      const audioEl = document.getElementById('preview-audio-player') as HTMLAudioElement | null;
      const canvasEl = document.getElementById('preview-waveform-canvas') as HTMLCanvasElement | null;
      audioEl?.addEventListener('loadedmetadata', () => {
        const durEl = document.getElementById('preview-audio-duration');
        if (durEl && Number.isFinite(audioEl.duration)) {
          durEl.textContent = `${audioEl.duration.toFixed(2)}s`;
        }
      });
      if (canvasEl && audioEl) {
        void this.renderAudioWaveformCanvas(canvasEl, out.bytes, audioEl);
      }
      return;
    }

    // 3. PDF INSPECTOR
    if (mime === 'application/pdf') {
      this.previewBody.innerHTML = `
        ${buildSummaryBarHtml()}
        <iframe src="${out.objectUrl}" title="PDF Preview" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff;"></iframe>
      `;
      this.previewBackdrop.classList.remove('hidden');
      return;
    }

    // 4. CODE & STRUCTURED DATA INSPECTOR (Syntax Highlighting + Tabular Grid View)
    const isTextLike =
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('yaml') ||
      mime.includes('sql') ||
      mime.includes('toml') ||
      mime.includes('csv') ||
      TEXT_TARGET_IDS.has(item.targetFormat);

    if (isTextLike) {
      const fullText = await out.blob.text();
      const lineCount = fullText === '' ? 0 : fullText.split(/\r\n|\r|\n/).length;
      const maxPreviewChars = 40000;
      const isTruncated = fullText.length > maxPreviewChars;
      const displayText = isTruncated ? fullText.slice(0, maxPreviewChars) : fullText;
      const rowStat = out.metadata?.rows !== undefined ? ` · ${Number(out.metadata.rows).toLocaleString()} rows` : '';
      const tabular = tryParseTabularPreview(displayText, item.targetFormat);

      const modeToggleHtml = tabular
        ? `
          <div class="inspector-mode-tabs" id="code-inspector-tabs">
            <button type="button" class="inspector-mode-btn active" data-code-mode="code">Syntax Code</button>
            <button type="button" class="inspector-mode-btn" data-code-mode="table">Table Grid (${tabular.rows.length})</button>
          </div>
        `
        : '';

      const tableHtml = tabular
        ? `
          <div id="inspector-table-view" class="data-grid-wrap hidden">
            <table class="data-grid-table">
              <thead>
                <tr>
                  <th class="row-idx">#</th>
                  ${tabular.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${tabular.rows
                  .map(
                    (r, rIdx) => `
                    <tr>
                      <td class="row-idx">${rIdx + 1}</td>
                      ${r.map((cell) => `<td title="${escapeHtml(cell)}">${escapeHtml(cell)}</td>`).join('')}
                    </tr>
                  `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        : '';

      this.previewBody.innerHTML = `
        ${buildSummaryBarHtml(modeToggleHtml)}
        <div id="inspector-code-view" class="code-preview-container">
          <div class="code-preview-toolbar">
            <span style="font-size:0.77rem;color:var(--text-secondary);font-family:var(--font-mono);">
              ${escapeHtml(item.targetFormat.toUpperCase())} · ${lineCount.toLocaleString()} lines · ${fullText.length.toLocaleString()} chars · ${formatBytes(out.bytes.length)}${escapeHtml(rowStat)}
            </span>
            <button type="button" class="btn btn-xs btn-secondary" id="copy-preview-btn">Copy to Clipboard</button>
          </div>
          <pre class="code-preview-pre"><code>${renderSyntaxHighlightedBlock(displayText, item.targetFormat)}</code></pre>
          ${
            isTruncated
              ? `<div style="padding:8px 14px;border-top:1px solid var(--border);font-size:0.75rem;color:var(--text-muted);background:var(--surface-hover);">Showing first ${maxPreviewChars.toLocaleString()} characters. Copy or Download for the complete file.</div>`
              : ''
          }
        </div>
        ${tableHtml}
      `;

      document.getElementById('code-inspector-tabs')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-code-mode]');
        if (!btn) return;
        const mode = btn.dataset.codeMode;
        document.querySelectorAll('#code-inspector-tabs .inspector-mode-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.getElementById('inspector-code-view')?.classList.toggle('hidden', mode !== 'code');
        document.getElementById('inspector-table-view')?.classList.toggle('hidden', mode !== 'table');
      });

      const copyBtn = document.getElementById('copy-preview-btn') as HTMLButtonElement | null;
      copyBtn?.addEventListener('click', async () => {
        const copied = await copyTextToClipboard(fullText);
        if (!copyBtn) return;
        copyBtn.textContent = copied ? 'Copied!' : 'Copy failed';
        if (copied) this.showToast('Copied output to clipboard', 'success');
        setTimeout(() => {
          copyBtn.textContent = 'Copy to Clipboard';
        }, 2000);
      });

      this.previewBackdrop.classList.remove('hidden');
      return;
    }

    this.previewBody.innerHTML = `
      ${buildSummaryBarHtml()}
      <div style="padding:28px;text-align:center;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface-muted);">
        <p style="font-weight:600;margin-bottom:6px;">${escapeHtml(out.filename)}</p>
        <p class="muted">${escapeHtml(mime)} · ${formatBytes(out.bytes.length)}. Click Download above to save your converted file.</p>
      </div>
    `;
    this.previewBackdrop.classList.remove('hidden');
  }
}

if (typeof document !== 'undefined') {
  const app = new OmniConvertApp();
  void app.init();
}
