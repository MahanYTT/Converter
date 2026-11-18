import type {
  ConversionOptions,
  DeviceCapabilityProfile,
  FormatCategory,
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
  options: ConversionOptions;
  routing: RoutingDecision;
  status: JobStatus;
  progressPercent: number;
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
  toastStack = document.getElementById('toast-stack');

  async init(): Promise<void> {
    this.initTheme();
    this.device = await DeviceProfiler.detect();
    this.workerPool = new WorkerPool(this.device.hardwareConcurrency);
    this.populateBatchTargetDropdown();
    this.bindEvents();
  }

  private showToast(message: string): void {
    if (!this.toastStack) return;
    const toast = document.createElement('div');
    toast.className = 'toast-card';
    toast.textContent = message;
    this.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
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

    document.getElementById('browse-files-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fileInput?.click();
    });

    this.fileInput?.addEventListener('change', () => {
      if (this.fileInput?.files && this.fileInput.files.length > 0) {
        void this.ingestFiles(Array.from(this.fileInput.files));
        this.fileInput.value = '';
      }
    });

    document.getElementById('load-demo-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = document.getElementById('load-demo-btn') as HTMLButtonElement | null;
      if (!btn) return;
      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = 'Loading...';
      try {
        const files = await createDemoSampleFiles();
        await this.ingestFiles(files);
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });

    // Paste Modal
    document.getElementById('paste-text-btn-hero')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPasteModal();
    });
    document.getElementById('close-paste-modal-btn')?.addEventListener('click', () => this.closePasteModal());
    document.getElementById('cancel-paste-btn')?.addEventListener('click', () => this.closePasteModal());
    this.pasteModalBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.pasteModalBackdrop) this.closePasteModal();
    });

    document.getElementById('paste-source-format')?.addEventListener('change', (e) => {
      const ext = (e.target as HTMLSelectElement).value;
      const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
      if (nameInput) {
        const base = nameInput.value.trim().replace(/\.[a-z0-9]+$/i, '') || 'note';
        nameInput.value = `${base}.${ext}`;
      }
    });

    document.getElementById('add-paste-btn')?.addEventListener('click', () => {
      const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement | null;
      const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement | null;
      const nameInput = document.getElementById('paste-filename') as HTMLInputElement | null;
      const text = textarea?.value.trim() ?? '';
      if (!text) return;
      const ext = fmtSelect?.value ?? 'txt';
      const name = nameInput?.value.trim() || `note.${ext}`;
      const file = new File([new Blob([text], { type: 'text/plain' })], name, { type: 'text/plain' });
      void this.ingestFiles([file]);
      if (textarea) textarea.value = '';
      this.closePasteModal();
    });

    // Global Ctrl+V Paste support
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
        this.showToast(`Added ${files.length} file(s) from clipboard`);
      }
    });

    // Supported Formats Modal
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

    // Dropzone drag & click
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

    // Batch actions
    document.getElementById('convert-all-btn')?.addEventListener('click', () => {
      void this.convertAllReady();
    });

    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
      for (const item of this.items) {
        if (item.abortController) item.abortController.abort();
        if (item.output?.objectUrl) URL.revokeObjectURL(item.output.objectUrl);
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      }
      this.items = [];
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
          this.resetCompletedItemForReconvert(item);
          this.recomputeRouting(item);
        }
      }
      if (this.batchTargetSelect) this.batchTargetSelect.value = '';
      this.renderQueue();
    });

    // Preview Modal close
    document.getElementById('close-preview-btn')?.addEventListener('click', () => {
      this.closePreviewModal();
    });
    this.previewBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.previewBackdrop) {
        this.closePreviewModal();
      }
    });

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
  }

  private populateBatchTargetDropdown(): void {
    if (!this.batchTargetSelect) return;
    const popular = ['pdf', 'png', 'jpg', 'webp', 'mp3', 'wav', 'json', 'csv', 'zip'];
    this.batchTargetSelect.innerHTML =
      `<option value="">Convert all to...</option>` +
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
              <strong>${escapeHtml(f.label)}</strong>
              <span class="muted"> &mdash; ${escapeHtml(f.name)}</span>
            </div>
            <span class="fmt-pill">${escapeHtml(categoryLabels[f.category] ?? f.category)}</span>
          </div>
        `,
      )
      .join('');
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
        options,
        routing,
        status: 'pending',
        progressPercent: 0,
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
    return this.router.route(
      { name: file.name, sizeBytes: file.size, headerBytes },
      sourceFormat,
      targetFormat,
      { ...options, forceExecutionMode: 'AUTO', autoDeleteServerFile: true },
      this.device,
    );
  }

  private resetCompletedItemForReconvert(item: BatchQueueItem): void {
    if (item.status === 'completed' || item.status === 'cancelled' || item.status === 'failed') {
      if (item.output?.objectUrl) {
        URL.revokeObjectURL(item.output.objectUrl);
      }
      item.output = undefined;
      item.errorMessage = undefined;
      item.status = 'pending';
      item.progressPercent = 0;
    }
  }

  private recomputeRouting(item: BatchQueueItem): void {
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
        this.queueRouteBreakdown.textContent = 'All done';
      } else if (busyCount > 0) {
        this.queueRouteBreakdown.textContent = `Converting...`;
      } else if (completedCount > 0) {
        this.queueRouteBreakdown.textContent = `${completedCount} of ${this.items.length} done`;
      } else {
        this.queueRouteBreakdown.textContent = '';
      }
    }

    this.downloadZipBtn?.classList.toggle('hidden', completedCount < 2);
    this.queueList.innerHTML = this.items.map((item) => this.renderJobCard(item)).join('');
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
          <span>Max width</span>
          <input type="number" placeholder="Auto" min="16" max="8192" value="${item.options.width ?? ''}" data-opt="width" data-id="${item.id}" />
        </label>
        <label class="opt-field">
          <span>Max height</span>
          <input type="number" placeholder="Auto" min="16" max="8192" value="${item.options.height ?? ''}" data-opt="height" data-id="${item.id}" />
        </label>
      `);
    } else if (srcCat === 'audio' || ['wav', 'mp3', 'ogg', 'flac', 'aac'].includes(tgt)) {
      parts.push(`
        <label class="opt-field">
          <span>Sample rate</span>
          <select data-opt="sampleRate" data-id="${item.id}">
            <option value="" ${!item.options.sampleRate ? 'selected' : ''}>Original</option>
            <option value="44100" ${item.options.sampleRate === 44100 ? 'selected' : ''}>44.1 kHz</option>
            <option value="48000" ${item.options.sampleRate === 48000 ? 'selected' : ''}>48 kHz</option>
          </select>
        </label>
        <label class="opt-field">
          <span>Channels</span>
          <select data-opt="channels" data-id="${item.id}">
            <option value="" ${!item.options.channels ? 'selected' : ''}>Original</option>
            <option value="2" ${item.options.channels === 2 ? 'selected' : ''}>Stereo</option>
            <option value="1" ${item.options.channels === 1 ? 'selected' : ''}>Mono</option>
          </select>
        </label>
      `);
    }
    return parts.length > 0
      ? `<div class="settings-row">${parts.join('')}</div>`
      : `<div class="muted">Standard conversion settings applied automatically.</div>`;
  }

  private renderJobCard(item: BatchQueueItem): string {
    const compatibleFormats = getCompatibleTargets(item.sourceFormat);
    const isBusy = isBusyStatus(item.status);
    const isDone = item.status === 'completed' && item.output;

    const fileIconSvg = item.thumbnailUrl
      ? `<img src="${item.thumbnailUrl}" alt="" />`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;

    let statusHtml = '';
    if (isBusy) {
      statusHtml = `<span class="status-text" data-status-pill>Converting ${Math.round(item.progressPercent)}%</span>`;
    } else if (isDone && item.output) {
      statusHtml = `<span class="status-text done" data-status-pill>Done (${formatBytes(item.output.bytes.length)})</span>`;
    } else if (item.status === 'failed') {
      statusHtml = `<span class="status-text error" data-status-pill>Failed</span>`;
    }

    return `
      <article class="job-card status-${item.status}" data-job-id="${item.id}">
        <div class="progress-line-track">
          <div class="progress-line-fill" style="width: ${item.progressPercent}%"></div>
        </div>
        <div class="job-main-row">
          <div class="job-file-col">
            <div class="file-thumb" aria-hidden="true">${fileIconSvg}</div>
            <div class="file-meta-col">
              <span class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span>
              <div class="file-subline">
                <span>${formatBytes(item.file.size)}</span>
                <span class="fmt-pill">${escapeHtml(item.sourceFormat)}</span>
              </div>
            </div>
          </div>

          <div class="job-convert-col">
            <span class="to-label">to</span>
            ${createFormatPickerTriggerHtml(item.id, item.targetFormat, compatibleFormats)}
            <button type="button" class="settings-toggle-btn ${item.expandedSettings ? 'active' : ''}" data-action="toggle-settings" data-id="${item.id}" title="Options">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>

          <div class="job-actions-col">
            ${statusHtml}
            ${
              isBusy
                ? `<button type="button" class="btn btn-xs btn-danger" data-action="cancel" data-id="${item.id}">Cancel</button>`
                : isDone && item.output
                  ? `
                    <button type="button" class="btn btn-xs btn-ghost" data-action="preview" data-id="${item.id}">Preview</button>
                    <a class="btn btn-xs btn-success" href="${item.output.objectUrl}" download="${escapeHtml(item.output.filename)}">Download</a>
                  `
                  : `<button type="button" class="btn btn-xs btn-primary" data-action="convert" data-id="${item.id}">Convert</button>`
            }
            <button type="button" class="icon-btn" data-action="remove" data-id="${item.id}" title="Remove" style="width:28px;height:28px;border:none;background:transparent;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        ${
          item.expandedSettings
            ? `<div class="job-settings-drawer">${this.renderContextualOptions(item)}</div>`
            : ''
        }
        ${item.errorMessage ? `<div class="inline-alert">${escapeHtml(item.errorMessage)}</div>` : ''}
      </article>
    `;
  }

  private attachCardListeners(): void {
    if (!this.queueList) return;
    attachFormatPickerListeners(this.queueList, (itemId, targetFormatId) => {
      const item = this.items.find((i) => i.id === itemId);
      if (!item) return;
      item.targetFormat = targetFormatId;
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
        if (el instanceof HTMLInputElement && (el.type === 'number' || el.type === 'range')) {
          (item.options as Record<string, unknown>)[key] = el.value ? Number(el.value) : undefined;
        } else if (el instanceof HTMLSelectElement) {
          const val = el.value;
          (item.options as Record<string, unknown>)[key] = val !== '' ? Number(val) : undefined;
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
        if (item?.abortController) item.abortController.abort();
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
    item.errorMessage = undefined;
    item.abortController = new AbortController();
    const signal = item.abortController.signal;

    try {
      if (item.routing.isLocal) {
        item.status = 'queued-local';
        item.progressPercent = 10;
        this.renderQueue();
        try {
          const result = await this.workerPool.enqueue({
            id: item.id,
            inputBytes: item.file.size,
            isHeavyWasm: item.routing.selectedTier === 'LOCAL_WASM',
            signal,
            onProgress: (pct) => {
              item.status = 'processing-local';
              item.progressPercent = pct;
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
      item.progressPercent = 15;
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
      this.renderQueue();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        item.status = 'cancelled';
        item.progressPercent = 0;
      } else {
        item.status = 'failed';
        item.errorMessage = err instanceof Error ? err.message : String(err);
      }
      this.renderQueue();
    }
  }

  private updateCardProgressOnly(item: BatchQueueItem): void {
    const card = this.queueList?.querySelector<HTMLElement>(`[data-job-id="${item.id}"]`);
    if (!card) return;
    const fill = card.querySelector<HTMLElement>('.progress-line-fill');
    const pill = card.querySelector<HTMLElement>('[data-status-pill]');
    if (fill) fill.style.width = `${item.progressPercent}%`;
    if (pill && isBusyStatus(item.status)) {
      pill.textContent = `Converting ${Math.round(item.progressPercent)}%`;
    }
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
    a.download = `converted-files-${Date.now()}.zip`;
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
    this.previewTitle.textContent = out.filename;

    const topBar = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:var(--surface-muted);border-radius:var(--radius-sm);">
        <span style="font-size:0.85rem;color:var(--text-secondary);">
          ${escapeHtml(item.sourceFormat.toUpperCase())} &rarr; <strong>${escapeHtml(item.targetFormat.toUpperCase())}</strong> (${formatBytes(out.bytes.length)})
        </span>
        <a class="btn btn-sm btn-success" href="${out.objectUrl}" download="${escapeHtml(out.filename)}">Download</a>
      </div>
    `;

    if (mime.startsWith('image/')) {
      this.previewBody.innerHTML = `
        ${topBar}
        <div style="text-align:center;padding:16px;background:var(--surface-muted);border-radius:var(--radius-sm);">
          <img src="${out.objectUrl}" alt="${escapeHtml(out.filename)}" style="max-width:100%;max-height:54vh;object-fit:contain;border-radius:6px;" />
        </div>
      `;
      this.previewBackdrop.classList.remove('hidden');
      return;
    }

    if (mime.startsWith('audio/')) {
      this.previewBody.innerHTML = `
        ${topBar}
        <div style="padding:20px;background:var(--surface-muted);border-radius:var(--radius-sm);">
          <audio controls src="${out.objectUrl}" style="width:100%"></audio>
        </div>
      `;
      this.previewBackdrop.classList.remove('hidden');
      return;
    }

    if (mime === 'application/pdf') {
      this.previewBody.innerHTML = `
        ${topBar}
        <iframe src="${out.objectUrl}" title="PDF Preview" style="width:100%;height:60vh;border:1px solid var(--border);border-radius:var(--radius-sm);background:#fff;"></iframe>
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
      const displayText = fullText.length > 30000 ? fullText.slice(0, 30000) : fullText;
      this.previewBody.innerHTML = `
        ${topBar}
        <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">
          <div style="display:flex;justify-content:flex-end;padding:8px 12px;background:var(--surface-hover);border-bottom:1px solid var(--border);">
            <button type="button" class="btn btn-xs btn-secondary" id="copy-preview-btn">Copy text</button>
          </div>
          <pre style="margin:0;padding:14px;max-height:50vh;overflow:auto;font-family:var(--font-mono);font-size:0.8rem;line-height:1.5;"><code>${escapeHtml(displayText)}</code></pre>
        </div>
      `;
      const copyBtn = document.getElementById('copy-preview-btn');
      copyBtn?.addEventListener('click', async () => {
        const ok = await copyTextToClipboard(fullText);
        if (copyBtn) copyBtn.textContent = ok ? 'Copied!' : 'Failed';
      });
      this.previewBackdrop.classList.remove('hidden');
      return;
    }

    this.previewBody.innerHTML = `
      ${topBar}
      <div style="padding:24px;text-align:center;color:var(--text-secondary);">
        Ready to download (${formatBytes(out.bytes.length)}).
      </div>
    `;
    this.previewBackdrop.classList.remove('hidden');
  }
}

if (typeof document !== 'undefined') {
  const app = new OmniConvertApp();
  void app.init();
}
