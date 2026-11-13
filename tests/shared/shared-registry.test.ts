import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CONVERSION_PRESETS,
  CONVERSION_ROUTE_RULES,
  FORMAT_CATALOG,
  convertEncodingOrText,
  convertMarkupDocument,
  convertTabularData,
  detectFormatByMagicBytes,
  getFormatByExtension,
  getFormatById,
  getFormatsByCategory,
  getPresetsForTarget,
  getRouteRule,
  getSupportedTargetsForSource,
} from '../../src/shared/index.ts';

test('Format Catalog — catalog size and lookups', () => {
  assert.ok(FORMAT_CATALOG.length >= 80, `Expected >= 80 formats, got ${FORMAT_CATALOG.length}`);

  const png = getFormatById('png');
  assert.ok(png);
  assert.equal(png?.name, 'Portable Network Graphics');

  const jpgFromExt = getFormatByExtension('.JPEG');
  assert.ok(jpgFromExt);
  assert.equal(jpgFromExt?.id, 'jpg');

  const tgzFromExt = getFormatByExtension('archive.tar.gz');
  assert.ok(tgzFromExt);
  assert.equal(tgzFromExt?.id, 'tgz');

  const imageFormats = getFormatsByCategory('image');
  assert.ok(imageFormats.length >= 14);

  const dataFormats = getFormatsByCategory('data');
  assert.ok(dataFormats.length >= 10);
});

test('Magic Bytes Detection — binary signatures and spoof detection', () => {
  // 1. PNG Header
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngRes = detectFormatByMagicBytes(pngHeader, 'image.png');
  assert.equal(pngRes.detectedFormatId, 'png');
  assert.equal(pngRes.confidence, 'high');
  assert.equal(pngRes.isSpoofedOrMismatched, false);

  // 2. WEBP Header (RIFF....WEBP)
  const webpHeader = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  const webpRes = detectFormatByMagicBytes(webpHeader, 'photo.webp');
  assert.equal(webpRes.detectedFormatId, 'webp');
  assert.equal(webpRes.confidence, 'high');
  assert.equal(webpRes.isSpoofedOrMismatched, false);

  // 3. Spoofed File — PNG bytes with .jpg extension
  const spoofedRes = detectFormatByMagicBytes(pngHeader, 'image.jpg');
  assert.equal(spoofedRes.detectedFormatId, 'png');
  assert.equal(spoofedRes.extensionFormatId, 'jpg');
  assert.equal(spoofedRes.isSpoofedOrMismatched, true);
  assert.ok(spoofedRes.warningMessage?.toLowerCase().includes('mismatch'));

  // 4. Compatible Container — ZIP bytes with .docx extension
  const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const docxRes = detectFormatByMagicBytes(zipHeader, 'document.docx');
  assert.equal(docxRes.detectedFormatId, 'zip');
  assert.equal(docxRes.extensionFormatId, 'docx');
  assert.equal(docxRes.isSpoofedOrMismatched, false); // DOCX uses ZIP container

  // 5. Text Heuristic — SVG XML string
  const svgText = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>');
  const svgRes = detectFormatByMagicBytes(svgText, 'icon.svg');
  assert.equal(svgRes.detectedFormatId, 'svg');
  assert.equal(svgRes.confidence, 'high');

  // 6. Text Heuristic — JSON
  const jsonText = new TextEncoder().encode('{\n  "name": "OmniConvert"\n}');
  const jsonRes = detectFormatByMagicBytes(jsonText, 'data.json');
  assert.equal(jsonRes.detectedFormatId, 'json');
});

test('Conversion Routing Matrix — rules and targets lookups', () => {
  assert.ok(CONVERSION_ROUTE_RULES.length > 100);

  // PNG -> WEBP should prefer LOCAL_NATIVE canvas-2d
  const pngToWebp = getRouteRule('png', 'webp');
  assert.ok(pngToWebp);
  assert.equal(pngToWebp?.supportedTiers[0], 'LOCAL_NATIVE');
  assert.equal(pngToWebp?.enginesByTier.LOCAL_NATIVE, 'canvas-2d');

  // DOCX -> PDF should require SERVER_FALLBACK server-libreoffice
  const docxToPdf = getRouteRule('docx', 'pdf');
  assert.ok(docxToPdf);
  assert.equal(docxToPdf?.supportedTiers[0], 'SERVER_FALLBACK');
  assert.equal(docxToPdf?.enginesByTier.SERVER_FALLBACK, 'server-libreoffice');

  // Supported targets for CSV
  const csvTargets = getSupportedTargetsForSource('csv');
  const targetIds = csvTargets.map((t) => t.id);
  assert.ok(targetIds.includes('json'));
  assert.ok(targetIds.includes('yaml'));
  assert.ok(targetIds.includes('xml'));
  assert.ok(targetIds.includes('sql'));
  assert.ok(targetIds.includes('md'));
  assert.ok(targetIds.includes('html'));
});

test('Presets Catalog — preset filtering and rules', () => {
  assert.ok(CONVERSION_PRESETS.length >= 25);

  const webpPresets = getPresetsForTarget('webp');
  assert.ok(webpPresets.length >= 2);
  assert.equal(webpPresets[0].targetFormat, 'webp');

  const mp4Presets = getPresetsForTarget('mp4');
  assert.ok(mp4Presets.length >= 2);
});

test('Tabular Data Converter — pure JS parser and serializers', () => {
  const csvInput = `name,age,role\nAlice,30,Developer\nBob,25,Designer`;

  // 1. CSV -> JSON
  const jsonRes = convertTabularData(csvInput, 'csv', 'json', { indentSpaces: 2 });
  assert.equal(jsonRes.success, true);
  assert.equal(jsonRes.rowCount, 2);
  assert.ok(jsonRes.outputText.includes('"name": "Alice"'));

  // 2. JSON -> YAML
  const yamlRes = convertTabularData(jsonRes.outputText, 'json', 'yaml');
  assert.equal(yamlRes.success, true);
  assert.ok(yamlRes.outputText.includes('- name: Alice'));

  // 3. CSV -> SQL
  const sqlRes = convertTabularData(csvInput, 'csv', 'sql', { sqlTableName: 'users' });
  assert.equal(sqlRes.success, true);
  assert.ok(sqlRes.outputText.includes('INSERT INTO `users`'));
  assert.ok(sqlRes.outputText.includes("'Alice'"));

  // 4. CSV -> Markdown Table
  const mdRes = convertTabularData(csvInput, 'csv', 'md');
  assert.equal(mdRes.success, true);
  assert.ok(mdRes.outputText.includes('| name | age | role |'));
  assert.ok(mdRes.outputText.includes('| Alice | 30 | Developer |'));

  // 5. CSV -> HTML Table
  const htmlRes = convertTabularData(csvInput, 'csv', 'html');
  assert.equal(htmlRes.success, true);
  assert.ok(htmlRes.outputText.includes('<table>'));
  assert.ok(htmlRes.outputText.includes('<td>Alice</td>'));

  // 6. JSON -> ENV
  const envRes = convertTabularData(`[{"app_name": "Converter", "port": 3000}]`, 'json', 'env');
  assert.equal(envRes.success, true);
  assert.ok(envRes.outputText.includes('APP_NAME=Converter'));
  assert.ok(envRes.outputText.includes('PORT=3000'));
});

test('Markup Document Converter — pure JS document transformer', () => {
  const mdInput = `# OmniConvert Guide\n\nThis is **bold** text and *italic* text.\n\n- Feature 1\n- Feature 2`;

  // 1. MD -> HTML
  const htmlRes = convertMarkupDocument(mdInput, 'md', 'html');
  assert.equal(htmlRes.success, true);
  assert.ok(htmlRes.outputText.includes('<h1>OmniConvert Guide</h1>'));
  assert.ok(htmlRes.outputText.includes('<strong>bold</strong>'));

  // 2. HTML -> MD
  const mdBack = convertMarkupDocument(htmlRes.outputText, 'html', 'md');
  assert.equal(mdBack.success, true);
  assert.ok(mdBack.outputText.includes('# OmniConvert Guide'));

  // 3. MD -> Plain TXT
  const txtRes = convertMarkupDocument(mdInput, 'md', 'txt');
  assert.equal(txtRes.success, true);
  assert.ok(txtRes.outputText.includes('OmniConvert Guide'));
  assert.ok(txtRes.outputText.includes('bold text'));

  // 4. MD -> RTF
  const rtfRes = convertMarkupDocument(mdInput, 'md', 'rtf');
  assert.equal(rtfRes.success, true);
  assert.ok(rtfRes.outputText.includes('{\\rtf1'));

  // 5. MD -> LaTeX
  const latexRes = convertMarkupDocument(mdInput, 'md', 'latex');
  assert.equal(latexRes.success, true);
  assert.ok(latexRes.outputText.includes('\\documentclass{article}'));
});

test('Units & Encoding Converter — text / binary encoding transformations', () => {
  const text = 'Hello OmniConvert!';
  const bytes = new TextEncoder().encode(text);

  // 1. UTF-8 -> Base64
  const b64Res = convertEncodingOrText(bytes, 'utf8', 'base64');
  assert.equal(b64Res.success, true);
  assert.equal(b64Res.outputText, 'SGVsbG8gT21uaUNvbnZlcnQh');

  // 2. Base64 -> Hex
  const b64Bytes = new TextEncoder().encode(b64Res.outputText);
  const hexRes = convertEncodingOrText(b64Bytes, 'base64', 'hex');
  assert.equal(hexRes.success, true);
  assert.equal(hexRes.outputText, '48656c6c6f204f6d6e69436f6e7665727421');

  // 3. Hex -> UTF-8
  const hexBytes = new TextEncoder().encode(hexRes.outputText);
  const utf8Res = convertEncodingOrText(hexBytes, 'hex', 'utf8');
  assert.equal(utf8Res.success, true);
  assert.equal(utf8Res.outputText, text);
});
