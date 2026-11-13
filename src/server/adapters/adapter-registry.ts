import { spawn } from 'node:child_process';
import type { ConversionJobRecord } from '../../shared/types.ts';

export interface Capabilities {
  ffmpeg: boolean;
  imagemagick: boolean;
  libreoffice: boolean;
  pandoc: boolean;
  sevenZip: boolean;
}

export class AdapterRegistry {
  private capabilities: Capabilities = {
    ffmpeg: false,
    imagemagick: false,
    libreoffice: false,
    pandoc: false,
    sevenZip: false,
  };

  private checked = false;

  async init() {
    if (this.checked) return;
    
    this.capabilities = {
      ffmpeg: await this.checkCommand('ffmpeg'),
      imagemagick: await this.checkCommand('magick'),
      libreoffice: await this.checkCommand('soffice'),
      pandoc: await this.checkCommand('pandoc'),
      sevenZip: await this.checkCommand('7z'),
    };
    
    this.checked = true;
  }

  getCapabilities(): Capabilities {
    return { ...this.capabilities };
  }

  private async checkCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(command, ['--version'], { shell: false });
      
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => {
        resolve(code === 0);
      });
    });
  }
}
