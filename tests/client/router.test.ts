import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConversionRouter } from '../../src/client/router/conversion-router.ts';
import { DeviceProfiler } from '../../src/client/router/device-profiler.ts';
import { inspectFileMagicBytes } from '../../src/client/router/format-catalog.ts';
import {
  convertStructuredDataText,
  createZipArchive,
  encodeChannelsToWav,
  encodeImageDataToBmp,
  encodePngToIco,
  extractFirstFromZip,
  generateTextPdf,
} from '../../src/client/workers/local-engines.ts';
import { WorkerPool, clampWorkerConcurrency } from '../../src/client/workers/worker-pool.ts';

const MB = 1024 * 1024;

describe('DeviceProfiler', () => {
  it('applies sane defaults and computes safeBrowserMemoryCapMB', () => {
    const profile = DeviceProfiler.detectSync({
      hardwareConcurrency: undefined,
      deviceMemoryGB: undefined,
    });
    assert.ok(profile.hardwareConcurrency >= 1);
    assert.ok(profile.deviceMemoryGB >= 1);
    assert.equal(
      profile.safeBrowserMemoryCapMB,
      DeviceProfiler.computeSafeMemoryCapMB(profile.deviceMemoryGB),
    );
  });

  it('clamps safeBrowserMemoryCapMB between 256 MB and 1536 MB', () => {
    assert.equal(DeviceProfiler.computeSafeMemoryCapMB(1), 256);
    assert.equal(DeviceProfiler.computeSafeMemoryCapMB(2), 440);
    assert.equal(DeviceProfiler.computeSafeMemoryCapMB(4), 880);
    assert.equal(DeviceProfiler.computeSafeMemoryCapMB(8), 1536);
    assert.equal(DeviceProfiler.computeSafeMemoryCapMB(32), 1536);
  });
});

describe('ConversionRouter', () => {
  const router = new ConversionRouter();

  const capableDevice = DeviceProfiler.detectSync({
    hardwareConcurrency: 8,
    deviceMemoryGB: 8,
    crossOriginIsolated: true,
    supportsOffscreenCanvas: true,
    supportsWebAudio: true,
    supportsCompressionStream: true,
    supportsWebCodecs: true,
    supportsOPFS: true,
    supportedCanvasEncodeMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
  });

  it('routes local native image conversion (png -> webp) to LOCAL_NATIVE', () => {
    const decision = router.route(
      { name: 'photo.png', sizeBytes: 4 * MB },
      'png',
      'webp',
      {},
      capableDevice,
    );
    assert.equal(decision.selectedTier, 'LOCAL_NATIVE');
    assert.equal(decision.selectedEngine, 'canvas-2d');
    assert.equal(decision.isLocal, true);
    assert.equal(decision.requiresUpload, false);
    assert.equal(decision.fallbackTier, 'SERVER_FALLBACK');
  });

  it('routes local native audio conversion (mp3 -> wav) to LOCAL_NATIVE', () => {
    const decision = router.route(
      { name: 'track.mp3', sizeBytes: 10 * MB },
      'mp3',
      'wav',
      {},
      capableDevice,
    );
    assert.equal(decision.selectedTier, 'LOCAL_NATIVE');
    assert.equal(decision.selectedEngine, 'web-audio-pcm');
    assert.equal(decision.isLocal, true);
  });

  it('routes pure JS data & PDF pairs (csv -> json, md -> pdf) to LOCAL_PURE_JS', () => {
    const dataDecision = router.route(
      { name: 'dataset.csv', sizeBytes: 2 * MB },
      'csv',
      'json',
      {},
      capableDevice,
    );
    assert.equal(dataDecision.selectedTier, 'LOCAL_PURE_JS');
    assert.equal(dataDecision.selectedEngine, 'pure-data-tabular');
    assert.equal(dataDecision.isLocal, true);

    const pdfDecision = router.route(
      { name: 'report.md', sizeBytes: 500 * 1024 },
      'md',
      'pdf',
      {},
      capableDevice,
    );
    assert.equal(pdfDecision.selectedTier, 'LOCAL_PURE_JS');
    assert.equal(pdfDecision.selectedEngine, 'pure-pdf-ops');
    assert.equal(pdfDecision.isLocal, true);
  });

  it('routes server-only office & archive formats (docx -> pdf, 7z -> zip, epub -> pdf) to SERVER_FALLBACK', () => {
    const docx = router.route(
      { name: 'deck.docx', sizeBytes: 2 * MB },
      'docx',
      'pdf',
      {},
      capableDevice,
    );
    assert.equal(docx.selectedTier, 'SERVER_FALLBACK');
    assert.equal(docx.selectedEngine, 'server-libreoffice');
    assert.equal(docx.serverLane, 'document');
    assert.equal(docx.requiresUpload, true);
    assert.match(docx.reason, /LibreOffice|server/i);

    const sevenZip = router.route(
      { name: 'archive.7z', sizeBytes: 5 * MB },
      '7z',
      'zip',
      {},
      capableDevice,
    );
    assert.equal(sevenZip.selectedTier, 'SERVER_FALLBACK');
    assert.equal(sevenZip.selectedEngine, 'server-archive-7z');
    assert.equal(sevenZip.serverLane, 'fast');
  });

  it('routes small video WASM when crossOriginIsolated is true, and escalates >60MB video when false', () => {
    const localVideo = router.route(
      { name: 'clip.mp4', sizeBytes: 35 * MB },
      'mp4',
      'webm',
      {},
      capableDevice,
    );
    assert.equal(localVideo.selectedTier, 'LOCAL_WASM');
    assert.equal(localVideo.selectedEngine, 'wasm-ffmpeg');
    assert.equal(localVideo.isLocal, true);

    const unisolatedDevice = DeviceProfiler.detectSync({
      ...capableDevice,
      crossOriginIsolated: false,
    });
    const escalatedVideo = router.route(
      { name: 'movie.mp4', sizeBytes: 85 * MB },
      'mp4',
      'webm',
      {},
      unisolatedDevice,
    );
    assert.equal(escalatedVideo.selectedTier, 'SERVER_FALLBACK');
    assert.equal(escalatedVideo.selectedEngine, 'server-ffmpeg');
    assert.equal(escalatedVideo.serverLane, 'media');
    assert.equal(escalatedVideo.requiresUpload, true);
    assert.match(escalatedVideo.reason, /SharedArrayBuffer|COOP/i);
  });

  it('escalates to SERVER_FALLBACK when estimatedPeakMemoryMB exceeds safeBrowserMemoryCapMB', () => {
    const lowRamDevice = DeviceProfiler.detectSync({
      deviceMemoryGB: 2, // safe cap = 440 MB
      supportsOffscreenCanvas: true,
      supportedCanvasEncodeMimes: ['image/png', 'image/jpeg', 'image/webp'],
    });
    assert.equal(lowRamDevice.safeBrowserMemoryCapMB, 440);

    // 100 MB PNG * 5.5 multiplier = 550 MB > 440 MB cap
    const decision = router.route(
      { name: 'huge.png', sizeBytes: 100 * MB },
      'png',
      'webp',
      {},
      lowRamDevice,
    );
    assert.equal(decision.selectedTier, 'SERVER_FALLBACK');
    assert.equal(decision.isLocal, false);
    assert.match(decision.reason, /RAM|memory/i);
  });

  it('honors forceExecutionMode SERVER_ONLY and LOCAL_ONLY', () => {
    const forcedServer = router.route(
      { name: 'icon.png', sizeBytes: 100 * 1024 },
      'png',
      'webp',
      { forceExecutionMode: 'SERVER_ONLY' },
      capableDevice,
    );
    assert.equal(forcedServer.selectedTier, 'SERVER_FALLBACK');
    assert.equal(forcedServer.requiresUpload, true);

    assert.throws(() => {
      router.route(
        { name: 'doc.docx', sizeBytes: 100 * 1024 },
        'docx',
        'pdf',
        { forceExecutionMode: 'LOCAL_ONLY' },
        capableDevice,
      );
    }, /no compatible local browser engine/i);
  });

  it('detects magic-byte extension spoofing and routes by verified signature', () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const magic = inspectFileMagicBytes(pngHeader, 'spoofed.jpg');
    assert.equal(magic.detectedFormatId, 'png');
    assert.equal(magic.isSpoofedOrMismatched, true);

    const decision = router.route(
      { name: 'spoofed.jpg', sizeBytes: 2 * MB, headerBytes: pngHeader },
      'jpg',
      'webp',
      {},
      capableDevice,
    );
    assert.equal(decision.sourceFormat, 'png');
    assert.ok(decision.warnings.length > 0);
  });

  it('escalateFailedLocalJobToServer converts a failed local decision to SERVER_FALLBACK', () => {
    const localDecision = router.route(
      { name: 'clip.mp4', sizeBytes: 40 * MB },
      'mp4',
      'webm',
      {},
      capableDevice,
    );
    assert.equal(localDecision.isLocal, true);

    const escalated = router.escalateFailedLocalJobToServer(
      localDecision,
      new Error('WASM OOM heap exhausted'),
    );
    assert.equal(escalated.selectedTier, 'SERVER_FALLBACK');
    assert.equal(escalated.selectedEngine, 'server-ffmpeg');
    assert.equal(escalated.isLocal, false);
    assert.equal(escalated.requiresUpload, true);
    assert.match(escalated.reason, /WASM OOM heap exhausted/);
    assert.ok(escalated.warnings.some((w) => w.includes('WASM OOM heap exhausted')));
  });
});

describe('WorkerPool & Local Pure Engines', () => {
  it('clamps worker concurrency and supports cancellation & recycling', async () => {
    assert.equal(clampWorkerConcurrency(1), 1);
    assert.equal(clampWorkerConcurrency(4), 3);
    assert.equal(clampWorkerConcurrency(16), 4);

    const pool = new WorkerPool(4, 1024); // 1 KB recycling threshold for test
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      pool.enqueue({
        id: 'aborted-job',
        inputBytes: 100,
        signal: controller.signal,
        executor: async () => 'done',
      }),
      /abort/i,
    );

    const out = await pool.enqueue({
      id: 'recycle-job',
      inputBytes: 2048,
      isHeavyWasm: true,
      executor: async () => 42,
    });
    assert.equal(out, 42);
    const stats = pool.getStats();
    assert.equal(stats.totalJobsProcessed, 1);
    assert.ok(stats.recycledWorkersCount >= 1);
  });

  it('encodes valid WAV, BMP, ICO, PDF, ZIP, and structured data formats locally', async () => {
    // WAV encoder
    const wav = encodeChannelsToWav([new Float32Array([0, 0.5, -0.5, 0])], 44100);
    assert.equal(new TextDecoder().decode(wav.subarray(0, 4)), 'RIFF');
    assert.equal(new TextDecoder().decode(wav.subarray(8, 12)), 'WAVE');

    // BMP + ICO encoders
    const bmp = encodeImageDataToBmp(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1);
    assert.equal(bmp[0], 0x42);
    assert.equal(bmp[1], 0x4d);

    const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const ico = encodePngToIco(fakePng, 16, 16);
    assert.equal(ico[2], 1); // ICO type

    // PDF generator
    const pdf = generateTextPdf('Test Report', ['# Heading', 'Hello OmniConvert PDF engine'], 'A4');
    assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), '%PDF-');

    // ZIP round-trip
    const zipBytes = await createZipArchive([
      { name: 'hello.txt', data: new TextEncoder().encode('OmniConvert ZIP works!') },
    ]);
    assert.equal(zipBytes[0], 0x50);
    assert.equal(zipBytes[1], 0x4b);
    const extracted = await extractFirstFromZip(zipBytes);
    assert.equal(extracted.name, 'hello.txt');
    assert.equal(new TextDecoder().decode(extracted.data), 'OmniConvert ZIP works!');

    // CSV -> JSON -> YAML -> SQL
    const csvToJson = convertStructuredDataText('name,score\nAlice,98\nBob,87', 'csv', 'json');
    assert.equal(csvToJson.success, true);
    const parsed = JSON.parse(csvToJson.outputText);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].name, 'Alice');

    const jsonToSql = convertStructuredDataText(csvToJson.outputText, 'json', 'sql', {
      sqlTableName: 'players',
    });
    assert.equal(jsonToSql.success, true);
    assert.match(jsonToSql.outputText, /INSERT INTO "players"/);
  });
});
