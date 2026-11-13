import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module'; // Used for experimental strip typescript types
import { config } from './config.ts';
import { StorageManager, StorageQuotaExceededError } from './management/storage-manager.ts';
import { JobQueueManager } from './management/job-queue.ts';
import { RateLimiter } from './security/rate-limiter.ts';
import { validateMagicBytes, verifySafeCompressionRatio } from './security/file-validator.ts';
import { AdapterRegistry } from './adapters/adapter-registry.ts';
import { processImage } from './adapters/image.adapter.ts';
import { processMedia } from './adapters/media.adapter.ts';
import { processDocument } from './adapters/document.adapter.ts';
import { processArchiveData } from './adapters/archive-data.adapter.ts';
import type { ConversionJobRecord } from '../shared/types.ts';

export class ServerApp {
  public server: http.Server;
  public storage: StorageManager;
  public queue: JobQueueManager;
  public rateLimiter: RateLimiter;
  public adapters: AdapterRegistry;

  constructor() {
    this.storage = new StorageManager();
    this.queue = new JobQueueManager();
    this.rateLimiter = new RateLimiter();
    this.adapters = new AdapterRegistry();

    this.server = http.createServer(this.handleRequest.bind(this));
    
    // Register lane processors
    this.queue.registerProcessors({
      fast: async (job, signal) => {
        await this.processJob(job, signal);
      },
      document: async (job, signal) => {
        await this.processJob(job, signal);
      },
      media: async (job, signal) => {
        await this.processJob(job, signal);
      }
    });
  }

  async start() {
    await this.storage.init();
    await this.adapters.init();
    this.storage.startSweeper();

    return new Promise<void>((resolve) => {
      this.server.listen(config.PORT, config.HOST, () => {
        console.log(`Server listening on http://${config.HOST}:${config.PORT}`);
        resolve();
      });
    });
  }

  async stop() {
    this.storage.stopSweeper();
    return new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async processJob(job: ConversionJobRecord, signal: AbortSignal) {
    const jobWorkspace = path.join(config.SCRATCH_DIR, job.id);
    const inputDir = path.join(jobWorkspace, 'input');
    const outputDir = path.join(jobWorkspace, 'output');
    
    const capabilities = this.adapters.getCapabilities();
    
    let outputPath: string;
    
    const onProgress = (percent: number, message: string) => {
      this.queue.updateJobProgress(job.id, percent, message);
    };

    switch (job.routing.serverLane) {
      case 'fast':
        outputPath = await processArchiveData(job, inputDir, outputDir, capabilities, signal, onProgress);
        break;
      case 'document':
        outputPath = await processDocument(job, inputDir, outputDir, capabilities, signal, onProgress);
        break;
      case 'media':
        // Depending on category, route to image or media
        if (job.sourceFormat === 'jpg' || job.sourceFormat === 'png' || job.sourceFormat === 'webp') {
          outputPath = await processImage(job, inputDir, outputDir, capabilities, signal, onProgress);
        } else {
          outputPath = await processMedia(job, inputDir, outputDir, capabilities, signal, onProgress);
        }
        break;
      default:
        throw new Error(`Unknown server lane: ${job.routing.serverLane}`);
    }

    const stat = await fs.stat(outputPath);
    this.queue.updateJobStatus(job.id, 'completed', { outputBytes: stat.size });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const { method, url } = req;
    if (!url) {
      res.statusCode = 400;
      res.end();
      return;
    }
    
    const ip = req.socket.remoteAddress || 'unknown';
    const limit = this.rateLimiter.checkRateLimit(ip);
    if (!limit.allowed) {
      res.statusCode = 429;
      res.setHeader('X-RateLimit-Reset', limit.resetAt);
      res.end('Rate limit exceeded');
      return;
    }

    // Set CORS and Isolation Headers
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    try {
      if (method === 'GET' && url === '/api/v1/health') {
        return this.handleHealth(req, res);
      }
      
      if (method === 'GET' && url === '/api/v1/capabilities') {
        return this.handleCapabilities(req, res);
      }
      
      if (method === 'POST' && url === '/api/v1/jobs') {
        return await this.handleCreateJob(req, res, ip);
      }
      
      if (method === 'GET' && url === '/api/v1/jobs') {
        return this.handleListJobs(req, res);
      }
      
      if (method === 'GET' && url.match(/^\/api\/v1\/jobs\/([^\/]+)$/)) {
        const id = url.match(/^\/api\/v1\/jobs\/([^\/]+)$/)![1];
        return this.handleGetJob(req, res, id);
      }
      
      if (method === 'GET' && url.match(/^\/api\/v1\/jobs\/([^\/]+)\/events$/)) {
        const id = url.match(/^\/api\/v1\/jobs\/([^\/]+)\/events$/)![1];
        return this.handleJobEvents(req, res, id);
      }
      
      if (method === 'GET' && url.match(/^\/api\/v1\/jobs\/([^\/]+)\/download$/)) {
        const id = url.match(/^\/api\/v1\/jobs\/([^\/]+)\/download$/)![1];
        return await this.handleDownloadJob(req, res, id);
      }
      
      if (method === 'DELETE' && url.match(/^\/api\/v1\/jobs\/([^\/]+)$/)) {
        const id = url.match(/^\/api\/v1\/jobs\/([^\/]+)$/)![1];
        return await this.handleDeleteJob(req, res, id);
      }

      if (method === 'POST' && url === '/api/v1/admin/sweep') {
        const result = await this.storage.sweepNow();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
        return;
      }

      // Static serving fallback (for testing/client loading)
      if (method === 'GET') {
        await this.handleStatic(req, res, url);
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
    } catch (err: any) {
      console.error(err);
      res.statusCode = err instanceof StorageQuotaExceededError ? 507 : 500;
      res.end(err.message || 'Internal Server Error');
    }
  }

  private handleHealth(req: http.IncomingMessage, res: http.ServerResponse) {
    const qMetrics = this.queue.getMetrics();
    const sMetrics = this.storage.getMetrics();
    
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: sMetrics.usagePercent > 90 ? 'degraded' : 'ok',
      uptimeSeconds: process.uptime(),
      activeJobsByLane: qMetrics.activeJobsByLane,
      queuedJobsByLane: qMetrics.queuedJobsByLane,
      laneConcurrencyLimits: qMetrics.laneConcurrencyLimits,
      totalCompletedJobs: qMetrics.totalCompletedJobs,
      totalFailedJobs: qMetrics.totalFailedJobs,
      storage: sMetrics,
      detectedBinaries: this.adapters.getCapabilities()
    }));
  }
  
  private handleCapabilities(req: http.IncomingMessage, res: http.ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      capabilities: this.adapters.getCapabilities(),
      laneLimits: config.LANE_CONCURRENCY
    }));
  }

  private async handleCreateJob(req: http.IncomingMessage, res: http.ServerResponse, ip: string) {
    const fileNameHeader = req.headers['x-file-name'] as string || 'unnamed';
    const sourceFormat = req.headers['x-source-format'] as string || 'bin';
    const targetFormat = req.headers['x-target-format'] as string || 'bin';
    const optionsStr = req.headers['x-options-json'] as string || '{}';
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > config.MAX_UPLOAD_BYTES) {
      res.statusCode = 413;
      res.end('Payload too large');
      return;
    }
    
    const options = JSON.parse(optionsStr);
    const id = crypto.randomUUID();
    const sanitizedFilename = this.storage.sanitizeFilename(fileNameHeader);
    
    // Allocate storage (can throw 507)
    const { inputDir } = await this.storage.allocateJobWorkspace(id, contentLength);
    
    const inputPath = path.join(inputDir, sanitizedFilename);
    const writeStream = createWriteStream(inputPath);
    
    // In-memory magic byte validation for first chunk
    let firstChunk = true;
    let validating = false;
    let ended = false;
    
    req.on('data', (chunk) => {
      if (firstChunk) {
        firstChunk = false;
        validating = true;
        req.pause();
        validateMagicBytes(chunk).then(({ isValid, reason }) => {
          validating = false;
          if (!isValid) {
            writeStream.destroy();
            req.destroy(new Error(reason));
            return;
          }
          if (!writeStream.destroyed) {
            writeStream.write(chunk);
          }
          if (ended && !writeStream.destroyed) {
            writeStream.end();
          } else {
            req.resume();
          }
        }).catch(err => {
          validating = false;
          writeStream.destroy();
          req.destroy(err);
        });
        return;
      }
      if (!writeStream.destroyed) {
        writeStream.write(chunk);
      }
    });
    
    req.on('end', () => {
      ended = true;
      if (!validating && !writeStream.destroyed) {
        writeStream.end();
      }
    });
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      req.on('error', reject);
    });

    const docFormats = ['pdf', 'docx', 'doc', 'odt', 'rtf', 'pptx', 'odp', 'xlsx', 'ods', 'epub', 'mobi', 'azw3', 'latex'];
    const mediaFormats = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'ico', 'tiff', 'svg', 'mp4', 'webm', 'mkv', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus'];
    const resolvedLane =
      docFormats.includes(sourceFormat) || targetFormat === 'pdf' || targetFormat === 'docx'
        ? 'document'
        : mediaFormats.includes(sourceFormat) || mediaFormats.includes(targetFormat)
          ? 'media'
          : 'fast';

    const job: ConversionJobRecord = {
      id,
      originalFilename: fileNameHeader,
      sanitizedFilename,
      inputBytes: contentLength,
      sourceFormat,
      targetFormat,
      options,
      routing: {
        sourceFormat, targetFormat, selectedTier: 'SERVER_FALLBACK', selectedEngine: 'server-data-engine',
        isLocal: false, requiresUpload: true, fallbackTier: null, fallbackEngine: null,
        estimatedPeakMemoryMB: 100,
        serverLane: resolvedLane,
        reason: 'API trigger', warnings: []
      },
      status: 'queued-server',
      progressPercent: 0,
      stageMessage: 'Queued',
      createdAt: Date.now()
    };
    
    this.queue.enqueue(job);
    
    res.statusCode = 202;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(job));
  }
  
  private handleListJobs(req: http.IncomingMessage, res: http.ServerResponse) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(this.queue.getAllJobs()));
  }
  
  private handleGetJob(req: http.IncomingMessage, res: http.ServerResponse, id: string) {
    const job = this.queue.getJob(id);
    if (!job) {
      res.statusCode = 404;
      res.end('Job not found');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(job));
  }
  
  private handleJobEvents(req: http.IncomingMessage, res: http.ServerResponse, id: string) {
    const job = this.queue.getJob(id);
    if (!job) {
      res.statusCode = 404;
      res.end('Job not found');
      return;
    }
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    
    sendEvent('job:updated', job);
    
    const onUpdated = (j: ConversionJobRecord) => {
      if (j.id === id) sendEvent('job:updated', j);
    };
    const onProgress = (j: ConversionJobRecord) => {
      if (j.id === id) sendEvent('job:progress', j);
    };
    const onCompleted = (j: ConversionJobRecord) => {
      if (j.id === id) { sendEvent('job:completed', j); res.end(); }
    };
    const onFailed = (j: ConversionJobRecord) => {
      if (j.id === id) { sendEvent('job:failed', j); res.end(); }
    };

    this.queue.on('job:updated', onUpdated);
    this.queue.on('job:progress', onProgress);
    this.queue.on('job:completed', onCompleted);
    this.queue.on('job:failed', onFailed);
    
    req.on('close', () => {
      this.queue.off('job:updated', onUpdated);
      this.queue.off('job:progress', onProgress);
      this.queue.off('job:completed', onCompleted);
      this.queue.off('job:failed', onFailed);
    });
  }
  
  private async handleDownloadJob(req: http.IncomingMessage, res: http.ServerResponse, id: string) {
    const job = this.queue.getJob(id);
    if (!job || job.status !== 'completed') {
      res.statusCode = 404;
      res.end('Job not completed or not found');
      return;
    }
    
    const outputDir = path.join(config.SCRATCH_DIR, id, 'output');
    try {
      const files = await fs.readdir(outputDir);
      if (files.length === 0) throw new Error('No output files');
      
      const filePath = path.join(outputDir, files[0]);
      const stat = await fs.stat(filePath);
      
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`);
      
      const readStream = createReadStream(filePath);
      readStream.pipe(res);
      
      readStream.on('end', async () => {
        if (job.options.autoDeleteServerFile) {
          await this.storage.deleteJobWorkspace(id);
        }
      });
    } catch (err) {
      res.statusCode = 404;
      res.end('File not found');
    }
  }

  private async handleDeleteJob(req: http.IncomingMessage, res: http.ServerResponse, id: string) {
    this.queue.cancelJob(id);
    await this.storage.deleteJobWorkspace(id);
    res.statusCode = 204;
    res.end();
  }
  
  private async handleStatic(req: http.IncomingMessage, res: http.ServerResponse, urlPath: string) {
    const cleanUrl = urlPath.split('?')[0];
    const root = path.resolve(import.meta.dirname, '..', '..');
    let relPath = cleanUrl === '/' || cleanUrl === '/index.html'
      ? 'src/client/index.html'
      : cleanUrl === '/architecture'
        ? 'docs/architecture-preview.html'
        : cleanUrl.replace(/^\/+/, '');
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(root, safePath);
    if (!fullPath.startsWith(root)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    try {
      let content = await fs.readFile(fullPath);
      const ext = path.extname(fullPath).toLowerCase();

      if (ext === '.ts') {
        const text = content.toString('utf-8');
        try {
          if (typeof stripTypeScriptTypes === 'function') {
            content = Buffer.from(stripTypeScriptTypes(text));
          }
        } catch {
          // keep original if strip fails
        }
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (ext === '.js' || ext === '.mjs') {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (ext === '.css') {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      } else if (ext === '.html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      } else if (ext === '.json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      } else if (ext === '.svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }

      res.end(content);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const app = new ServerApp();
  app.start().catch((err) => {
    console.error('Failed to start OmniConvert server:', err);
    process.exit(1);
  });
}
