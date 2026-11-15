import { createZipArchive, encodeChannelsToWav } from '../workers/local-engines.ts';

async function generateDemoPng(): Promise<File> {
  const width = 960;
  const height = 540;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#064e3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative translucent orbs
    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.beginPath();
    ctx.arc(220, 180, 140, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.beginPath();
    ctx.arc(740, 360, 170, 0, Math.PI * 2);
    ctx.fill();

    // Card frame
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, width - 96, height - 96);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
    ctx.fillText('OmniConvert Engine', 96, 230);

    ctx.fillStyle = '#34d399';
    ctx.font = '600 26px system-ui, -apple-system, sans-serif';
    ctx.fillText('85-95% Zero-Upload Local Conversion', 96, 285);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px monospace';
    ctx.fillText('960x540 PNG  |  OffscreenCanvas  |  EXIF-Strip Ready', 96, 345);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create demo PNG'))),
      'image/png',
    );
  });
  return new File([blob], 'studio-portrait.png', { type: 'image/png' });
}

function generateDemoCsv(): File {
  const csv = [
    'id,sku,product_name,category,price,stock,is_active',
    '101,PROD-1001,Wireless Noise-Canceling Headphones,Audio,299.99,450,true',
    '102,PROD-1002,Mechanical Keyboard - Cherry MX Blue,Accessories,149.50,120,true',
    '103,PROD-1003,Ergonomic Office Chair (Mesh),Furniture,499.00,85,true',
    '104,PROD-1004,27-inch 4K IPS Monitor,Displays,399.00,210,true',
    '105,PROD-1005,USB-C Docking Station (100W PD),Accessories,89.99,500,true',
    '106,PROD-1006,Bluetooth Optical Mouse,Accessories,45.00,800,false',
  ].join('\\n');
  return new File([csv], 'product-catalog.csv', { type: 'text/csv' });
}

function generateDemoMarkdown(): File {
  const md = [
    '# OmniConvert v2.0 Release Notes',
    '',
    '## What\\'s New in this Release',
    'We are excited to announce the latest major update to the **OmniConvert Engine**.',
    '',
    '### Key Features',
    '- **Invisible Hybrid Execution**: Users seamlessly get hardware-accelerated local conversion or high-precision server fallbacks without being asked.',
    '- **Enhanced Privacy**: Local conversions ensure *0 KB* of data leaves the device.',
    '- **Studio Quality Audio**: Support for downmixing, peak normalization, and resampling.',
    '',
    '### Fixes & Improvements',
    '1. Improved memory management for heavy PNG/WEBP exports.',
    '2. Added clean 2-space indentation presets for JSON.',
    '3. Optimized LibreOffice and Pandoc integration for document rendering.',
    '',
    '*Thank you for using OmniConvert!*'
  ].join('\\n');
  return new File([md], 'release-notes.md', { type: 'text/markdown' });
}

function generateDemoWav(): File {
  const sampleRate = 44100;
  const durationSec = 1.4;
  const length = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const freqs = [440, 554.37, 659.25]; // A major triad

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 0.04) * Math.min(1, (durationSec - t) / 0.25);
    let sample = 0;
    for (const f of freqs) {
      sample += Math.sin(2 * Math.PI * f * t);
    }
    sample = (sample / freqs.length) * 0.45 * env;
    left[i] = sample;
    right[i] = sample * 0.92;
  }

  const wavBytes = encodeChannelsToWav([left, right], sampleRate, { bitDepth: 16 });
  return new File([wavBytes.buffer as ArrayBuffer], 'ambient-synth.wav', { type: 'audio/wav' });
}

async function generateDemoDocx(): Promise<File> {
  const enc = new TextEncoder();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Executive Brief</w:t></w:r></w:p>
    <w:p><w:r><w:t>This confidential document outlines the strategic priorities for Q4 2026.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

  const zipBytes = await createZipArchive([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'word/document.xml', data: enc.encode(documentXml) },
  ]);

  return new File([zipBytes.buffer as ArrayBuffer], 'executive-brief.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function createDemoSampleFiles(): Promise<File[]> {
  const [png, docx] = await Promise.all([generateDemoPng(), generateDemoDocx()]);
  return [
    png,
    generateDemoCsv(),
    generateDemoMarkdown(),
    generateDemoWav(),
    docx,
  ];
}
