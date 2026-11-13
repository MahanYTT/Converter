import type { ConversionOptions, DataTransformResult } from '../types.ts';
import { getFormatById } from '../registry/formats.catalog.ts';

/**
 * Pure zero-dependency converter between markup & document formats:
 * md, html, txt, rtf, latex.
 */
export function convertMarkupDocument(
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
      warnings: ['Input markup text was empty'],
    };
  }

  try {
    // Step 1: Normalize source to HTML / structured text
    const htmlContent = sourceToHtml(inputText, src, warnings);

    // Step 2: Convert HTML to target format
    const outputText = htmlToTarget(htmlContent, tgt, options, warnings);
    const outputBytes = new TextEncoder().encode(outputText);

    return {
      success: true,
      outputText,
      outputBytes,
      mimeType,
      targetExtension,
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
      warnings,
      errorMessage: `Markup document conversion failed (${src} -> ${tgt}): ${message}`,
    };
  }
}

/**
 * Converts input text in source format to normalized HTML.
 */
function sourceToHtml(text: string, format: string, warnings: string[]): string {
  switch (format) {
    case 'html':
    case 'htm':
      return text;

    case 'md':
    case 'markdown':
      return markdownToHtml(text);

    case 'txt':
    case 'text':
      return text
        .split(/\r?\n\r?\n/)
        .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
        .join('\n');

    case 'rtf':
      return rtfToHtml(text);

    case 'tex':
    case 'latex':
      return latexToHtml(text);

    default:
      warnings.push(`Unknown source markup format '${format}', treating as plain text`);
      return `<p>${escapeHtml(text)}</p>`;
  }
}

/**
 * Converts normalized HTML to target format.
 */
function htmlToTarget(
  html: string,
  format: string,
  options: ConversionOptions,
  warnings: string[]
): string {
  switch (format) {
    case 'html':
    case 'htm':
      return formatFullHtmlPage(html, options);

    case 'md':
    case 'markdown':
      return htmlToMarkdown(html);

    case 'txt':
    case 'text':
      return htmlToPlainText(html);

    case 'rtf':
      return htmlToRtf(html);

    case 'tex':
    case 'latex':
      return htmlToLatex(html);

    default:
      warnings.push(`Unknown target markup format '${format}', returning plain text`);
      return htmlToPlainText(html);
  }
}

// --- MARKDOWN <-> HTML PARSER ---
function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        htmlLines.push('</code></pre>');
        inCodeBlock = false;
      } else {
        codeLang = line.trim().slice(3).trim();
        htmlLines.push(`<pre><code class="${codeLang}">`);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      htmlLines.push(escapeHtml(line));
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Headings
    if (trimmed.startsWith('# ')) {
      htmlLines.push(`<h1>${parseInlineMd(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      htmlLines.push(`<h2>${parseInlineMd(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      htmlLines.push(`<h3>${parseInlineMd(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('#### ')) {
      htmlLines.push(`<h4>${parseInlineMd(trimmed.slice(5))}</h4>`);
    } else if (trimmed.startsWith('> ')) {
      htmlLines.push(`<blockquote>${parseInlineMd(trimmed.slice(2))}</blockquote>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      htmlLines.push(`<li>${parseInlineMd(trimmed.slice(2))}</li>`);
    } else {
      htmlLines.push(`<p>${parseInlineMd(trimmed)}</p>`);
    }
  }

  if (inCodeBlock) htmlLines.push('</code></pre>');
  return htmlLines.join('\n');
}

function parseInlineMd(str: string): string {
  let res = escapeHtml(str);
  // Bold
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');
  // Italic
  res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
  res = res.replace(/_(.*?)_/g, '<em>$1</em>');
  // Inline code
  res = res.replace(/`(.*?)`/g, '<code>$1</code>');
  // Links
  res = res.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  return res;
}

function htmlToMarkdown(html: string): string {
  let md = html;
  // Replace headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  // Replace inline tags
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  // Replace lists and blockquotes
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  return unescapeHtml(md.trim());
}

// --- PLAIN TEXT / RTF / LATEX HELPERS ---
function htmlToPlainText(html: string): string {
  let txt = html;
  txt = txt.replace(/<br\s*\/?>/gi, '\n');
  txt = txt.replace(/<\/p>/gi, '\n\n');
  txt = txt.replace(/<\/h[1-6]>/gi, '\n\n');
  txt = txt.replace(/<\/li>/gi, '\n');
  txt = txt.replace(/<[^>]+>/g, '');
  return unescapeHtml(txt.trim());
}

function rtfToHtml(rtf: string): string {
  let text = rtf.replace(/\\[a-z0-9\-]+\s?/gi, ''); // Strip control words
  text = text.replace(/[{}]/g, '').trim();
  return `<p>${escapeHtml(text)}</p>`;
}

function htmlToRtf(html: string): string {
  const plain = htmlToPlainText(html);
  const rtfEscaped = plain.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
  return `{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\n\\f0\\fs24 ${rtfEscaped.replace(/\n/g, '\\par\n')}}`;
}

function latexToHtml(tex: string): string {
  let body = tex;
  const docIdx = tex.indexOf('\\begin{document}');
  if (docIdx >= 0) {
    const endIdx = tex.indexOf('\\end{document}');
    body = tex.slice(docIdx + 16, endIdx >= 0 ? endIdx : undefined);
  }

  body = body.replace(/\\section\{(.*?)\}/g, '<h1>$1</h1>');
  body = body.replace(/\\subsection\{(.*?)\}/g, '<h2>$1</h2>');
  body = body.replace(/\\textbf\{(.*?)\}/g, '<strong>$1</strong>');
  body = body.replace(/\\textit\{(.*?)\}/g, '<em>$1</em>');
  body = body.replace(/\\\\/g, '<br/>');

  return `<p>${escapeHtml(body.trim())}</p>`;
}

function htmlToLatex(html: string): string {
  const plain = htmlToPlainText(html);
  const lines: string[] = [
    '\\documentclass{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\begin{document}',
    '',
    plain.replace(/\\/g, '\\textbackslash ').replace(/([#$%&__{}])\)/g, '\\$1'),
    '',
    '\\end{document}',
  ];
  return lines.join('\n');
}

function formatFullHtmlPage(bodyContent: string, options: ConversionOptions): string {
  const pageSize = options.pageSize || 'A4';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document (${pageSize})</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
    h1, h2, h3 { color: #111; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #282c34; color: #abb2bf; padding: 15px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 4px solid #0066cc; margin: 0; padding-left: 15px; color: #555; }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}
