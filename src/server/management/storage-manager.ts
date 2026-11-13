import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.ts';

export class StorageQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaExceededError';
  }
}

export class StorageManager {
  private usedBytes = 0;
  private activeJobDirs = 0;
  private totalPurgedDirs = 0;
  private lastSweepAt = Date.now();
  private sweeperInterval: NodeJS.Timeout | null = null;

  async init() {
    await fs.mkdir(config.SCRATCH_DIR, { recursive: true });
    await this.recalculateQuota();
  }

  startSweeper() {
    if (this.sweeperInterval) return;
    this.sweeperInterval = setInterval(() => {
      this.sweepNow().catch(console.error);
    }, config.SWEEP_INTERVAL_MS);
  }

  stopSweeper() {
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
      this.sweeperInterval = null;
    }
  }

  async sweepNow() {
    this.lastSweepAt = Date.now();
    const now = Date.now();
    let purged = 0;

    try {
      const dirs = await fs.readdir(config.SCRATCH_DIR, { withFileTypes: true });
      for (const dirent of dirs) {
        if (!dirent.isDirectory()) continue;
        const jobDir = path.join(config.SCRATCH_DIR, dirent.name);
        try {
          const stats = await fs.stat(jobDir);
          if (now - stats.mtimeMs > config.JOB_TTL_MS) {
            await fs.rm(jobDir, { recursive: true, force: true });
            purged++;
          }
        } catch (e) {
          // Ignore stats/rm errors for individual dirs
        }
      }
    } catch (e) {
      // Ignore readdir errors if dir doesn't exist
    }

    if (purged > 0) {
      this.totalPurgedDirs += purged;
      await this.recalculateQuota();
    }
    
    return { purged };
  }

  async allocateJobWorkspace(jobId: string, expectedBytes: number) {
    if (this.usedBytes + expectedBytes > config.MAX_SCRATCH_QUOTA_BYTES) {
      await this.sweepNow(); // immediate sweep
      if (this.usedBytes + expectedBytes > config.MAX_SCRATCH_QUOTA_BYTES) {
        throw new StorageQuotaExceededError('Server storage quota exceeded');
      }
    }

    const jobDir = path.join(config.SCRATCH_DIR, jobId);
    const inputDir = path.join(jobDir, 'input');
    const outputDir = path.join(jobDir, 'output');

    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    this.activeJobDirs++;
    this.usedBytes += expectedBytes;

    return { jobDir, inputDir, outputDir };
  }

  async deleteJobWorkspace(jobId: string) {
    const jobDir = path.join(config.SCRATCH_DIR, jobId);
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
      await this.recalculateQuota();
    } catch (e) {
      // Ignore
    }
  }

  sanitizeFilename(filename: string): string {
    const base = filename.replace(/^.*[\/\\]/, '');
    const sanitized = base
      .replace(/[\/\?<>\\:\*\|":\x00-\x1F\x80-\x9F]/g, '_')
      .replace(/^\.+/, '')
      .replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i, 'reserved')
      .trim();
    return sanitized || 'unnamed_file';
  }

  private async recalculateQuota() {
    try {
      const { size, count } = await this.getDirectorySize(config.SCRATCH_DIR);
      this.usedBytes = size;
      this.activeJobDirs = count;
    } catch (e) {
      this.usedBytes = 0;
      this.activeJobDirs = 0;
    }
  }

  private async getDirectorySize(dirPath: string): Promise<{ size: number; count: number }> {
    let totalSize = 0;
    let count = 0;
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          const { size } = await this.getDirectorySize(fullPath);
          totalSize += size;
          count++;
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (e) {
      // ignore
    }
    return { size: totalSize, count };
  }

  getMetrics() {
    return {
      scratchDir: config.SCRATCH_DIR,
      activeJobDirs: this.activeJobDirs,
      usedBytes: this.usedBytes,
      maxQuotaBytes: config.MAX_SCRATCH_QUOTA_BYTES,
      usagePercent: (this.usedBytes / config.MAX_SCRATCH_QUOTA_BYTES) * 100,
      ttlMinutes: config.JOB_TTL_MS / 60000,
      lastSweepAt: this.lastSweepAt,
      totalPurgedDirs: this.totalPurgedDirs,
    };
  }
}
