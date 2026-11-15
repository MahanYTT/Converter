import type {
  ConversionJobRecord,
  ConversionOptions,
  ServerHealthMetrics,
} from '../../shared/types.ts';

export interface ServerCapabilitiesResponse {
  lanes: Record<string, { concurrency: number; timeoutMs: number }>;
  binaries: ServerHealthMetrics['detectedBinaries'];
  maxUploadBytes?: number;
  ttlMinutes?: number;
}

export interface ServerJobResult {
  blob: Blob;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  jobRecord: ConversionJobRecord;
}

export interface ServerProgressUpdate {
  status: ConversionJobRecord['status'];
  progressPercent: number;
  stageMessage: string;
  jobRecord?: ConversionJobRecord;
}

export class ServerFallbackClient {
  private readonly baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getHealth(): Promise<ServerHealthMetrics | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/health`, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) return null;
      return (await resp.json()) as ServerHealthMetrics;
    } catch {
      return null;
    }
  }

  async getCapabilities(): Promise<ServerCapabilitiesResponse | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/capabilities`, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) return null;
      return (await resp.json()) as ServerCapabilitiesResponse;
    } catch {
      return null;
    }
  }

  async triggerSweep(): Promise<{ purgedDirs: number; freedBytes: number; message?: string } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/admin/sweep`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) return null;
      return (await resp.json()) as { purgedDirs: number; freedBytes: number; message?: string };
    } catch {
      return null;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async getJobStatus(jobId: string): Promise<ConversionJobRecord | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) return null;
      return (await resp.json()) as ConversionJobRecord;
    } catch {
      return null;
    }
  }

  async submitAndMonitorJob(params: {
    file: Blob;
    filename: string;
    sourceFormat: string;
    targetFormat: string;
    options: ConversionOptions;
    onProgress?: (update: ServerProgressUpdate) => void;
    signal?: AbortSignal;
  }): Promise<ServerJobResult> {
    const { file, filename, sourceFormat, targetFormat, options, onProgress, signal } = params;

    if (signal?.aborted) {
      throw new DOMException('Server job aborted before upload', 'AbortError');
    }

    onProgress?.({
      status: 'uploading-server',
      progressPercent: 10,
      stageMessage: `Uploading ${(file.size / 1024).toFixed(1)} KB to managed server...`,
    });

    const uploadResp = await fetch(`${this.baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'X-File-Name': encodeURIComponent(filename),
        'X-Source-Format': sourceFormat,
        'X-Target-Format': targetFormat,
        'X-Options-Json': JSON.stringify(options),
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
      signal,
    });

    if (!uploadResp.ok) {
      let errMsg = `Server rejected upload (HTTP ${uploadResp.status})`;
      try {
        const errJson = (await uploadResp.json()) as { error?: string; message?: string };
        errMsg = errJson.error || errJson.message || errMsg;
      } catch {
        // Ignore JSON parse failure
      }
      throw new Error(errMsg);
    }

    const createdJob = (await uploadResp.json()) as ConversionJobRecord;
    const jobId = createdJob.id;

    onProgress?.({
      status: createdJob.status,
      progressPercent: Math.max(20, createdJob.progressPercent ?? 20),
      stageMessage: createdJob.stageMessage || 'Queued on server lane...',
      jobRecord: createdJob,
    });

    const abortHandler = () => {
      void this.cancelJob(jobId);
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    try {
      const completedJob = await this.waitForCompletion(jobId, createdJob, onProgress, signal);

      if (signal?.aborted) {
        throw new DOMException('Server conversion cancelled', 'AbortError');
      }

      const downloadUrl =
        completedJob.downloadUrl ||
        `${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/download`;

      onProgress?.({
        status: 'processing-server',
        progressPercent: 95,
        stageMessage: 'Downloading converted artifact...',
        jobRecord: completedJob,
      });

      const dlResp = await fetch(downloadUrl, { signal });
      if (!dlResp.ok) {
        throw new Error(`Failed to download converted file (HTTP ${dlResp.status})`);
      }

      const blob = await dlResp.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const base = filename.replace(/\.[^/.]+$/, '') || 'converted';
      const outFilename = `${base}.${targetFormat}`;

      return {
        blob,
        bytes,
        mimeType: blob.type || dlResp.headers.get('content-type') || 'application/octet-stream',
        filename: outFilename,
        jobRecord: completedJob,
      };
    } finally {
      signal?.removeEventListener('abort', abortHandler);
    }
  }

  private waitForCompletion(
    jobId: string,
    initialJob: ConversionJobRecord,
    onProgress?: (update: ServerProgressUpdate) => void,
    signal?: AbortSignal,
  ): Promise<ConversionJobRecord> {
    if (initialJob.status === 'completed') return Promise.resolve(initialJob);
    if (initialJob.status === 'failed') {
      return Promise.reject(new Error(initialJob.errorMessage || 'Server conversion failed'));
    }

    return new Promise<ConversionJobRecord>((resolve, reject) => {
      let settled = false;
      let eventSource: EventSource | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        signal?.removeEventListener('abort', onAbort);
      };

      const finish = (job: ConversionJobRecord) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (job.status === 'completed') {
          resolve(job);
        } else if (job.status === 'cancelled') {
          reject(new DOMException('Server job cancelled', 'AbortError'));
        } else {
          reject(new Error(job.errorMessage || `Server job ${job.status}`));
        }
      };

      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new DOMException('Conversion cancelled by user', 'AbortError'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      const handleUpdate = (raw: string) => {
        try {
          const data = JSON.parse(raw) as ConversionJobRecord;
          onProgress?.({
            status: data.status,
            progressPercent: data.progressPercent ?? 50,
            stageMessage: data.stageMessage || 'Processing on server...',
            jobRecord: data,
          });
          if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
            finish(data);
          }
        } catch {
          // Ignore malformed SSE frame
        }
      };

      const startPolling = () => {
        if (pollTimer || settled) return;
        pollTimer = setInterval(async () => {
          if (settled) return;
          const job = await this.getJobStatus(jobId);
          if (!job) return;
          onProgress?.({
            status: job.status,
            progressPercent: job.progressPercent ?? 50,
            stageMessage: job.stageMessage || 'Processing on server...',
            jobRecord: job,
          });
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            finish(job);
          }
        }, 700);
      };

      if (typeof EventSource !== 'undefined') {
        try {
          eventSource = new EventSource(
            `${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/events`,
          );
          eventSource.onmessage = (evt) => handleUpdate(evt.data);
          const sseEvents = [
            'progress',
            'status',
            'completed',
            'failed',
            'job:updated',
            'job:progress',
            'job:completed',
            'job:failed',
          ];
          for (const evName of sseEvents) {
            eventSource.addEventListener(evName, (evt) => handleUpdate((evt as MessageEvent).data));
          }
          eventSource.onerror = () => {
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            startPolling();
          };
        } catch {
          startPolling();
        }
      } else {
        startPolling();
      }
    });
  }
}
