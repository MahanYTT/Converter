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

function tierBadgeMeta(decision: RoutingDecision): { label: string; icon: string } {
  switch (decision.selectedTier) {
    case 'LOCAL_NATIVE':
      return { label: 'LOCAL_NATIVE (0 KB upload)', icon: '⚡' };
    case 'LOCAL_PURE_JS':
      return { label: 'LOCAL_PURE_JS (0 KB upload)', icon: '🧠' };
    case 'LOCAL_WASM':
      return { label: 'LOCAL_WASM (Browser Sandbox)', icon: '🧩' };
    case 'SERVER_FALLBACK':
      return { label: `SERVER_FALLBACK (lane: ${decision.serverLane})`, icon: '☁️' };
  }
}

class OmniConvertApp {
  private readonly router = new ConversionRouter();
  private readonly serverClient = new ServerFallbackClient();
  private device!: DeviceCapabilityProfile;
  private workerPool!: WorkerPool;
  private items: BatchQueueItem[] = [];
  private serverHealth: ServerHealthMetrics | null = null;
  private localCompletedCount = 0;
  private serverCompletedCount = 0;
  private bandwidthSavedBytes = 0;

  // DOM elements
  private readonly dropzone = document.getElementById('dropzone')!;
  private readonly fileInput = document.getElementById('file-input') as HTMLInputElement;
  private readonly queueList = document.getElementById('queue-list')!;
  private readonly batchToolbar = document.getElementById('batch-toolbar')!;
  private readonly tierOverview = document.getElementById('tier-overview')!;
  private readonly queueCountLabel = document.getElementById('queue-count-label')!;
  private readonly queueRouteBreakdown = document.getElementById('queue-route-breakdown')!;
  private readonly downloadZipBtn = document.getElementById('download-zip-btn') as HTMLButtonElement;
  private readonly opsBackdrop = document.getElementById('ops-drawer-backdrop')!;
  private readonly previewBackdrop = document.getElementById('preview-backdrop')!;
  private readonly previewTitle = document.getElementById('preview-title')!;
  private readonly previewBody = document.getElementById('preview-body')!;

  async init(): Promise<void> {
    this.device = await DeviceProfiler.detect();
    this.workerPool = new WorkerPool(this.device.hardwareConcurrency);
    this.workerPool.subscribe((stats) => this.renderWorkerTelemetry(stats));

    this.renderDeviceTelemetry();
    this.bindEvents();
    await this.refreshServerHealth();

    // Periodic health polling when ops drawer is open or every 15s
    setInterval(() => {
      if (!this.opsBackdrop.classList.contains('hidden')) {
        void this.refreshServerHealth();
      }
    }, 5000);
  }

  private bindEvents(): void {
    document.getElementById('browse-files-btn')?.addEventListener('click', () => {
      this.fileInput.click();
    });

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
      btn.textContent = 'Generating sample files...';
      try {
        const files = await createDemoSampleFiles();
        await this.ingestFiles(files);
      } finally {
        btn.disabled = false;
        btn.textContent = oldText;
      }
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

    document.getElementById('convert-all-btn')?.addEventListener('click', () => {
      void this.convertAllReady();
    });

    document.getElementById('clear-completed-btn')?.addEventListener('click', () => {
      for (const item of this.items) {
        if (item.status === 'completed' || item.status === 'cancelled') {
          if (item.output?.objectUrl) URL.revokeObjectURL(item.output.objectUrl);
        }
      }
      this.items = this.items.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');
      this.renderQueue();
    });

    this.downloadZipBtn.addEventListener('click', () => {
      void this.downloadAllAsZip();
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
        setTimeout(() => {
          btn.textContent = '🧹 Trigger Immediate TTL Sweep';
        }, 2500);
        await this.refreshServerHealth();
      } else {
        btn.textContent = 'Server Offline';
        setTimeout(() => {
          btn.textContent = '🧹 Trigger Immediate TTL Sweep';
        }, 2000);
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
    document.getElementById('device-cores-text')!.textContent =
      `CPU: ${this.device.hardwareConcurrency} cores`;
    document.getElementById('device-ram-text')!.textContent =
      `RAM Cap: ${this.device.safeBrowserMemoryCapMB} MB (${this.device.deviceMemoryGB} GB)`;

    const coiText = document.getElementById('device-coi-text')!;
    const coiDot = document.getElementById('device-coi-dot')!;
    if (this.device.crossOriginIsolated) {
      coiText.textContent = 'SharedArrayBuffer: Active';
      coiDot.className = 'dot dot-emerald';
    } else {
      coiText.textContent = 'SharedArrayBuffer: Off';
      coiDot.className = 'dot dot-amber';
    }

    const capPills = document.getElementById('capability-pills')!;
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

    this.updateTopCounters();
  }

  private updateTopCounters(): void {
    const el = document.getElementById('stats-counter-text');
    if (el) {
      el.textContent = `Local: ${this.localCompletedCount} · Server: ${this.serverCompletedCount} · ${formatBytes(this.bandwidthSavedBytes)} saved`;
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
          ? `Ready for zero-upload ${routing.selectedTier} conversion`
          : `Ready for Server Fallback (lane: ${routing.serverLane})`,
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

    if (!hasItems) {
      this.queueList.innerHTML = '';
      return;
    }

    const localCount = this.items.filter((i) => i.routing.isLocal).length;
    const serverCount = this.items.length - localCount;
    const completedCount = this.items.filter((i) => i.status === 'completed' && i.output).length;

    this.queueCountLabel.textContent = `${this.items.length} file${this.items.length === 1 ? '' : 's'} in batch`;
    this.queueRouteBreakdown.textContent = `${localCount} Local (0 KB upload) · ${serverCount} Server Fallback`;
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
      const pctStr = pct <= 0 ? `${Math.round(pct)}% smaller` : `+${Math.round(pct)}%`;
      const timing = item.durationMs !== undefined ? ` · ${item.durationMs}ms` : '';
      deltaBadge = `<span class="delta-badge ${pct > 0 ? 'larger' : ''}">${formatBytes(item.output.bytes.length)} (${pctStr}${timing})</span>`;
    }

    const magicLabel = item.magic.isSpoofedOrMismatched
      ? `⚠ Spoofed: real ${item.sourceFormat.toUpperCase()}`
      : item.magic.confidence === 'high'
        ? `✓ Magic: ${item.sourceFormat.toUpperCase()}`
        : `Ext: ${item.sourceFormat.toUpperCase()}`;

    return `
      <article class="job-card status-${item.status}" data-job-id="${item.id}">
        <div class="job-top-row">
          <div class="file-identity">
            <div class="file-title-line">
              <span class="file-name">${escapeHtml(item.file.name)}</span>
              <span class="file-size">${formatBytes(item.file.size)}</span>
              <span class="magic-badge ${item.magic.isSpoofedOrMismatched ? 'spoof' : ''}" title="${escapeHtml(item.magic.warningMessage || 'Verified by binary magic-byte inspection')}">
                ${escapeHtml(magicLabel)}
              </span>
            </div>
          </div>

          <div class="route-badge route-${item.routing.selectedTier}" title="${escapeHtml(item.routing.reason)}">
            <span>${badge.icon}</span>
            <span>${escapeHtml(badge.label)}</span>
          </div>
        </div>

        <div class="job-controls-row">
          <div class="control-group">
            <span class="control-label">Convert to</span>
            <select data-action="target" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>
              ${this.renderTargetSelectOptions(item.sourceFormat, item.targetFormat)}
            </select>
          </div>

          ${
            presets.length > 0
              ? `
            <div class="control-group">
              <span class="control-label">Preset</span>
              <select data-action="preset" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>
                <option value="">Custom</option>
                ${presets
                  .map(
                    (p) =>
                      `<option value="${escapeHtml(p.id)}" ${item.presetId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`,
                  )
                  .join('')}
              </select>
            </div>`
              : ''
          }

          <div class="control-group">
            <span class="control-label">Route</span>
            <div class="mode-toggle">
              <button type="button" class="${mode === 'AUTO' ? 'active' : ''}" data-action="mode" data-mode="AUTO" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>Auto Hybrid</button>
              <button type="button" class="${mode === 'LOCAL_ONLY' ? 'active' : ''}" data-action="mode" data-mode="LOCAL_ONLY" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>Force Local</button>
              <button type="button" class="${mode === 'SERVER_ONLY' ? 'active' : ''}" data-action="mode" data-mode="SERVER_ONLY" data-id="${item.id}" ${isBusy ? 'disabled' : ''}>Force Server</button>
            </div>
          </div>
        </div>

        <div class="route-reason-banner ${item.routing.isLocal ? '' : 'server'}">
          <strong>Engine:</strong> <code>${escapeHtml(item.routing.selectedEngine)}</code> ·
          <strong>Est. RAM:</strong> ~${item.routing.estimatedPeakMemoryMB.toFixed(1)} MB ·
          ${escapeHtml(item.routing.reason)}
        </div>

        ${
          item.routing.warnings.length > 0
            ? `<div class="warning-banner">${item.routing.warnings.map(escapeHtml).join('<br/>')}</div>`
            : ''
        }

        ${item.errorMessage ? `<div class="error-banner">${escapeHtml(item.errorMessage)}</div>` : ''}

        ${this.renderContextualOptions(item)}

        <div class="job-footer">
          <div class="progress-wrap">
            <div class="progress-track">
              <div class="progress-fill ${item.routing.isLocal ? '' : 'server'}" style="width: ${item.progressPercent}%"></div>
            </div>
            <div class="progress-meta">
              <span>${escapeHtml(item.stageMessage)}</span>
              <span>${Math.round(item.progressPercent)}%</span>
            </div>
          </div>

          ${deltaBadge}

          <div class="job-actions">
            ${
              isBusy
                ? `<button type="button" class="btn btn-sm btn-danger" data-action="cancel" data-id="${item.id}">Cancel</button>`
                : item.status === 'completed' && item.output
                  ? `
                    <button type="button" class="btn btn-sm btn-secondary" data-action="preview" data-id="${item.id}">👁 Preview</button>
                    <a class="btn btn-sm btn-emerald" href="${item.output.objectUrl}" download="${escapeHtml(item.output.filename)}">⬇ Download</a>
                    <button type="button" class="btn btn-sm btn-ghost" data-action="convert" data-id="${item.id}">↻ Re-run</button>
                  `
                  : `<button type="button" class="btn btn-sm btn-primary" data-action="convert" data-id="${item.id}">Convert</button>`
            }
            <button type="button" class="btn btn-sm btn-ghost" data-action="remove" data-id="${item.id}" title="Remove from batch">✕</button>
          </div>
        </div>
      </article>
    `;
  }

  private attachCardListeners(): void {
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
    const fill = card.querySelector<HTMLElement>('.progress-fill');
    const metaSpans = card.querySelectorAll<HTMLElement>('.progress-meta span');
    if (fill) fill.style.width = `${item.progressPercent}%`;
    if (metaSpans[0]) metaSpans[0].textContent = item.stageMessage;
    if (metaSpans[1]) metaSpans[1].textContent = `${Math.round(item.progressPercent)}%`;
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
      dot.className = 'dot dot-rose';
      text.textContent = 'Server: Offline (Local 100% Ready)';
    } else if (health.status === 'ok') {
      dot.className = 'dot dot-emerald';
      text.textContent = `Server: Online (${health.storage.activeJobDirs} active)`;
    } else {
      dot.className = 'dot dot-amber';
      text.textContent = `Server: ${health.status}`;
    }

    this.renderServerTelemetry();
  }

  private renderWorkerTelemetry(stats: WorkerPoolStats): void {
    const metricsEl = document.getElementById('client-worker-metrics');
    const slotsEl = document.getElementById('worker-slots-list');
    if (!metricsEl || !slotsEl) return;

    metricsEl.innerHTML = `
      <div class="mini-stat">
        <div class="mini-stat-label">Active / Max Pool</div>
        <div class="mini-stat-value">${stats.activeCount} / ${stats.maxWorkers}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">Queued Tasks</div>
        <div class="mini-stat-value">${stats.queuedCount}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">Processed</div>
        <div class="mini-stat-value">${stats.totalJobsProcessed} (${formatBytes(stats.totalBytesProcessed)})</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">WASM Recycles</div>
        <div class="mini-stat-value">${stats.recycledWorkersCount}</div>
      </div>
    `;

    slotsEl.innerHTML = stats.slots
      .map(
        (s) => `
      <div class="slot-row">
        <span>Worker #${s.slotId} (${s.busy ? 'BUSY' : 'IDLE'})</span>
        <span>${s.jobsRun} jobs · ${formatBytes(s.cumulativeBytes)} / ${formatBytes(stats.highWaterMarkBytes)}</span>
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
      <div class="mini-stat">
        <div class="mini-stat-label">lane:${lane}</div>
        <div class="mini-stat-value">${h.activeJobsByLane[lane] ?? 0} / ${h.laneConcurrencyLimits[lane] ?? '-'} active</div>
        <div class="muted">${h.queuedJobsByLane[lane] ?? 0} queued</div>
      </div>`,
      )
      .join('');

    const st = h.storage;
    const pct = Math.min(100, Math.max(0, st.usagePercent));
    storageEl.innerHTML = `
      <div class="progress-track">
        <div class="progress-fill server" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span>Used: <strong>${formatBytes(st.usedBytes)}</strong> / ${formatBytes(st.maxQuotaBytes)} (${pct.toFixed(1)}%)</span>
        <span>TTL: <strong>${st.ttlMinutes} min</strong></span>
      </div>
      <div class="muted">
        Active job sandboxes: ${st.activeJobDirs} · Total purged dirs: ${st.totalPurgedDirs} · Completed: ${h.totalCompletedJobs}
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
