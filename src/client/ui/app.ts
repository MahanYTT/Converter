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
    label: 'Ready',
    pillClass: '',
    inlineStyle:
      'cursor:default;background:var(--surface-muted);color:var(--text-secondary);border:1px solid var(--border);',
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
class OmniConvertApp {
  router = new ConversionRouter();
  serverClient = new ServerFallbackClient();
  device!: DeviceCapabilityProfile;
  workerPool!: WorkerPool;
  items: BatchQueueItem[] = [];
  completedCount = 0;
  bytesProcessed = 0;
  private tempPreviewUrls: string[] = [];
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
  async init(): Promise<void> {
    this.initTheme();
    this.device = await DeviceProfiler.detect();
    this.workerPool = new WorkerPool(this.device.hardwareConcurrency);
    this.renderLandingCategoryTabs('image');
    this.populateBatchTargetDropdown();
    this.updateTopCounters();
    this.bindEvents();
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
  }
  private openPasteModal(): void {
    this.pasteModalBackdrop?.classList.remove('hidden');
    const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
    textarea?.focus();
  }
  private closePasteModal(): void {
    this.pasteModalBackdrop?.classList.add('hidden');
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
    document.getElementById('browse-files-btn')?.addEventListener('click', () => {
      this.fileInput?.click();
    });
    this.fileInput?.addEventListener('change', () => {
      if (this.fileInput?.files && this.fileInput.files.length > 0) {
        void this.ingestFiles(Array.from(this.fileInput.files));
        this.fileInput.value = '';
      }
    });
    document.getElementById('load-demo-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('load-demo-btn') as HTMLButtonElement | null;
      if (!btn) return;
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = 'Generating sample batch...';
      try {
        const files = await createDemoSampleFiles();
        await this.ingestFiles(files);
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
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
    document.getElementById('paste-source-format')?.addEventListener('change', (e) => {
      const ext = (e.target as HTMLSelectElement).value;
      const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
      if (nameInput && /^(snippet|untitled)(\.[a-z0-9]+)?$/i.test(nameInput.value.trim())) {
        const match = nameInput.value.trim().match(/^(snippet|untitled)/i);
        const base = match ? match[1] : 'snippet';
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
    document.getElementById('add-paste-btn')?.addEventListener('click', () => {
      const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
      const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
      const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
      const text = textarea?.value.trim() ?? '';
      if (!text) return;
      const ext = fmtSelect?.value ?? 'txt';
      const name = nameInput?.value.trim() || `snippet.${ext}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], name, { type: 'text/plain' });
      void this.ingestFiles([file]);
      if (textarea) textarea.value = '';
      this.closePasteModal();
    });
    // Formats Modal
    document.getElementById('open-formats-btn')?.addEventListener('click', () => {
      this.renderFormatsExplorer();
      this.formatsModalBackdrop?.classList.remove('hidden');
    });
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
    // Drag and drop
    if (this.dropzone) {
      ['dragenter', 'dragover'].forEach((evtName) => {
        this.dropzone?.addEventListener(evtName, (e) => {
          e.preventDefault();
          this.dropzone?.classList.add('drag-active');
        });
      });
      ['dragleave', 'drop'].forEach((evtName) => {
        this.dropzone?.addEventListener(evtName, (e) => {
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
    }
    // Batch Bar Actions
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
    this.downloadZipBtn?.addEventListener('click', () => {
      void this.downloadAllAsZip();
    });
    this.batchTargetSelect?.addEventListener('change', () => {
      const target = this.batchTargetSelect?.value;
      if (!target) return;
      for (const item of this.items) {
        if (isBusyStatus(item.status)) continue;
        const compatible = getCompatibleTargets(item.sourceFormat);
        if (compatible.some((f) => f.id === target)) {
          item.targetFormat = target;
          item.presetId = '';
          this.resetCompletedItemForReconvert(item);
          this.recomputeRouting(item);
        }
      }
      if (this.batchTargetSelect) this.batchTargetSelect.value = '';
      this.renderQueue();
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
    // Preview modal
    document.getElementById('close-preview-btn')?.addEventListener('click', () => {
      this.closePreviewModal();
    });
    this.previewBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.previewBackdrop) {
        this.closePreviewModal();
      }
    });
    // Escape closes active modal
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.previewBackdrop && !this.previewBackdrop.classList.contains('hidden')) {
        this.closePreviewModal();
      } else if (this.pasteModalBackdrop && !this.pasteModalBackdrop.classList.contains('hidden')) {
        this.closePasteModal();
      } else if (this.formatsModalBackdrop && !this.formatsModalBackdrop.classList.contains('hidden')) {
        this.formatsModalBackdrop.classList.add('hidden');
      }
    });

    // Interactive Quick-Format Pills in Dropzone
    document.querySelectorAll('.quick-format-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = pill.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (text.includes('CSV') && text.includes('JSON')) {
          const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
          if (fmtSelect) {
            fmtSelect.value = 'csv';
            fmtSelect.dispatchEvent(new Event('change'));
          }
          const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
          if (textarea && !textarea.value.trim()) {
            textarea.value = 'id,name,role\n1,Alice,Engineer\n2,Bob,Designer';
          }
          this.openPasteModal();
        } else if (text.includes('MD') && text.includes('PDF')) {
          const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
          if (fmtSelect) {
            fmtSelect.value = 'md';
            fmtSelect.dispatchEvent(new Event('change'));
          }
          const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
          if (textarea && !textarea.value.trim()) {
            textarea.value = '# Sample Markdown\n\nThis is a **test** document.\n\n- Item 1\n- Item 2';
          }
          this.openPasteModal();
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
        const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
        if (fmtSelect) {
          fmtSelect.value = fmtId;
          fmtSelect.dispatchEvent(new Event('change'));
        }
        this.openPasteModal();
      } else {
        this.fileInput?.click();
      }
    });
  }
  private renderLandingCategoryTabs(category: FormatCategory): void {
    const container = document.getElementById('landing-format-chips');
    if (!container) return;
    const formats = CLIENT_FORMATS.filter((f) => f.category === category);
    container.innerHTML = formats
      .map(
        (f) => `
          <button type="button" class="format-chip" data-pick-format="${escapeHtml(f.id)}" data-cat="${escapeHtml(f.category)}">
            <strong>${escapeHtml(f.label)}</strong>
            <span>${escapeHtml(f.name)}</span>
          </button>
        `,
      )
      .join('');
  }
  private populateBatchTargetDropdown(): void {
    if (!this.batchTargetSelect) return;
    const popular = ['png', 'jpg', 'webp', 'mp3', 'wav', 'json', 'csv', 'yaml', 'pdf', 'zip'];
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
      return f.id.includes(query) || f.name.toLowerCase().includes(query) || f.category.includes(query);
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
      .map(
        (f) => `
          <div class="format-row-item">
            <div>
              <strong>${escapeHtml(f.label)}</strong> <span class="muted">(${escapeHtml(f.mimeType)})</span>
              <div class="muted">${escapeHtml(f.name)} — ${escapeHtml(f.description)}</div>
            </div>
            <span class="fmt-pill" data-cat="${escapeHtml(f.category)}">${escapeHtml(categoryLabels[f.category] ?? f.category)}</span>
          </div>
        `,
      )
      .join('');
  }
  private updateTopCounters(): void {
    const el = document.getElementById('stats-counter-text');
    if (!el) return;
    if (this.completedCount === 0) {
      el.textContent = 'Ready';
      return;
    }
    el.textContent = `${this.completedCount} converted · ${formatBytes(this.bytesProcessed)} processed`;
  }
  private async ingestFiles(files: File[]): Promise<void> {
    for (const file of files) {
      const headerBuf = await file.slice(0, 512).arrayBuffer();
      const headerBytes = new Uint8Array(headerBuf);
      const magic = inspectFileMagicBytes(headerBytes, file.name);
      const sourceFormat = magic.detectedFormatId ?? 'txt';
      const targetFormat = getDefaultTargetForSource(sourceFormat);
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
      this.items.push({
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
      });
    }
    this.renderQueue();
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
    if (this.queueCountLabel) {
      this.queueCountLabel.textContent = `${this.items.length} file${this.items.length === 1 ? '' : 's'}`;
    }
    if (this.queueRouteBreakdown) {
      if (completedCount === this.items.length) {
        this.queueRouteBreakdown.textContent = `All ${completedCount} converted`;
      } else if (busyCount > 0) {
        this.queueRouteBreakdown.textContent = `Converting ${busyCount} · ${completedCount} done`;
      } else if (completedCount > 0) {
        this.queueRouteBreakdown.textContent = `${completedCount} of ${this.items.length} converted`;
      } else {
        this.queueRouteBreakdown.textContent = 'Ready to convert';
      }
    }
    this.downloadZipBtn?.classList.toggle('hidden', completedCount < 2);
    this.queueList.innerHTML = this.items.map((item) => this.renderJobCard(item)).join('');
    this.attachCardListeners();
  }
  private renderTargetSelectOptions(sourceFormat: string, selectedTarget: string): string {
    const compatible = getCompatibleTargets(sourceFormat);
    const byCategory = new Map<FormatCategory, FormatDefinition[]>();
    for (const fmt of compatible) {
      const list = byCategory.get(fmt.category) ?? [];
      list.push(fmt);
      byCategory.set(fmt.category, list);
    }
    const categoryLabels: Record<FormatCategory, string> = {
      image: 'Image',
      audio: 'Audio',
      video: 'Video',
      data: 'Structured Data',
      document: 'Document & Markup',
      ebook: 'E-Book',
      archive: 'Archive',
      font: 'Font',
      vector: 'Vector',
      cad: 'CAD',
    };
    return Array.from(byCategory.entries())
      .map(([cat, fmts]) => {
        const opts = fmts
          .map(
            (f) =>
              `<option value="${escapeHtml(f.id)}" ${f.id === selectedTarget ? 'selected' : ''}>${escapeHtml(f.label)} — ${escapeHtml(f.name)}</option>`,
          )
          .join('');
        return `<optgroup label="${escapeHtml(categoryLabels[cat] ?? cat)}">${opts}</optgroup>`;
      })
      .join('');
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
    return `
      <article class="job-card status-${item.status}" data-job-id="${item.id}">
        <div class="progress-line-track">
          <div class="progress-line-fill" style="width: ${item.progressPercent}%"></div>
        </div>
        <div class="job-main-row">
          <div class="job-file-col">
            <div class="file-thumb" data-cat="${escapeHtml(category)}" aria-hidden="true">${fileIconSvg}</div>
            <div class="file-meta-col">
              <span class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span>
              <div class="file-subline">
                <span>${formatBytes(item.file.size)}</span>
                <span class="fmt-pill ${item.magic.isSpoofedOrMismatched ? 'spoof' : ''}" data-cat="${escapeHtml(category)}">${escapeHtml(item.sourceFormat)}</span>
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
            <button type="button" class="settings-toggle-btn ${item.expandedSettings ? 'active' : ''}" data-action="toggle-settings" data-id="${item.id}" title="Conversion settings">
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
                    <button type="button" class="btn btn-xs btn-ghost" data-action="preview" data-id="${item.id}">Preview</button>
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
    this.queueList.querySelectorAll<HTMLSelectElement>('select[data-action="target"]').forEach((el) => {
      el.addEventListener('change', () => {
        const item = this.items.find((i) => i.id === el.dataset.id);
        if (!item) return;
        item.targetFormat = el.value;
        item.presetId = '';
        this.resetCompletedItemForReconvert(item);
        this.recomputeRouting(item);
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
    await Promise.all(ready.map((item) => this.runItem(item)));
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
    this.previewTitle.textContent = `${out.filename} — Studio Inspector`;
    const summaryBarHtml = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--surface-muted);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:0.82rem;">
          <span class="fmt-pill">${escapeHtml(item.sourceFormat.toUpperCase())}</span>
          <span style="color:var(--text-muted);">→</span>
          <span class="fmt-pill">${escapeHtml(item.targetFormat.toUpperCase())}</span>
          <span style="color:var(--text-secondary);font-variant-numeric:tabular-nums;">${formatBytes(item.file.size)} → <strong>${formatBytes(out.bytes.length)}</strong></span>
          <span class="route-pill ${isSmaller ? 'local' : ''}" style="cursor:default;${isSmaller ? '' : 'background:var(--surface);color:var(--text-secondary);border:1px solid var(--border);'}">${escapeHtml(savingsLabel)} (${escapeHtml(pctStr)})${escapeHtml(timingLabel)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;" id="preview-toolbar-actions">
          <a class="btn btn-sm btn-success" href="${out.objectUrl}" download="${escapeHtml(out.filename)}">Download ${escapeHtml(item.targetFormat.toUpperCase())}</a>
        </div>
      </div>
    `;
    if (mime.startsWith('image/')) {
      let origUrl = item.thumbnailUrl;
      if (!origUrl) {
        origUrl = URL.createObjectURL(item.file);
        this.tempPreviewUrls.push(origUrl);
      }
      const checkerBg =
        'background-color:var(--surface-muted);background-image:linear-gradient(45deg,rgba(128,128,128,0.08) 25%,transparent 25%),linear-gradient(-45deg,rgba(128,128,128,0.08) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(128,128,128,0.08) 75%),linear-gradient(-45deg,transparent 75%,rgba(128,128,128,0.08) 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;';
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--surface-hover);font-size:0.78rem;">
              <div style="display:flex;align-items:center;gap:6px;">
                <strong>Original</strong>
                <span class="fmt-pill">${escapeHtml(item.sourceFormat.toUpperCase())}</span>
              </div>
              <span style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.74rem;">
                <span id="preview-orig-dims">—</span> · ${formatBytes(item.file.size)}
              </span>
            </div>
            <div style="padding:14px;display:flex;align-items:center;justify-content:center;min-height:220px;${checkerBg}">
              <img src="${origUrl}" alt="Original ${escapeHtml(item.file.name)}" style="max-width:100%;max-height:46vh;object-fit:contain;border:none;border-radius:4px;" />
            </div>
          </div>
          <div style="border:1px solid var(--accent-local-border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--accent-local-bg);font-size:0.78rem;">
              <div style="display:flex;align-items:center;gap:6px;">
                <strong style="color:var(--accent-local);">Converted</strong>
                <span class="fmt-pill">${escapeHtml(item.targetFormat.toUpperCase())}</span>
              </div>
              <span style="color:var(--text-secondary);font-family:var(--font-mono);font-size:0.74rem;">
                <span id="preview-out-dims">${out.metadata?.width && out.metadata?.height ? `${out.metadata.width} × ${out.metadata.height}` : '—'}</span> · ${formatBytes(out.bytes.length)}
              </span>
            </div>
            <div style="padding:14px;display:flex;align-items:center;justify-content:center;min-height:220px;${checkerBg}">
              <img src="${out.objectUrl}" alt="Converted ${escapeHtml(out.filename)}" style="max-width:100%;max-height:46vh;object-fit:contain;border:none;border-radius:4px;" />
            </div>
          </div>
        </div>
      `;
      this.previewBackdrop.classList.remove('hidden');
      void Promise.all([loadImageDimensions(origUrl), loadImageDimensions(out.objectUrl)]).then(
        ([origDims, outDims]) => {
          const origEl = document.getElementById('preview-orig-dims');
          const outEl = document.getElementById('preview-out-dims');
          if (origEl && origDims) origEl.textContent = `${origDims.width} × ${origDims.height}`;
          if (outEl && outDims) outEl.textContent = `${outDims.width} × ${outDims.height}`;
        },
      );
      return;
    }
    if (mime.startsWith('audio/')) {
      const sampleRateVal = out.metadata?.sampleRate
        ? `${(Number(out.metadata.sampleRate) / 1000).toFixed(1).replace(/\.0$/, '')} kHz`
        : item.options.sampleRate
          ? `${(item.options.sampleRate / 1000).toFixed(1).replace(/\.0$/, '')} kHz`
          : 'Original';
      const channelsVal =
        out.metadata?.channels === 1 || item.options.channels === 1
          ? 'Mono (1 ch)'
          : out.metadata?.channels === 2 || item.options.channels === 2
            ? 'Stereo (2 ch)'
            : 'Auto';
      const durationVal = out.metadata?.durationSec !== undefined ? `${out.metadata.durationSec}s` : '—';
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:18px;background:var(--surface);display:flex;flex-direction:column;gap:16px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
            <div class="kv-item">
              <span class="kv-label">Format</span>
              <strong class="kv-val">${escapeHtml(item.targetFormat.toUpperCase())} (${escapeHtml(mime)})</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Sample Rate</span>
              <strong class="kv-val">${escapeHtml(sampleRateVal)}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Channels</span>
              <strong class="kv-val">${escapeHtml(channelsVal)}</strong>
            </div>
            <div class="kv-item">
              <span class="kv-label">Duration</span>
              <strong class="kv-val" id="preview-audio-duration">${escapeHtml(durationVal)}</strong>
            </div>
          </div>
          <div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-muted);">
            <div style="font-size:0.76rem;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">
              Converted Output — ${escapeHtml(out.filename)}
            </div>
            <audio id="preview-audio-player" controls src="${out.objectUrl}" style="width:100%"></audio>
          </div>
        </div>
      `;
      const audioEl = document.getElementById('preview-audio-player') as HTMLAudioElement | null;
      audioEl?.addEventListener('loadedmetadata', () => {
        const durEl = document.getElementById('preview-audio-duration');
        if (durEl && Number.isFinite(audioEl.duration)) {
          durEl.textContent = `${audioEl.duration.toFixed(2)}s`;
        }
      });
      this.previewBackdrop.classList.remove('hidden');
      return;
    }
    if (mime === 'application/pdf') {
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <iframe src="${out.objectUrl}" title="PDF Preview" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:var(--radius-md);background:#fff;"></iframe>
      `;
      this.previewBackdrop.classList.remove('hidden');
      return;
    }
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
      const maxPreviewChars = 50000;
      const isTruncated = fullText.length > maxPreviewChars;
      const displayText = isTruncated ? fullText.slice(0, maxPreviewChars) : fullText;
      const rowStat = out.metadata?.rows !== undefined ? ` · ${Number(out.metadata.rows).toLocaleString()} rows` : '';
      this.previewBody.innerHTML = `
        ${summaryBarHtml}
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface);">
          <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface-hover);">
            <span style="font-size:0.78rem;color:var(--text-secondary);font-family:var(--font-mono);">
              ${lineCount.toLocaleString()} lines · ${fullText.length.toLocaleString()} chars · ${formatBytes(out.bytes.length)}${escapeHtml(rowStat)}
            </span>
            <button type="button" class="btn btn-xs btn-secondary" id="copy-preview-btn">Copy to clipboard</button>
          </div>
          <pre style="margin:0;border:none;border-radius:0;max-height:54vh;overflow:auto;"><code>${escapeHtml(displayText)}</code></pre>
          ${
            isTruncated
              ? `<div style="padding:8px 14px;border-top:1px solid var(--border);font-size:0.75rem;color:var(--text-muted);background:var(--surface-hover);">Showing first ${maxPreviewChars.toLocaleString()} characters. Copy or Download for the complete file.</div>`
              : ''
          }
        </div>
      `;
      const copyBtn = document.getElementById('copy-preview-btn') as HTMLButtonElement | null;
      copyBtn?.addEventListener('click', async () => {
        const copied = await copyTextToClipboard(fullText);
        if (!copyBtn) return;
        copyBtn.textContent = copied ? 'Copied!' : 'Copy failed';
        setTimeout(() => {
          copyBtn.textContent = 'Copy to clipboard';
        }, 2000);
      });
      this.previewBackdrop.classList.remove('hidden');
      return;
    }
    this.previewBody.innerHTML = `
      ${summaryBarHtml}
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
