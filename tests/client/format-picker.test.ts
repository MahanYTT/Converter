import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CLIENT_FORMATS, getCompatibleTargets } from '../../src/client/router/format-catalog.ts';
import {
  FormatPickerPopover,
  PICKER_CATEGORY_TABS,
  attachFormatPickerListeners,
  createFormatPickerTriggerHtml,
  filterPickerFormats,
  normalizePickerCategory,
  type ClientFormatInfo,
} from '../../src/client/ui/format-picker.ts';

describe('FormatPicker pure helpers', () => {
  it('exposes the required category tabs in order', () => {
    assert.deepEqual(
      PICKER_CATEGORY_TABS.map((t) => t.label),
      ['All', 'Image', 'Audio', 'Document', 'Data', 'Archive'],
    );
  });

  it('normalizes format categories including vector and ebook', () => {
    assert.equal(normalizePickerCategory('image'), 'image');
    assert.equal(normalizePickerCategory('vector'), 'image');
    assert.equal(normalizePickerCategory('audio'), 'audio');
    assert.equal(normalizePickerCategory('document'), 'document');
    assert.equal(normalizePickerCategory('ebook'), 'document');
    assert.equal(normalizePickerCategory('data'), 'data');
    assert.equal(normalizePickerCategory('archive'), 'archive');
  });

  it('filters formats by query and category', () => {
    const sample: ClientFormatInfo[] = [...CLIENT_FORMATS];

    const webpResults = filterPickerFormats(sample, 'webp', 'all');
    assert.equal(webpResults.length, 1);
    assert.equal(webpResults[0].id, 'webp');

    const jpegAlias = filterPickerFormats(sample, 'jpeg', 'image');
    assert.ok(jpegAlias.some((f) => f.id === 'jpg'));

    const audioOnly = filterPickerFormats(sample, '', 'audio');
    assert.ok(audioOnly.length >= 4);
    assert.ok(audioOnly.every((f) => f.category === 'audio'));

    const dataJson = filterPickerFormats(sample, 'json', 'data');
    assert.ok(dataJson.some((f) => f.id === 'json'));
  });

  it('generates safe escaped trigger HTML compatible with FormatDefinition[]', () => {
    const targets = getCompatibleTargets('png');
    const html = createFormatPickerTriggerHtml('job-"1"', 'webp', targets);

    assert.match(html, /class="format-picker-trigger"/);
    assert.match(html, /data-action="open-format-picker"/);
    assert.match(html, /data-item-id="job-&quot;1&quot;"/);
    assert.match(html, /data-target-id="webp"/);
    assert.match(html, />WEBP</);
    assert.match(html, /aria-haspopup="listbox"/);
  });
});

interface ListenerEntry {
  type: string;
  fn: (event: unknown) => void;
}

function createMinimalDomHarness() {
  class FakeElement {
    tagName: string;
    className = '';
    dataset: Record<string, string> = {};
    attributes = new Map<string, string>();
    style: Record<string, string> = {};
    children: FakeElement[] = [];
    parentElement: FakeElement | null = null;
    textContent = '';
    value = '';
    disabled = false;
    isConnected = true;
    private _innerHTML = '';
    private listeners: ListenerEntry[] = [];

    constructor(tagName: string) {
      this.tagName = tagName.toUpperCase();
    }

    get innerHTML(): string {
      return this._innerHTML;
    }

    set innerHTML(html: string) {
      this._innerHTML = html;
      this.children = [];
      if (html.includes('format-picker-search')) {
        const searchInput = new FakeElement('input');
        searchInput.className = 'format-picker-search';
        this.appendChild(searchInput);

        const tabs = new FakeElement('div');
        tabs.className = 'format-picker-tabs';
        this.appendChild(tabs);

        const grid = new FakeElement('div');
        grid.className = 'format-picker-grid';
        this.appendChild(grid);

        const footer = new FakeElement('div');
        footer.className = 'format-picker-footer';
        const descTitle = new FakeElement('span');
        descTitle.className = 'format-picker-desc-title';
        const descBody = new FakeElement('span');
        descBody.className = 'format-picker-desc-body';
        footer.appendChild(descTitle);
        footer.appendChild(descBody);
        this.appendChild(footer);
      } else if (this.className.includes('format-picker-grid')) {
        const optionMatches = [...html.matchAll(/data-format-id="([^"]+)"/g)];
        for (const match of optionMatches) {
          const btn = new FakeElement('button');
          btn.className = 'format-picker-option';
          btn.dataset.formatId = match[1];
          this.appendChild(btn);
        }
      } else if (this.className.includes('format-picker-tabs')) {
        const tabMatches = [...html.matchAll(/data-category="([^"]+)"/g)];
        for (const match of tabMatches) {
          const btn = new FakeElement('button');
          btn.className = 'format-picker-tab';
          btn.dataset.category = match[1];
          this.appendChild(btn);
        }
      }
    }

    classList = {
      add: (...cls: string[]) => {
        const set = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach((c) => set.add(c));
        this.className = Array.from(set).join(' ');
      },
      remove: (...cls: string[]) => {
        const set = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach((c) => set.delete(c));
        this.className = Array.from(set).join(' ');
      },
      toggle: (c: string, force?: boolean) => {
        const has = this.classList.contains(c);
        const shouldAdd = force ?? !has;
        if (shouldAdd) this.classList.add(c);
        else this.classList.remove(c);
      },
      contains: (c: string) => this.className.split(/\s+/).includes(c),
    };

    appendChild(child: FakeElement): FakeElement {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    remove(): void {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
        this.parentElement = null;
      }
      this.isConnected = false;
    }

    setAttribute(name: string, val: string): void {
      this.attributes.set(name, val);
    }

    getAttribute(name: string): string | null {
      return this.attributes.get(name) ?? null;
    }

    hasAttribute(name: string): boolean {
      return this.attributes.has(name);
    }

    contains(node: unknown): boolean {
      if (node === this) return true;
      return this.children.some((c) => c.contains(node));
    }

    closest(selector: string): FakeElement | null {
      const classes = selector
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('.'))
        .map((s) => s.slice(1));
      let cur: FakeElement | null = this;
      while (cur) {
        if (classes.some((c) => cur!.classList.contains(c))) return cur;
        if (selector.includes('[data-action="open-format-picker"]') && cur.dataset.action === 'open-format-picker') {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    }

    querySelector<T = FakeElement>(selector: string): T | null {
      return (this.querySelectorAll(selector)[0] as unknown as T) ?? null;
    }

    querySelectorAll(selector: string): FakeElement[] {
      const cls = selector.startsWith('.') ? selector.slice(1) : '';
      const out: FakeElement[] = [];
      const walk = (el: FakeElement) => {
        for (const child of el.children) {
          if (cls && child.classList.contains(cls)) out.push(child);
          walk(child);
        }
      };
      walk(this);
      return out;
    }

    addEventListener(type: string, fn: (event: unknown) => void, opts?: { signal?: AbortSignal }): void {
      if (opts?.signal?.aborted) return;
      this.listeners.push({ type, fn });
      opts?.signal?.addEventListener('abort', () => {
        this.listeners = this.listeners.filter((l) => l.fn !== fn);
      });
    }

    dispatchEvent(type: string, eventInit: Record<string, unknown> = {}): void {
      const event = {
        target: this,
        preventDefault: () => {},
        ...eventInit,
      };
      let cur: FakeElement | null = this;
      while (cur) {
        for (const entry of [...cur.listeners]) {
          if (entry.type === type) entry.fn(event);
        }
        cur = cur.parentElement;
      }
    }

    focus(): void {}
    scrollIntoView(): void {}
    getBoundingClientRect() {
      return { left: 100, top: 120, right: 200, bottom: 152, width: 100, height: 32 };
    }
  }

  const body = new FakeElement('body');
  const doc = {
    body,
    createElement: (tag: string) => new FakeElement(tag),
    addEventListener: (type: string, fn: (e: unknown) => void, opts?: { signal?: AbortSignal }) =>
      body.addEventListener(type, fn, opts),
  };
  const win = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
  };

  return { FakeElement, body, doc, win };
}

describe('FormatPickerPopover DOM lifecycle', () => {
  it('opens on trigger click, filters via search, selects option, and cleans up', () => {
    const { FakeElement, body, doc, win } = createMinimalDomHarness();
    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;
    const prevRaf = globalThis.requestAnimationFrame;

    Object.assign(globalThis, {
      document: doc,
      window: win,
      requestAnimationFrame: (cb: () => void) => {
        cb();
        return 1;
      },
    });

    try {
      const container = new FakeElement('div');
      const trigger = new FakeElement('button');
      trigger.className = 'format-picker-trigger';
      trigger.dataset.action = 'open-format-picker';
      trigger.dataset.itemId = 'item-42';
      trigger.dataset.targetId = 'png';
      const labelSpan = new FakeElement('span');
      labelSpan.className = 'format-picker-trigger-label';
      labelSpan.textContent = 'PNG';
      trigger.appendChild(labelSpan);
      container.appendChild(trigger);

      const formats = getCompatibleTargets('png');
      createFormatPickerTriggerHtml('item-42', 'png', formats);

      const selections: Array<{ itemId: string; target: string }> = [];
      attachFormatPickerListeners(container as unknown as HTMLElement, (itemId, target) => {
        selections.push({ itemId, target });
      });

      // Open popover by clicking trigger
      trigger.dispatchEvent('click', { target: trigger });
      const popover = body.querySelector('.format-picker-popover');
      assert.ok(popover, 'popover should mount to document.body');

      // Filter using search input
      const searchInput = popover.querySelector('.format-picker-search')!;
      searchInput.value = 'avif';
      searchInput.dispatchEvent('input', { target: searchInput });

      const options = popover.querySelectorAll('.format-picker-option');
      assert.equal(options.length, 1);
      assert.equal(options[0].dataset.formatId, 'avif');

      // Click the AVIF option
      options[0].dispatchEvent('click', { target: options[0] });
      assert.deepEqual(selections, [{ itemId: 'item-42', target: 'avif' }]);
      assert.equal(body.querySelector('.format-picker-popover'), null, 'popover should close after selection');
      assert.equal(labelSpan.textContent, 'AVIF');

      // Direct FormatPickerPopover instance close/destroy sanity check
      const controller = new FormatPickerPopover();
      controller.open(
        trigger as unknown as HTMLElement,
        'item-42',
        'avif',
        formats,
        () => {},
      );
      assert.equal(controller.isOpen(), true);
      assert.equal(controller.getActiveItemId(), 'item-42');
      controller.destroy();
      assert.equal(controller.isOpen(), false);
    } finally {
      Object.assign(globalThis, {
        document: prevDoc,
        window: prevWin,
        requestAnimationFrame: prevRaf,
      });
    }
  });
});
