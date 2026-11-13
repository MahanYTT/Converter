import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerApp } from '../../src/server/index.ts';
import fs from 'node:fs/promises';
import { config } from '../../src/server/config.ts';
import path from 'node:path';
import { validateMagicBytes, verifySafeCompressionRatio } from '../../src/server/security/file-validator.ts';
import { StorageManager, StorageQuotaExceededError } from '../../src/server/management/storage-manager.ts';
import { JobQueueManager } from '../../src/server/management/job-queue.ts';

test('Server Engine Suite', async (t) => {
  await t.test('StorageManager - Directory Isolation and Filename Sanitization', async () => {
    const sm = new StorageManager();
    const cleanName = sm.sanitizeFilename('../../../etc/passwd');
    assert.equal(cleanName, 'passwd');
    
    const cleanName2 = sm.sanitizeFilename('valid-file.png');
    assert.equal(cleanName2, 'valid-file.png');
  });
  
  await t.test('StorageManager - Quota limits', async () => {
    const sm = new StorageManager();
    await sm.init();
    
    await assert.rejects(
      async () => await sm.allocateJobWorkspace('toolarge', config.MAX_SCRATCH_QUOTA_BYTES + 1024),
      StorageQuotaExceededError
    );
  });
  
  await t.test('JobQueueManager - Priority Lanes and Cancel', async () => {
    const qm = new JobQueueManager();
    let processed = 0;
    
    qm.registerProcessors({
      fast: async (job, signal) => { processed++; },
      document: async (job, signal) => {},
      media: async (job, signal) => {}
    });
    
    qm.enqueue({
      id: 'job1', originalFilename: 'test.txt', sanitizedFilename: 'test.txt', inputBytes: 10,
      sourceFormat: 'txt', targetFormat: 'csv', options: {}, 
      routing: { sourceFormat: 'txt', targetFormat: 'csv', selectedTier: 'SERVER_FALLBACK', selectedEngine: 'server-data-engine', isLocal: false, requiresUpload: true, fallbackTier: null, fallbackEngine: null, estimatedPeakMemoryMB: 10, serverLane: 'fast', reason: '', warnings: [] },
      status: 'pending', progressPercent: 0, stageMessage: '', createdAt: Date.now()
    });
    
    // Simulate processQueue tick
    await new Promise(r => setTimeout(r, 50));
    assert.equal(processed, 1);
    
    // Test cancel
    qm.enqueue({
      id: 'job2', originalFilename: 'test.txt', sanitizedFilename: 'test.txt', inputBytes: 10,
      sourceFormat: 'txt', targetFormat: 'csv', options: {}, 
      routing: { sourceFormat: 'txt', targetFormat: 'csv', selectedTier: 'SERVER_FALLBACK', selectedEngine: 'server-data-engine', isLocal: false, requiresUpload: true, fallbackTier: null, fallbackEngine: null, estimatedPeakMemoryMB: 10, serverLane: 'document', reason: '', warnings: [] },
      status: 'pending', progressPercent: 0, stageMessage: '', createdAt: Date.now()
    });
    
    qm.cancelJob('job2');
    const job2 = qm.getJob('job2');
    assert.equal(job2?.status, 'cancelled');
  });

  await t.test('Security - File Validator', async () => {
    const mzExe = Buffer.from([0x4D, 0x5A, 0x90, 0x00]);
    const mzResult = await validateMagicBytes(mzExe);
    assert.equal(mzResult.isValid, false);

    const txtFile = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    const txtResult = await validateMagicBytes(txtFile);
    assert.equal(txtResult.isValid, true);
    
    const zipBombSafe = verifySafeCompressionRatio(100, 10000, 100);
    assert.equal(zipBombSafe, true);
    
    const zipBombUnsafe = verifySafeCompressionRatio(100, 10001, 100);
    assert.equal(zipBombUnsafe, false);
  });
  
  await t.test('Integration - HTTP API', async () => {
    const app = new ServerApp();
    await app.start();
    
    const healthRes = await fetch(`http://${config.HOST}:${config.PORT}/api/v1/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');
    
    // Mock a file upload
    const uploadRes = await fetch(`http://${config.HOST}:${config.PORT}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'x-file-name': 'test.txt',
        'x-source-format': 'txt',
        'x-target-format': 'csv',
        'x-options-json': '{}',
        'content-length': '11',
      },
      body: 'hello world'
    });
    assert.equal(uploadRes.status, 202);
    const job = await uploadRes.json();
    assert.ok(job.id);
    
    // Check job status
    let completed = false;
    for (let i = 0; i < 20; i++) {
      const statusRes = await fetch(`http://${config.HOST}:${config.PORT}/api/v1/jobs/${job.id}`);
      const statusData = await statusRes.json();
      if (statusData.status === 'completed') {
        completed = true;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    assert.equal(completed, true);
    
    // Download
    const dlRes = await fetch(`http://${config.HOST}:${config.PORT}/api/v1/jobs/${job.id}/download`);
    assert.equal(dlRes.status, 200);
    const text = await dlRes.text();
    assert.equal(text, 'hello world'); // Our mock pure-node archive-data adapter just copies text for unknown format
    
    await app.stop();
  });
});
