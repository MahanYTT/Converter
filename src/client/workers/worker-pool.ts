export const WASM_HIGH_WATER_MARK_BYTES = 512 * 1024 * 1024; // 512 MB

export interface WorkerPoolTaskContext {
  slotId: number;
  signal: AbortSignal;
  reportProgress: (percent: number, stageMessage: string) => void;
  registerWorker: (worker: Worker) => void;
}

export interface WorkerPoolStats {
  maxWorkers: number;
  activeCount: number;
  queuedCount: number;
  totalJobsProcessed: number;
  totalBytesProcessed: number;
  recycledWorkersCount: number;
  highWaterMarkBytes: number;
  slots: Array<{
    slotId: number;
    busy: boolean;
    cumulativeBytes: number;
    jobsRun: number;
    isHeavyWasm: boolean;
  }>;
}

interface WorkerSlotState {
  slotId: number;
  busy: boolean;
  cumulativeBytes: number;
  jobsRun: number;
  isHeavyWasm: boolean;
  activeWorker: Worker | null;
  activeAbortController: AbortController | null;
}

interface QueuedJob<T> {
  id: string;
  inputBytes: number;
  isHeavyWasm: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, stageMessage: string) => void;
  executor: (ctx: WorkerPoolTaskContext) => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export function clampWorkerConcurrency(hardwareConcurrency: number): number {
  const cores = Number.isFinite(hardwareConcurrency) && hardwareConcurrency > 0 ? hardwareConcurrency : 4;
  return Math.max(1, Math.min(4, Math.floor(cores) - 1));
}

export class WorkerPool {
  readonly maxWorkers: number;
  readonly highWaterMarkBytes: number;
  private readonly slots: WorkerSlotState[];
  private readonly queue: QueuedJob<unknown>[] = [];
  private totalJobsProcessed = 0;
  private totalBytesProcessed = 0;
  private recycledWorkersCount = 0;
  private readonly listeners = new Set<(stats: WorkerPoolStats) => void>();

  constructor(
    hardwareConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4,
    highWaterMarkBytes = WASM_HIGH_WATER_MARK_BYTES,
  ) {
    this.maxWorkers = clampWorkerConcurrency(hardwareConcurrency);
    this.highWaterMarkBytes = highWaterMarkBytes;
    this.slots = Array.from({ length: this.maxWorkers }, (_, idx) => ({
      slotId: idx + 1,
      busy: false,
      cumulativeBytes: 0,
      jobsRun: 0,
      isHeavyWasm: false,
      activeWorker: null,
      activeAbortController: null,
    }));
  }

  subscribe(listener: (stats: WorkerPoolStats) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getStats();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  getStats(): WorkerPoolStats {
    return {
      maxWorkers: this.maxWorkers,
      activeCount: this.slots.filter((s) => s.busy).length,
      queuedCount: this.queue.length,
      totalJobsProcessed: this.totalJobsProcessed,
      totalBytesProcessed: this.totalBytesProcessed,
      recycledWorkersCount: this.recycledWorkersCount,
      highWaterMarkBytes: this.highWaterMarkBytes,
      slots: this.slots.map((s) => ({
        slotId: s.slotId,
        busy: s.busy,
        cumulativeBytes: s.cumulativeBytes,
        jobsRun: s.jobsRun,
        isHeavyWasm: s.isHeavyWasm,
      })),
    };
  }

  enqueue<T>(params: {
    id: string;
    inputBytes: number;
    isHeavyWasm?: boolean;
    signal?: AbortSignal;
    onProgress?: (percent: number, stageMessage: string) => void;
    executor: (ctx: WorkerPoolTaskContext) => Promise<T>;
  }): Promise<T> {
    if (params.signal?.aborted) {
      return Promise.reject(new DOMException('Conversion aborted by user', 'AbortError'));
    }

    return new Promise<T>((resolve, reject) => {
      const job: QueuedJob<T> = {
        id: params.id,
        inputBytes: params.inputBytes,
        isHeavyWasm: Boolean(params.isHeavyWasm),
        signal: params.signal,
        onProgress: params.onProgress,
        executor: params.executor,
        resolve,
        reject,
      };

      if (params.signal) {
        const onAbort = () => {
          const queueIndex = this.queue.indexOf(job as QueuedJob<unknown>);
          if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
            this.notify();
            reject(new DOMException('Queued conversion cancelled', 'AbortError'));
          }
        };
        params.signal.addEventListener('abort', onAbort, { once: true });
      }

      this.queue.push(job as QueuedJob<unknown>);
      this.notify();
      this.pump();
    });
  }

  private pump(): void {
    while (this.queue.length > 0) {
      const freeSlot = this.slots.find((s) => !s.busy);
      if (!freeSlot) return;

      const job = this.queue.shift();
      if (!job) return;

      if (job.signal?.aborted) {
        job.reject(new DOMException('Conversion aborted by user', 'AbortError'));
        continue;
      }

      void this.runInSlot(freeSlot, job);
    }
  }

  private async runInSlot(slot: WorkerSlotState, job: QueuedJob<unknown>): Promise<void> {
    slot.busy = true;
    slot.isHeavyWasm = job.isHeavyWasm;

    const localController = new AbortController();
    slot.activeAbortController = localController;

    const onExternalAbort = () => {
      localController.abort();
      if (slot.activeWorker) {
        try {
          slot.activeWorker.terminate();
        } catch {
          // Ignore worker termination errors
        }
        slot.activeWorker = null;
        this.recycledWorkersCount++;
      }
    };

    if (job.signal) {
      job.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    this.notify();

    try {
      const result = await job.executor({
        slotId: slot.slotId,
        signal: localController.signal,
        reportProgress: (percent, stageMessage) => {
          if (!localController.signal.aborted) {
            job.onProgress?.(percent, stageMessage);
          }
        },
        registerWorker: (worker) => {
          slot.activeWorker = worker;
        },
      });

      if (localController.signal.aborted) {
        throw new DOMException('Conversion cancelled', 'AbortError');
      }

      slot.cumulativeBytes += job.inputBytes;
      slot.jobsRun += 1;
      this.totalJobsProcessed += 1;
      this.totalBytesProcessed += job.inputBytes;

      // Recycle heavy WASM workers once cumulative bytes processed crosses the 512 MB high-water mark
      if (slot.cumulativeBytes >= this.highWaterMarkBytes) {
        this.recycleSlot(slot);
      }

      job.resolve(result);
    } catch (err) {
      if (slot.activeWorker) {
        this.recycleSlot(slot);
      }
      job.reject(err);
    } finally {
      if (job.signal) {
        job.signal.removeEventListener('abort', onExternalAbort);
      }
      slot.busy = false;
      slot.activeAbortController = null;
      this.notify();
      this.pump();
    }
  }

  recycleSlot(slot: WorkerSlotState): void {
    if (slot.activeWorker) {
      try {
        slot.activeWorker.terminate();
      } catch {
        // Ignore termination failure
      }
      slot.activeWorker = null;
    }
    slot.cumulativeBytes = 0;
    slot.isHeavyWasm = false;
    this.recycledWorkersCount += 1;
  }

  recycleAllHeavyWorkers(): void {
    for (const slot of this.slots) {
      if (!slot.busy && (slot.cumulativeBytes > 0 || slot.activeWorker)) {
        this.recycleSlot(slot);
      }
    }
    this.notify();
  }
}
