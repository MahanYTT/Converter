import type {
  ConversionOptions,
  DeviceCapabilityProfile,
  FormatCategory,
  FormatDefinition,
  JobStatus,
  MagicDetectionResult,
  RoutingDecision,
  ServerHealthMetrics,
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
  getSharedWasmLoader,
} from '../workers/local-engines.ts';
import { WasmLoaderError } from '../workers/wasm-loader.ts';
import { WorkerPool, type WorkerPoolStats } from '../workers/worker-pool.ts';

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
  };
}

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

function tierBadgeMeta(decision: RoutingDecision): { label: string; tierClass: string; icon: string } {
  switch (decision.selectedTier) {
    case 'LOCAL_NATIVE':
      return { label: 'On-device', tierClass: 'local', icon: '✓' };
    case 'LOCAL_PURE_JS':
      return { label: 'Worker', tierClass: 'local', icon: '✓' };
    case 'LOCAL_WASM':
      return { label: 'WASM', tierClass: 'wasm', icon: '🧩' };
    case 'SERVER_FALLBACK':
      return { label: `Server (${decision.serverLane})`, tierClass: 'server', icon: '☁' };
  }
}

class OmniConvertApp {
  router = new ConversionRouter();
  serverClient = new ServerFallbackClient();
  device;
  workerPool;
  items = [];
  serverHealth = null;
  localCompletedCount = 0;
  serverCompletedCount = 0;
  bandwidthSavedBytes = 0;

  // DOM elements
  dropzone = document.getElementById('dropzone');
  fileInput = document.getElementById('file-input');
  queueList = document.getElementById('queue-list');
  batchToolbar = document.getElementById('batch-toolbar');
  tierOverview = document.getElementById('tier-overview');
  heroHeader = document.getElementById('hero-header');
  queueCountLabel = document.getElementById('queue-count-label');
  queueRouteBreakdown = document.getElementById('queue-route-breakdown');
  downloadZipBtn = document.getElementById('download-zip-btn');
  batchTargetSelect = document.getElementById('batch-target-select');

  opsBackdrop = document.getElementById('ops-drawer-backdrop');
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
    this.workerPool.subscribe((stats) => this.renderWorkerTelemetry(stats));

    this.renderDeviceTelemetry();
    this.renderLandingCategoryTabs('image');
    this.populateBatchTargetDropdown();
    this.bindEvents();
    await this.refreshServerHealth();

    setInterval(() => {
      if (!this.opsBackdrop.classList.contains('hidden')) {
        void this.refreshServerHealth();
      }
    }, 5000);
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

  private bindEvents(): void {
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

    document.getElementById('browse-files-btn')?.addEventListener('click', () => this.fileInput.click());

    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files && this.fileInput.files.length > 0) {
        void this.ingestFiles(Array.from(this.fileInput.files));
        this.fileInput.value = '';
      }
    });

    document.getElementById('load-demo-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('load-demo-btn') as HTMLButtonElement;
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

    // Paste Modal
    document.getElementById('paste-text-btn')?.addEventListener('click', () => {
      this.pasteModalBackdrop.classList.remove('hidden');
    });
    document.getElementById('close-paste-modal-btn')?.addEventListener('click', () => {
      this.pasteModalBackdrop.classList.add('hidden');
    });
    document.getElementById('cancel-paste-btn')?.addEventListener('click', () => {
      this.pasteModalBackdrop.classList.add('hidden');
    });
    document.getElementById('add-paste-btn')?.addEventListener('click', () => {
      const textarea = document.getElementById('paste-textarea') as HTMLTextAreaElement;
      const fmtSelect = document.getElementById('paste-source-format') as HTMLSelectElement;
      const nameInput = document.getElementById('paste-filename') as HTMLInputElement;

      const text = textarea.value.trim();
      if (!text) return;
      const ext = fmtSelect.value;
      const name = nameInput.value.trim() || `snippet.${ext}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], name, { type: 'text/plain' });

      void this.ingestFiles([file]);
      textarea.value = '';
      this.pasteModalBackdrop.classList.add('hidden');
    });

    // Formats Modal
    document.getElementById('open-formats-btn')?.addEventListener('click', () => {
      this.renderFormatsExplorer();
      this.formatsModalBackdrop.classList.remove('hidden');
    });
    document.getElementById('close-formats-modal-btn')?.addEventListener('click', () => {
      this.formatsModalBackdrop.classList.add('hidden');
    });
    document.getElementById('formats-search-input')?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderFormatsExplorer(query);
    });

    // Drag and drop
    ['dragenter', 'dragover'].forEach((evtName) => {
      this.dropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        this.dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((evtName) => {
      this.dropzone.addEventListener(evtName, (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('drag-active');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      const dt = (e as DragEvent).dataTransfer;
      if (dt?.files && dt.files.length > 0) {
        void this.ingestFiles(Array.from(dt.files));
      }
    });

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

    this.downloadZipBtn.addEventListener('click', () => {
      void this.downloadAllAsZip();
    });

    this.batchTargetSelect.addEventListener('change', () => {
      const target = this.batchTargetSelect.value;
      if (!target) return;
      for (const item of this.items) {
        const compatible = getCompatibleTargets(item.sourceFormat);
        if (compatible.some((f) => f.id === target)) {
          item.targetFormat = target;
          item.presetId = '';
          this.recomputeRouting(item);
        }
      }
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

    // Ops Drawer
    document.getElementById('open-ops-drawer-btn')?.addEventListener('click', () => {
      this.opsBackdrop.classList.remove('hidden');
      void this.refreshServerHealth();
      this.renderWorkerTelemetry(this.workerPool.getStats());
    });
    document.getElementById('close-ops-drawer-btn')?.addEventListener('click', () => {
      this.opsBackdrop.classList.add('hidden');
    });
    this.opsBackdrop.addEventListener('click', (e) => {
      if (e.target === this.opsBackdrop) this.opsBackdrop.classList.add('hidden');
    });

    document.getElementById('refresh-health-btn')?.addEventListener('click', () => {
      void this.refreshServerHealth();
    });
    document.getElementById('recycle-workers-btn')?.addEventListener('click', () => {
      this.workerPool.recycleAllHeavyWorkers();
    });
    document.getElementById('trigger-sweep-btn')?.addEventListener('click', async () => {
      const res = await this.serverClient.triggerSweep();
      const btn = document.getElementById('trigger-sweep-btn') as HTMLButtonElement;
      if (res) {
        btn.textContent = `✓ Purged ${res.purgedDirs ?? 0} dirs`;
        setTimeout(() => { btn.textContent = 'Run TTL sweep'; }, 2500);
        await this.refreshServerHealth();
      } else {
        btn.textContent = 'Server Offline';
        setTimeout(() => { btn.textContent = 'Run TTL sweep'; }, 2000);
      }
    });

    // Preview modal
    document.getElementById('close-preview-btn')?.addEventListener('click', () => {
      this.previewBackdrop.classList.add('hidden');
      this.previewBody.innerHTML = '';
    });
    this.previewBackdrop.addEventListener('click', (e) => {
      if (e.target === this.previewBackdrop) {
        this.previewBackdrop.classList.add('hidden');
        this.previewBody.innerHTML = '';
      }
    });
  }

  private renderDeviceTelemetry(): void {
    document.getElementById('device-cores-text')!.textContent = `${this.device.hardwareConcurrency} cores`;
    document.getElementById('device-ram-text')!.textContent = `${this.device.safeBrowserMemoryCapMB} MB (${this.device.deviceMemoryGB} GB)`;

    const coiText = document.getElementById('device-coi-text');
    if (coiText) {
      coiText.textContent = this.device.crossOriginIsolated ? 'Active' : 'Single-thread';
    }

    const footerText = document.getElementById('footer-device-summary');
    if (footerText) {
      footerText.textContent = `${this.device.hardwareConcurrency} Cores · ${this.device.safeBrowserMemoryCapMB} MB Safe Budget · ${this.device.crossOriginIsolated ? 'SharedArrayBuffer Active' : 'Single-thread'}`;
    }

    const capPills = document.getElementById('capability-pills');
    if (capPills) {
      const chips = [
        { label: 'OffscreenCanvas', ok: this.device.supportsOffscreenCanvas },
        { label: 'WebAudio PCM', ok: this.device.supportsWebAudio },
        { label: 'CompressionStream', ok: this.device.supportsCompressionStream },
        { label: 'OPFS Storage', ok: this.device.supportsOPFS },
        { label: 'WebCodecs', ok: this.device.supportsWebCodecs },
        {
          label: `Canvas Encoders: ${this.device.supportedCanvasEncodeMimes.map((m) => m.replace('image/', '').toUpperCase()).join(', ')}`,
          ok: this.device.supportedCanvasEncodeMimes.length > 0,
        },
      ];
      capPills.innerHTML = chips
        .map((c) => `<span class="cap-chip ${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '○'} ${escapeHtml(c.label)}</span>`)
        .join('');
    }

    this.updateTopCounters();
  }

  private renderLandingCategoryTabs(category: FormatCategory): void {
    const container = document.getElementById('landing-format-chips');
    if (!container) return;
    const formats = CLIENT_FORMATS.filter((f) => f.category === category);
    container.innerHTML = formats
      .map((f) => {
        let badgeClass = 'local';
        if (!f.browserSupport.canEncodeNative && !f.browserSupport.canProcessPureJs) {
          badgeClass = f.browserSupport.canProcessWasm ? 'wasm' : 'server';
        }
        return `
          <div class="format-chip">
            <i class="legend-dot ${badgeClass}"></i>
            <strong>${escapeHtml(f.label)}</strong>
            <span>${escapeHtml(f.name)}</span>
          </div>
        `;
      })
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

    listEl.innerHTML = filtered
      .map((f) => {
        let routeLabel = 'Local (On-device)';
        let badgeClass = 'local';
        if (!f.browserSupport.canEncodeNative && !f.browserSupport.canProcessPureJs) {
          if (f.browserSupport.canProcessWasm) {
            routeLabel = 'Local WASM Sandbox';
            badgeClass = 'wasm';
          } else {
            routeLabel = 'Managed Server Fallback';
            badgeClass = 'server';
          }
        }
        return `
          <div class="format-row-item">
            <div>
              <strong>${escapeHtml(f.label)}</strong> <span class="muted">(${escapeHtml(f.mimeType)})</span>
              <div class="muted">${escapeHtml(f.name)} — ${escapeHtml(f.description)}</div>
            </div>
            <span class="route-pill ${badgeClass}">${escapeHtml(routeLabel)}</span>
          </div>
        `;
      })
      .join('');
  }

  private updateTopCounters(): void {
    const el = document.getElementById('stats-counter-text');
    if (el) {
      el.textContent = `${this.localCompletedCount} local · ${this.serverCompletedCount} server · ${formatBytes(this.bandwidthSavedBytes)} saved`;
    }
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
      if (file.type.startsWith('image/')) {
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
        stageMessage: routing.isLocal
          ? `Ready (Local ${routing.selectedTier})`
          : `Ready (Server ${routing.serverLane})`,
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
    try {
      return this.router.route(
        { name: file.name, sizeBytes: file.size, headerBytes },
        sourceFormat,
        targetFormat,
        options,
        this.device,
      );
    } catch (err) {
      // If LOCAL_ONLY was forced on a server-only pair, revert to AUTO so UI stays valid and warn
      const fallback = this.router.route(
        { name: file.name, sizeBytes: file.size, headerBytes },
        sourceFormat,
        targetFormat,
        { ...options, forceExecutionMode: 'AUTO' },
        this.device,
      );
      fallback.warnings.push(err instanceof Error ? err.message : String(err));
      return fallback;
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
      item.stageMessage = item.routing.isLocal
        ? `Ready for zero-upload ${item.routing.selectedTier}`
        : `Ready for Server Fallback (lane: ${item.routing.serverLane})`;
    }
  }

  private renderQueue(): void {
    const hasItems = this.items.length > 0;
    this.batchToolbar.classList.toggle('hidden', !hasItems);
    this.tierOverview.classList.toggle('hidden', hasItems);
    this.heroHeader.classList.toggle('compact', hasItems);
    this.dropzone.classList.toggle('compact', hasItems);

    if (!hasItems) {
      this.queueList.innerHTML = '';
      return;
    }

    const localCount = this.items.filter((i) => i.routing.isLocal).length;
    const serverCount = this.items.length - localCount;
    const completedCount = this.items.filter((i) => i.status === 'completed' && i.output).length;

    this.queueCountLabel.textContent = `${this.items.length} file${this.items.length === 1 ? '' : 's'}`;
    this.queueRouteBreakdown.textContent = `${localCount} on-device · ${serverCount} cloud fallback`;
    this.downloadZipBtn.classList.toggle('hidden', completedCount < 2);

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

    if (['png', 'jpg', 'webp', 'avif', 'bmp', 'ico'].includes(tgt) || srcCat === 'image') {
      if (['jpg', 'webp', 'avif'].includes(tgt)) {
        parts.push(`
          <label class="opt-field">
            Quality: <strong>${item.options.quality ?? 85}%</strong>
            <input type="range" min="15" max="100" value="${item.options.quality ?? 85}" data-opt="quality" data-id="${item.id}" />
          </label>
        `);
      }
      parts.push(`
        <label class="opt-field">
          W: <input type="number" placeholder="auto" min="16" max="8192" value="${item.options.width ?? ''}" data-opt="width" data-id="${item.id}" />
        </label>
        <label class="opt-field">
          H: <input type="number" placeholder="auto" min="16" max="8192" value="${item.options.height ?? ''}" data-opt="height" data-id="${item.id}" />
        </label>
        <label class="opt-field">
          <input type="checkbox" ${item.options.stripMetadata !== false ? 'checked' : ''} data-opt="stripMetadata" data-id="${item.id}" />
          Strip EXIF
        </label>
      `);
    } else if (srcCat === 'audio' || tgt === 'wav') {
      parts.push(`
        <label class="opt-field">
          Hz:
          <select data-opt="sampleRate" data-id="${item.id}">
            <option value="" ${!item.options.sampleRate ? 'selected' : ''}>Original</option>
            <option value="48000" ${item.options.sampleRate === 48000 ? 'selected' : ''}>48,000 Hz</option>
            <option value="44100" ${item.options.sampleRate === 44100 ? 'selected' : ''}>44,100 Hz</option>
            <option value="16000" ${item.options.sampleRate === 16000 ? 'selected' : ''}>16,000 Hz</option>
          </select>
        </label>
        <label class="opt-field">
          Ch:
          <select data-opt="channels" data-id="${item.id}">
            <option value="" ${!item.options.channels ? 'selected' : ''}>Auto</option>
            <option value="2" ${item.options.channels === 2 ? 'selected' : ''}>Stereo</option>
            <option value="1" ${item.options.channels === 1 ? 'selected' : ''}>Mono</option>
          </select>
        </label>
        <label class="opt-field">
          <input type="checkbox" ${item.options.normalizeAudio ? 'checked' : ''} data-opt="normalizeAudio" data-id="${item.id}" />
          Normalize (-1 dB)
        </label>
      `);
    } else if (srcCat === 'data') {
      parts.push(`
        <label class="opt-field">
          Indent:
          <select data-opt="indentSpaces" data-id="${item.id}">
            <option value="2" ${(item.options.indentSpaces ?? 2) === 2 ? 'selected' : ''}>2 spaces</option>
            <option value="4" ${item.options.indentSpaces === 4 ? 'selected' : ''}>4 spaces</option>
            <option value="0" ${item.options.indentSpaces === 0 ? 'selected' : ''}>Minified</option>
          </select>
        </label>
      `);
      if (tgt === 'sql') {
        parts.push(`
          <label class="opt-field">
            Table: <input type="text" value="${escapeHtml(item.options.sqlTableName ?? 'records')}" data-opt="sqlTableName" data-id="${item.id}" style="width:110px" />
          </label>
        `);
      }
    }

    if (tgt === 'pdf') {
      parts.push(`
        <label class="opt-field">
          Page:
          <select data-opt="pageSize" data-id="${item.id}">
            <option value="A4" ${(item.options.pageSize ?? 'A4') === 'A4' ? 'selected' : ''}>A4</option>
            <option value="Letter" ${item.options.pageSize === 'Letter' ? 'selected' : ''}>Letter</option>
            <option value="Legal" ${item.options.pageSize === 'Legal' ? 'selected' : ''}>Legal</option>
          </select>
        </label>
      `);
    }

    if (!item.routing.isLocal) {
      parts.push(`
        <label class="opt-field">
          <input type="checkbox" ${item.options.autoDeleteServerFile !== false ? 'checked' : ''} data-opt="autoDeleteServerFile" data-id="${item.id}" />
          Delete from server after download
        </label>
      `);
    }

    return parts.length > 0 ? `<div class="options-panel">${parts.join('')}</div>` : '';
  }

  private renderJobCard(item: BatchQueueItem): string {
    const srcDef = getFormatById(item.sourceFormat);
    const category = srcDef?.category ?? 'document';
    const presets = getPresetsForCategory(category);
    const badge = tierBadgeMeta(item.routing);
    const isBusy =
      item.status === 'processing-local' ||
      item.status === 'queued-local' ||
      item.status === 'uploading-server' ||
      item.status === 'queued-server' ||
      item.status === 'processing-server';

    const mode = item.options.forceExecutionMode ?? 'AUTO';

    let deltaBadge = '';
    if (item.status === 'completed' && item.output) {
      const pct = ((item.output.bytes.length - item.file.size) / Math.max(1, item.file.size)) * 100;
      const pctStr = pct <= 0 ? `${Math.round(pct)}%` : `+${Math.round(pct)}%`;
      const timing = item.durationMs !== undefined ? ` · ${item.durationMs}ms` : '';
      deltaBadge = `<span class="delta-text ${pct > 0 ? 'larger' : ''}">${formatBytes(item.output.bytes.length)} (${pctStr}${timing})</span>`;
    }

    const fileIconSvg = item.thumbnailUrl
      ? `<img src="${item.thumbnailUrl}" alt="" />`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;

    return `
      <article class="job-card status-${item.status}" data-job-id="${item.id}">
        <!-- Hairline Progress Line -->
        <div class="progress-line-track">
          <div class="progress-line-fill ${item.routing.isLocal ? '' : 'server'}" style="width: ${item.progressPercent}%"></div>
        </div>

        <!-- Main Clean Single Row -->
        <div class="job-main-row">
          <div class="job-file-col">
            <div class="file-thumb" aria-hidden="true">${fileIconSvg}</div>
            <div class="file-meta-col">
              <span class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span>
              <div class="file-subline">
                <span>${formatBytes(item.file.size)}</span>
                <span class="fmt-pill ${item.magic.isSpoofedOrMismatched ? 'spoof' : ''}">${escapeHtml(item.sourceFormat)}</span>
              </div>
            </div>
          </div>

          <div class="job-convert-col">
            <span class="arrow-muted" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </span>
            <select class="target-select" data-action="target" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>
              ${this.renderTargetSelectOptions(item.sourceFormat, item.targetFormat)}
            </select>
            ${
              presets.length > 0
                ? `
              <select class="preset-select" data-action="preset" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>
                <option value="">Preset...</option>
                ${presets.map((p) => `<option value="${escapeHtml(p.id)}" ${item.presetId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
              </select>`
                : ''
            }
            <button type="button" class="settings-toggle-btn ${item.expandedSettings ? 'active' : ''}" data-action="toggle-settings" data-id="${item.id}" title="Toggle format options & route details">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>

          <div class="job-actions-col">
            <span class="route-pill ${badge.tierClass}" title="${escapeHtml(item.routing.reason)}">
              <span>${badge.icon}</span> ${escapeHtml(badge.label)}
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

        <!-- Collapsible Drawer -->
        ${
          item.expandedSettings
            ? `
          <div class="job-settings-drawer">
            <div class="engine-meta-line">
              <span>Engine: <code>${escapeHtml(item.routing.selectedEngine)}</code></span>
              <span>Memory Est: <code>~${item.routing.estimatedPeakMemoryMB.toFixed(1)} MB</code></span>
              <span>${escapeHtml(item.routing.reason)}</span>
            </div>

            <div class="settings-row">
              <div class="mode-segmented">
                <button type="button" class="${mode === 'AUTO' ? 'active' : ''}" data-action="mode" data-mode="AUTO" data-id="${item.id}">Auto Hybrid</button>
                <button type="button" class="${mode === 'LOCAL_ONLY' ? 'active' : ''}" data-action="mode" data-mode="LOCAL_ONLY" data-id="${item.id}">Force Local</button>
                <button type="button" class="${mode === 'SERVER_ONLY' ? 'active' : ''}" data-action="mode" data-mode="SERVER_ONLY" data-id="${item.id}">Force Server</button>
              </div>

              ${this.renderContextualOptions(item)}
            </div>
          </div>`
            : ''
        }

        ${
          item.routing.warnings.length > 0
            ? `<div class="inline-alert warn">${item.routing.warnings.map(escapeHtml).join('<br/>')}</div>`
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
            forceExecutionMode: item.options.forceExecutionMode,
            autoDeleteServerFile: item.options.autoDeleteServerFile,
          };
        }
        this.recomputeRouting(item);
        this.renderQueue();
      });
    });

    this.queueList.querySelectorAll<HTMLButtonElement>('button[data-action="mode"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id);
        if (!item) return;
        item.options = {
          ...item.options,
          forceExecutionMode: btn.dataset.mode as ConversionOptions['forceExecutionMode'],
        };
        this.recomputeRouting(item);
        this.renderQueue();
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
    const startedAt = performance.now();

    try {
      if (item.routing.isLocal) {
        item.status = 'queued-local';
        item.progressPercent = 5;
        item.stageMessage = 'Waiting for local worker slot...';
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
              item.stageMessage = msg;
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
          };
          item.status = 'completed';
          item.progressPercent = 100;
          item.durationMs = Math.round(performance.now() - startedAt);
          item.stageMessage = `Completed locally in ${item.durationMs}ms (0 KB uploaded)`;
          this.localCompletedCount += 1;
          this.bandwidthSavedBytes += item.file.size;
          this.updateTopCounters();
          this.renderQueue();
          return;
        } catch (localErr) {
          if (localErr instanceof DOMException && localErr.name === 'AbortError') {
            throw localErr;
          }
          // Automatic runtime fallback to server if allowed
          const canEscalate =
            item.options.forceExecutionMode !== 'LOCAL_ONLY' &&
            (item.routing.fallbackTier === 'SERVER_FALLBACK' ||
              localErr instanceof WasmLoaderError);

          if (!canEscalate) {
            throw localErr;
          }

          const errObj = localErr instanceof Error ? localErr : new Error(String(localErr));
          item.routing = this.router.escalateFailedLocalJobToServer(item.routing, errObj);
        }
      }

      // Server Fallback execution
      item.status = 'uploading-server';
      item.progressPercent = 10;
      item.stageMessage = `Uploading to Server Fallback (lane: ${item.routing.serverLane})...`;
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
          item.stageMessage = upd.stageMessage;
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
      item.stageMessage = `Completed on server (${item.routing.serverLane} lane) in ${item.durationMs}ms`;
      this.serverCompletedCount += 1;
      this.updateTopCounters();
      this.renderQueue();
      void this.refreshServerHealth();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        item.status = 'cancelled';
        item.progressPercent = 0;
        item.stageMessage = 'Cancelled by user';
      } else {
        item.status = 'failed';
        item.errorMessage = err instanceof Error ? err.message : String(err);
        item.stageMessage = 'Conversion failed';
      }
      this.renderQueue();
    }
  }

  private updateCardProgressOnly(item: BatchQueueItem): void {
    const card = this.queueList.querySelector<HTMLElement>(`[data-job-id="${item.id}"]`);
    if (!card) return;
    const fill = card.querySelector<HTMLElement>('.progress-line-fill');
    const barSpans = card.querySelectorAll<HTMLElement>('.job-progress-bar span');
    if (fill) fill.style.width = `${item.progressPercent}%`;
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
    if (!item.output) return;
    this.previewTitle.textContent = `Preview — ${item.output.filename} (${formatBytes(item.output.bytes.length)})`;
    const mime = item.output.mimeType;

    if (mime.startsWith('image/')) {
      this.previewBody.innerHTML = `<img src="${item.output.objectUrl}" alt="${escapeHtml(item.output.filename)}" />`;
    } else if (mime.startsWith('audio/')) {
      this.previewBody.innerHTML = `<audio controls src="${item.output.objectUrl}" style="width:100%"></audio>`;
    } else if (mime === 'application/pdf') {
      this.previewBody.innerHTML = `<iframe src="${item.output.objectUrl}" title="PDF Preview"></iframe>`;
    } else if (
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('yaml') ||
      mime.includes('sql') ||
      mime.includes('toml')
    ) {
      const text = await item.output.blob.text();
      this.previewBody.innerHTML = `<pre>${escapeHtml(text.slice(0, 25000))}</pre>`;
    } else {
      this.previewBody.innerHTML = `<p class="muted">Binary artifact (${escapeHtml(mime)}, ${formatBytes(item.output.bytes.length)}). Use Download to save.</p>`;
    }

    this.previewBackdrop.classList.remove('hidden');
  }

  private async refreshServerHealth(): Promise<void> {
    const health = await this.serverClient.getHealth();
    this.serverHealth = health;

    const dot = document.getElementById('server-health-dot')!;
    const text = document.getElementById('server-health-text')!;

    if (!health) {
      dot.className = 'status-indicator dot-rose';
      text.textContent = 'Offline';
    } else if (health.status === 'ok') {
      dot.className = 'status-indicator dot-emerald';
      text.textContent = 'Engine';
    } else {
      dot.className = 'status-indicator dot-amber';
      text.textContent = health.status;
    }

    this.renderServerTelemetry();
  }

  private renderWorkerTelemetry(stats: WorkerPoolStats): void {
    const metricsEl = document.getElementById('client-worker-metrics');
    const slotsEl = document.getElementById('worker-slots-list');
    if (!metricsEl || !slotsEl) return;

    metricsEl.innerHTML = `
      <div class="kv-item">
        <span class="kv-label">Active / Pool</span>
        <strong class="kv-val">${stats.activeCount} / ${stats.maxWorkers}</strong>
      </div>
      <div class="kv-item">
        <span class="kv-label">Queued</span>
        <strong class="kv-val">${stats.queuedCount}</strong>
      </div>
      <div class="kv-item">
        <span class="kv-label">Processed</span>
        <strong class="kv-val">${stats.totalJobsProcessed}</strong>
      </div>
    `;

    slotsEl.innerHTML = stats.slots
      .map(
        (s) => `
      <div class="slot-row">
        <span>Worker #${s.slotId} (${s.busy ? 'BUSY' : 'IDLE'})</span>
        <span>${s.jobsRun} jobs · ${formatBytes(s.cumulativeBytes)}</span>
      </div>`,
      )
      .join('');

    void getSharedWasmLoader()
      .getAllStatuses()
      .then((statuses) => {
        const wasmInfo = statuses
          .map((w) => `${w.id}: ${w.cached ? 'Cached' : 'Lazy CDN'} (${w.sizeMB} MB)`)
          .join(' · ');
        slotsEl.insertAdjacentHTML(
          'beforeend',
          `<div class="muted" style="margin-top:6px">WASM Modules: ${escapeHtml(wasmInfo)}</div>`,
        );
      });
  }

  private renderServerTelemetry(): void {
    const lanesEl = document.getElementById('server-lanes-grid')!;
    const storageEl = document.getElementById('server-storage-panel')!;
    const binariesEl = document.getElementById('server-binaries-grid')!;

    if (!this.serverHealth) {
      lanesEl.innerHTML = `<div class="muted">Server fallback endpoint (/api/v1/health) unreachable. Local Tier 1 &amp; Tier 2 engines operate 100% offline.</div>`;
      storageEl.innerHTML = `<div class="muted">No server scratch telemetry available.</div>`;
      binariesEl.innerHTML = '';
      return;
    }

    const h = this.serverHealth;
    const lanes = ['fast', 'document', 'media'] as const;
    lanesEl.innerHTML = lanes
      .map(
        (lane) => `
      <div class="kv-item">
        <span class="kv-label">lane:${lane}</span>
        <strong class="kv-val">${h.activeJobsByLane[lane] ?? 0} / ${h.laneConcurrencyLimits[lane] ?? '-'}</strong>
      </div>`,
      )
      .join('');

    const st = h.storage;
    const pct = Math.min(100, Math.max(0, st.usagePercent));
    storageEl.innerHTML = `
      <div class="progress-line-track">
        <div class="progress-line-fill server" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px">
        <span>Used: <strong>${formatBytes(st.usedBytes)}</strong> / ${formatBytes(st.maxQuotaBytes)} (${pct.toFixed(1)}%)</span>
        <span>TTL: <strong>${st.ttlMinutes} min</strong></span>
      </div>
      <div class="muted">
        Active sandboxes: ${st.activeJobDirs} · Purged: ${st.totalPurgedDirs} · Completed: ${h.totalCompletedJobs}
      </div>
    `;

    const bins = Object.entries(h.detectedBinaries);
    binariesEl.innerHTML = bins
      .map(
        ([name, ok]) => `
      <div class="binary-pill ${ok ? 'available' : 'missing'}">
        <span>${escapeHtml(name)}</span>
        <span>${ok ? '✓ Ready' : '○ Fallback'}</span>
      </div>`,
      )
      .join('');
  }
}

if (typeof document !== 'undefined') {
  const app = new OmniConvertApp();
  void app.init();
}
