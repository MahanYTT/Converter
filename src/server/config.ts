import path from 'node:path';
import os from 'node:os';

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  HOST: process.env.HOST || '0.0.0.0',
  SCRATCH_DIR: process.env.SCRATCH_DIR || path.join(os.tmpdir(), 'omniconvert', 'jobs'),
  JOB_TTL_MS: process.env.JOB_TTL_MS ? parseInt(process.env.JOB_TTL_MS, 10) : 15 * 60 * 1000,
  SWEEP_INTERVAL_MS: process.env.SWEEP_INTERVAL_MS ? parseInt(process.env.SWEEP_INTERVAL_MS, 10) : 60 * 1000,
  MAX_SCRATCH_QUOTA_BYTES: process.env.MAX_SCRATCH_QUOTA_BYTES ? parseInt(process.env.MAX_SCRATCH_QUOTA_BYTES, 10) : 2 * 1024 * 1024 * 1024,
  MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES ? parseInt(process.env.MAX_UPLOAD_BYTES, 10) : 500 * 1024 * 1024,
  LANE_CONCURRENCY: {
    fast: process.env.LANE_CONCURRENCY_FAST ? parseInt(process.env.LANE_CONCURRENCY_FAST, 10) : 6,
    document: process.env.LANE_CONCURRENCY_DOCUMENT ? parseInt(process.env.LANE_CONCURRENCY_DOCUMENT, 10) : 2,
    media: process.env.LANE_CONCURRENCY_MEDIA ? parseInt(process.env.LANE_CONCURRENCY_MEDIA, 10) : 2,
  },
  LANE_TIMEOUT_MS: {
    fast: process.env.LANE_TIMEOUT_FAST ? parseInt(process.env.LANE_TIMEOUT_FAST, 10) : 30_000,
    document: process.env.LANE_TIMEOUT_DOCUMENT ? parseInt(process.env.LANE_TIMEOUT_DOCUMENT, 10) : 120_000,
    media: process.env.LANE_TIMEOUT_MEDIA ? parseInt(process.env.LANE_TIMEOUT_MEDIA, 10) : 600_000,
  },
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) : 60_000,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) : 120,
} as const;
