import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ConversionJobRecord } from '../../shared/types.ts';
import type { Capabilities } from './adapter-registry.ts';

export async function processMedia(
  job: ConversionJobRecord, 
  inputDir: string, 
  outputDir: string, 
  capabilities: Capabilities, 
  signal: AbortSignal,
  onProgress?: (percent: number, message: string) => void
): Promise<string> {
  const inputPath = path.join(inputDir, job.sanitizedFilename);
  const outputPath = path.join(outputDir, `output.${job.targetFormat}`);

  if (capabilities.ffmpeg) {
    return new Promise((resolve, reject) => {
      const args = ['-y', '-i', inputPath];
      
      if (job.options.videoCrf !== undefined) {
        args.push('-crf', job.options.videoCrf.toString());
      }
      
      args.push(outputPath);

      const proc = spawn('ffmpeg', args, { signal, shell: false });
      
      if (onProgress && proc.stderr) {
        proc.stderr.on('data', (data) => {
          const str = data.toString();
          const match = str.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (match) {
            // Rough parsing, we would need total duration to calculate percent.
            // For now, emit 50% just as a signal
            onProgress(50, `Encoding time=${match[0]}`);
          }
        });
      }

      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`FFmpeg failed with code ${code}`));
      });
    });
  }

  // Pure node fallback - mock
  await fs.copyFile(inputPath, outputPath);
  return outputPath;
}
