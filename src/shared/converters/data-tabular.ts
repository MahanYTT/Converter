import type { ConversionOptions, DataTransformResult } from '../types.ts';
import { getFormatById } from '../registry/formats.catalog.ts';

/**
 * Pure zero-dependency parser & serializer for tabular/data formats.
 * Supports: json, ndjson, csv, tsv, yaml, xml, toml, ini, env, sql, md (table), html (table).
 */
export function convertTabularData(
  inputText: string,
  sourceFormat: string,
  targetFormat: string,
  options: ConversionOptions = {}
): DataTransformResult {
  const warnings: string[] = [];
  const src = sourceFormat.trim().toLowerCase();
  const tgt = targetFormat.trim().toLowerCase();
  const tgtDef = getFormatById(tgt);

  const targetExtension = tgtDef ? tgtDef.extensions[0] : tgt;
  const mimeType = tgtDef ? tgtDef.mimeType : 'text/plain';

  if (!inputText || inputText.trim().length === 0) {
    return {
      success: true,
      outputText: '',
      outputBytes: new Uint8Array(0),
      mimeType,
      targetExtension,
      rowCount: 0,
      warnings: ['Input text was empty'],
    };
  }

  try {
    // Step 1: Parse input into array of records Record<string, unknown>[]
    const records = parseToRecords(inputText, src, warnings);

    // Step 2: Serialize records to target format string
    const outputText = serializeRecords(records, tgt, options, warnings);
    const outputBytes = new TextEncoder().encode(outputText);

    return {
      success: true,
      outputText,
      outputBytes,
      mimeType,
      targetExtension,
      rowCount: records.length,
      warnings,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      outputText: '',
      outputBytes: new Uint8Array(0),
      mimeType,
      targetExtension,
      rowCount: 0,
      warnings,
      errorMessage: `Data conversion failed (${src} -> ${tgt}): ${message}`,
    };
  }
}

/**
 * Parses raw text of any supported format into array of key-value objects.
 */
function parseToRecords(text: string, format: string, warnings: string[]): Record<string, unknown>[] {
  const trimmed = text.trim();

  switch (format) {
    case 'json': {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : { value: item }));
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return [parsed as Record<string, unknown>];
      }
      return [{ value: parsed }];
    }

    case 'ndjson':
    case 'jsonl': {
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
      return lines.map((line) => {
        const item = JSON.parse(line);
        return typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : { value: item };
      });
    }

    case 'csv': {
      return parseCsvTsv(trimmed, ',');
    }

    case 'tsv': {
      return parseCsvTsv(trimmed, '\t');
    }

    case 'env': {
      const result: Record<string, unknown> = {};
      const lines = trimmed.split(/\r?\n/);
      for (const line of lines) {
        const l = line.trim();
        if (!l || l.startsWith('#')) continue;
        const eqIdx = l.indexOf('=');
        if (eqIdx > 0) {
          const key = l.slice(0, eqIdx).trim();
          let val = l.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          result[key] = val;
        }
      }
      return [result];
    }

    case 'ini':
    case 'cfg':
    case 'conf': {
      const result: Record<string, unknown> = {};
      let currentSection = 'default';
      const lines = trimmed.split(/\r?\n/);

      for (const line of lines) {
        const l = line.trim();
        if (!l || l.startsWith(';') || l.startsWith('#')) continue;
        if (l.startsWith('[') && l.endsWith(']')) {
          currentSection = l.slice(1, -1).trim();
          continue;
        }
        const eqIdx = l.indexOf('=');
        if (eqIdx > 0) {
          const key = l.slice(0, eqIdx).trim();
          const val = l.slice(eqIdx + 1).trim();
          const fullKey = currentSection === 'default' ? key : `${currentSection}.${key}`;
          result[fullKey] = val;
        }
      }
      return [result];
    }

    case 'yaml':
    case 'yml': {
      return parseSimpleYaml(trimmed);
    }

    case 'toml': {
      return parseSimpleToml(trimmed);
    }

    case 'xml': {
      return parseSimpleXml(trimmed);
    }

    case 'sql': {
      return parseSqlInserts(trimmed);
    }

    case 'md':
    case 'markdown': {
      return parseMarkdownTable(trimmed);
    }

    case 'html': {
      return parseHtmlTable(trimmed);
    }

    default: {
      warnings.push(`Unknown source format '${format}', attempting JSON parse fallback`);
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
  }
}

/**
 * Serializes array of records to raw output string.
 */
function serializeRecords(
  records: Record<string, unknown>[],
  format: string,
  options: ConversionOptions,
  warnings: string[]
): string {
  const indent = options.indentSpaces !== undefined ? options.indentSpaces : 2;

  switch (format) {
    case 'json': {
      return JSON.stringify(records, null, indent > 0 ? indent : undefined);
    }

    case 'ndjson':
    case 'jsonl': {
      return records.map((r) => JSON.stringify(r)).join('\n');
    }

    case 'csv': {
      const delim = options.csvDelimiter || ',';
      return serializeCsvTsv(records, delim);
    }

    case 'tsv': {
      return serializeCsvTsv(records, '\t');
    }

    case 'yaml':
    case 'yml': {
      return serializeYaml(records);
    }

    case 'xml': {
      return serializeXml(records);
    }

    case 'toml': {
      return serializeToml(records);
    }

    case 'ini':
    case 'cfg': {
      return serializeIni(records);
    }

    case 'env': {
      return serializeEnv(records);
    }

    case 'sql': {
      const table = options.sqlTableName || 'imported_data';
      return serializeSql(records, table);
    }

    case 'md':
    case 'markdown': {
      return serializeMarkdownTable(records);
    }

    case 'html': {
      return serializeHtmlTable(records);
    }

    default: {
      warnings.push(`Unknown target format '${format}', serializing to JSON fallback`);
      return JSON.stringify(records, null, indent);
    }
  }
}

// --- CSV / TSV HELPERS ---
function parseCsvTsv(text: string, delimiter: string): Record<string, unknown>[] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentToken = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentToken += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentLine.push(currentToken.trim());
      currentToken = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentToken.trim());
      if (currentLine.some((c) => c.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentToken = '';
    } else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0 || currentLine.length > 0) {
    currentLine.push(currentToken.trim());
    if (currentLine.some((c) => c.length > 0)) {
      lines.push(currentLine);
    }
  }

  if (lines.length === 0) return [];

  const headers = lines[0];
  const records: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j] || `col_${j + 1}`;
      obj[header] = row[j] !== undefined ? row[j] : '';
    }
    records.push(obj);
  }

  return records;
}

function serializeCsvTsv(records: Record<string, unknown>[], delimiter: string): string {
  if (records.length === 0) return '';
  const headers = extractUniqueHeaders(records);

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeCell).join(delimiter);
  const dataRows = records.map((r) => headers.map((h) => escapeCell(r[h])).join(delimiter));

  return [headerRow, ...dataRows].join('\n');
}

// --- YAML HELPERS ---
function parseSimpleYaml(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/);
  const records: Record<string, unknown>[] = [];
  let currentObj: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ')) {
      if (currentObj) records.push(currentObj);
      currentObj = {};
      const content = trimmed.slice(2).trim();
      const colIdx = content.indexOf(':');
      if (colIdx > 0) {
        const k = content.slice(0, colIdx).trim();
        const v = content.slice(colIdx + 1).trim();
        currentObj[k] = coerceValue(v);
      }
    } else if (currentObj) {
      const colIdx = trimmed.indexOf(':');
      if (colIdx > 0) {
        const k = trimmed.slice(0, colIdx).trim();
        const v = trimmed.slice(colIdx + 1).trim();
        currentObj[k] = coerceValue(v);
      }
    } else {
      const colIdx = trimmed.indexOf(':');
      if (colIdx > 0) {
        if (!currentObj) currentObj = {};
        const k = trimmed.slice(0, colIdx).trim();
        const v = trimmed.slice(colIdx + 1).trim();
        currentObj[k] = coerceValue(v);
      }
    }
  }

  if (currentObj) records.push(currentObj);
  return records.length > 0 ? records : [{}];
}

function serializeYaml(records: Record<string, unknown>[]): string {
  const lines: string[] = [];
  for (const record of records) {
    let first = true;
    for (const [key, val] of Object.entries(record)) {
      const formattedVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
      if (first) {
        lines.push(`- ${key}: ${formattedVal}`);
        first = false;
      } else {
        lines.push(`  ${key}: ${formattedVal}`);
      }
    }
  }
  return lines.join('\n');
}

// --- XML HELPERS ---
function parseSimpleXml(text: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const itemMatches = text.match(/<row[\s\S]*?<\/row>|<item[\s\S]*?<\/item>|<record[\s\S]*?<\/record>/gi);

  if (itemMatches) {
    for (const block of itemMatches) {
      const obj: Record<string, unknown> = {};
      const tagRegex = /<([a-zA-Z0-9_\-]+)>([^<]*)<\/\1>/g;
      let match: RegExpExecArray | null;
      while ((match = tagRegex.exec(block)) !== null) {
        obj[match[1]] = coerceValue(match[2].trim());
      }
      records.push(obj);
    }
  } else {
    const obj: Record<string, unknown> = {};
    const tagRegex = /<([a-zA-Z0-9_\-]+)>([^<]*)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(text)) !== null) {
      obj[match[1]] = coerceValue(match[2].trim());
    }
    if (Object.keys(obj).length > 0) records.push(obj);
  }

  return records;
}

function serializeXml(records: Record<string, unknown>[]): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<root>'];

  for (const record of records) {
    lines.push('  <row>');
    for (const [key, val] of Object.entries(record)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const valStr = val === null || val === undefined ? '' : String(val);
      lines.push(`    <${safeKey}>${escapeXml(valStr)}</${safeKey}>`);
    }
    lines.push('  </row>');
  }

  lines.push('</root>');
  return lines.join('\n');
}

// --- TOML / INI / ENV HELPERS ---
function parseSimpleToml(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/);
  const records: Record<string, unknown>[] = [];
  let currentObj: Record<string, unknown> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      if (currentObj) records.push(currentObj);
      currentObj = {};
      continue;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      if (!currentObj) currentObj = {};
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      currentObj[k] = coerceValue(v);
    }
  }

  if (currentObj) records.push(currentObj);
  return records.length > 0 ? records : [{}];
}

function serializeToml(records: Record<string, unknown>[]): string {
  const lines: string[] = [];
  for (const record of records) {
    lines.push('[[records]]');
    for (const [key, val] of Object.entries(record)) {
      const valStr = typeof val === 'string' ? `"${val.replace(/"/g, '\\"')}"` : String(val ?? '""');
      lines.push(`${key} = ${valStr}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function serializeIni(records: Record<string, unknown>[]): string {
  const lines: string[] = [];
  records.forEach((record, idx) => {
    lines.push(`[item_${idx + 1}]`);
    for (const [key, val] of Object.entries(record)) {
      lines.push(`${key} = ${val ?? ''}`);
    }
    lines.push('');
  });
  return lines.join('\n').trim();
}

function serializeEnv(records: Record<string, unknown>[]): string {
  const lines: string[] = [];
  const merged = records.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  for (const [key, val] of Object.entries(merged)) {
    const envKey = key.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const valStr = String(val ?? '');
    const safeVal = valStr.includes(' ') ? `"${valStr}"` : valStr;
    lines.push(`${envKey}=${safeVal}`);
  }
  return lines.join('\n');
}

function parseSqlInserts(text: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const insertRegex = /INSERT\s+INTO\s+[^\s(]+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(text)) !== null) {
    const cols = match[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
    const vals = match[2].split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''));

    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]] = vals[i] !== undefined ? coerceValue(vals[i]) : '';
    }
    records.push(obj);
  }

  return records;
}

function serializeSql(records: Record<string, unknown>[], tableName: string): string {
  if (records.length === 0) return '';
  const headers = extractUniqueHeaders(records);
  const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
  const colsStr = headers.map((h) => `\`${h}\``).join(', ');

  const statements: string[] = [];
  for (const record of records) {
    const valsStr = headers
      .map((h) => {
        const val = record[h];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
        return `'${String(val).replace(/'/g, "''")}'`;
      })
      .join(', ');
    statements.push(`INSERT INTO \`${safeTable}\` (${colsStr}) VALUES (${valsStr});`);
  }

  return statements.join('\n');
}

// --- MARKUP / HTML TABLE HELPERS ---
function parseMarkdownTable(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

  const records: Record<string, unknown>[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cells[j] !== undefined ? coerceValue(cells[j]) : '';
    }
    records.push(obj);
  }

  return records;
}

function serializeMarkdownTable(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '';
  const headers = extractUniqueHeaders(records);

  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = records.map((r) => `| ${headers.map((h) => (r[h] !== undefined ? String(r[h]) : '')).join(' | ')} |`);

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

function parseHtmlTable(text: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const thMatches = text.match(/<th[^>]*>([^<]*)<\/th>/gi);
  const headers: string[] = thMatches ? thMatches.map((th) => th.replace(/<[^>]+>/g, '').trim()) : [];

  const trMatches = text.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!trMatches) return [];

  for (const tr of trMatches) {
    const tdMatches = tr.match(/<td[^>]*>([^<]*)<\/td>/gi);
    if (tdMatches) {
      const cells = tdMatches.map((td) => td.replace(/<[^>]+>/g, '').trim());
      const obj: Record<string, unknown> = {};
      for (let j = 0; j < cells.length; j++) {
        const key = headers[j] || `col_${j + 1}`;
        obj[key] = coerceValue(cells[j]);
      }
      records.push(obj);
    }
  }

  return records;
}

function serializeHtmlTable(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '<table></table>';
  const headers = extractUniqueHeaders(records);

  const lines: string[] = ['<table>', '  <thead>', '    <tr>'];
  for (const h of headers) {
    lines.push(`      <th>${escapeXml(h)}</th>`);
  }
  lines.push('    </tr>', '  </thead>', '  <tbody>');

  for (const r of records) {
    lines.push('    <tr>');
    for (const h of headers) {
      const valStr = r[h] !== undefined ? String(r[h]) : '';
      lines.push(`      <td>${escapeXml(valStr)}</td>`);
    }
    lines.push('    </tr>');
  }

  lines.push('  </tbody>', '</table>');
  return lines.join('\n');
}

// --- UTILS ---
function extractUniqueHeaders(records: Record<string, unknown>[]): string[] {
  const headers = new Set<string>();
  for (const r of records) {
    for (const k of Object.keys(r)) {
      headers.add(k);
    }
  }
  return Array.from(headers);
}

function coerceValue(val: string): unknown {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  if (!isNaN(Number(val)) && val.trim() !== '') return Number(val);
  return val;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
