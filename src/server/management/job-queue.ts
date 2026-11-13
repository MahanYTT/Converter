import { EventEmitter } from 'node:events';
import { config } from '../config.ts';
import type { ConversionJobRecord, ServerQueueLane, JobStatus } from '../../shared/types.ts';

export class JobQueueManager extends EventEmitter {
  private queues: Record<ServerQueueLane, ConversionJobRecord[]> = {
    fast: [],
    document: [],
    media: []
  };
  
  private activeWorkers: Record<ServerQueueLane, number> = {
    fast: 0,
    document: 0,
    media: 0
  };

  private abortControllers: Map<string, AbortController> = new Map();
  private jobs: Map<string, ConversionJobRecord> = new Map();
  private processors: Record<ServerQueueLane, (job: ConversionJobRecord, signal: AbortSignal) => Promise<void>> | null = null;

  registerProcessors(processors: Record<ServerQueueLane, (job: ConversionJobRecord, signal: AbortSignal) => Promise<void>>) {
    this.processors = processors;
  }

  enqueue(job: ConversionJobRecord) {
    this.jobs.set(job.id, job);
    this.updateJobStatus(job.id, 'queued-server');
    this.queues[job.routing.serverLane].push(job);
    this.processQueue(job.routing.serverLane);
  }

  getJob(jobId: string): ConversionJobRecord | undefined {
    return this.jobs.get(jobId);
  }
  
  getAllJobs(): ConversionJobRecord[] {
    return Array.from(this.jobs.values());
  }

  cancelJob(jobId: string) {
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort();
    }
    
    const job = this.jobs.get(jobId);
    if (job) {
      if (job.status === 'queued-server') {
        for (const lane of Object.keys(this.queues) as ServerQueueLane[]) {
          const idx = this.queues[lane].findIndex(j => j.id === jobId);
          if (idx !== -1) {
            this.queues[lane].splice(idx, 1);
            break;
          }
        }
        this.updateJobStatus(jobId, 'cancelled');
      } else if (job.status === 'processing-server') {
        this.updateJobStatus(jobId, 'cancelled');
      }
    }
  }

  updateJobStatus(jobId: string, status: JobStatus, updates: Partial<ConversionJobRecord> = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    Object.assign(job, { status, ...updates });
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      if (!job.completedAt) job.completedAt = Date.now();
      this.abortControllers.delete(jobId);
    } else if (status === 'processing-server') {
      if (!job.startedAt) job.startedAt = Date.now();
    }
    
    this.emit(`job:updated`, job);
    if (status === 'completed') this.emit('job:completed', job);
    if (status === 'failed') this.emit('job:failed', job);
  }

  updateJobProgress(jobId: string, progressPercent: number, stageMessage: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.progressPercent = progressPercent;
    job.stageMessage = stageMessage;
    
    this.emit(`job:progress`, job);
  }

  private async processQueue(lane: ServerQueueLane) {
    if (!this.processors) return;
    
    if (this.activeWorkers[lane] >= config.LANE_CONCURRENCY[lane]) {
      return;
    }

    const job = this.queues[lane].shift();
    if (!job) return;

    this.activeWorkers[lane]++;
    const controller = new AbortController();
    this.abortControllers.set(job.id, controller);
    this.updateJobStatus(job.id, 'processing-server');

    try {
      const timeoutId = setTimeout(() => {
        controller.abort(new Error('Job timeout exceeded'));
      }, config.LANE_TIMEOUT_MS[lane]);

      await this.processors[lane](job, controller.signal);
      clearTimeout(timeoutId);
      
      // If the job wasn't already marked as completed/failed by the processor
      const currentJob = this.jobs.get(job.id);
      if (currentJob && currentJob.status === 'processing-server') {
        this.updateJobStatus(job.id, 'completed', { progressPercent: 100, stageMessage: 'Done' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        this.updateJobStatus(job.id, 'cancelled', { errorMessage: err.message || 'Job cancelled' });
      } else {
        this.updateJobStatus(job.id, 'failed', { errorMessage: err.message });
      }
    } finally {
      this.activeWorkers[lane]--;
      this.processQueue(lane); // Process next
    }
  }

  getMetrics() {
    return {
      activeJobsByLane: { ...this.activeWorkers },
      queuedJobsByLane: {
        fast: this.queues.fast.length,
        document: this.queues.document.length,
        media: this.queues.media.length,
      },
      laneConcurrencyLimits: { ...config.LANE_CONCURRENCY },
      totalCompletedJobs: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      totalFailedJobs: Array.from(this.jobs.values()).filter(j => j.status === 'failed' || j.status === 'cancelled').length,
    };
  }
}
