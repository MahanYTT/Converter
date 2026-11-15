import type { FormatCategory } from '../../shared/types.ts';

export interface ClientFormatInfo {
  id: string;
  label: string;
  name: string;
  category: FormatCategory | string;
  description?: string;
  extensions?: readonly string[];
  mimeType?: string;
}

export type PickerCategoryTab = 'all' | 'image' | 'audio' | 'document' | 'data' | 'archive';

export interface PickerTabDefinition {
  id: PickerCategoryTab;
  label: string;
}

export const PICKER_CATEGORY_TABS: readonly PickerTabDefinition[] = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
  { id: 'document', label: 'Document' },
  { id: 'data', label: 'Data' },
  { id: 'archive', label: 'Archive' },
] as const;

export type FormatSelectHandler = (itemId: string, targetFormatId: string) => void;

const formatRegistryByItem = new Map<string, ClientFormatInfo[]>();
const containerAbortControllers = new WeakMap<HTMLElement, AbortController>();

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizePickerCategory(category: string): PickerCategoryTab {
  const normalized = category.trim().toLowerCase();
  switch (normalized) {
    case 'image':
    case 'vector':
      return 'image';
    case 'audio':
      return 'audio';
    case 'document':
    case 'ebook':
      return 'document';
    case 'data':
      return 'data';
    case 'archive':
      return 'archive';
    default:
      return 'all';
  }
}

export function filterPickerFormats(
  formats: readonly ClientFormatInfo[],
  query: string,
  category: PickerCategoryTab = 'all',
): ClientFormatInfo[] {
  const q = query.trim().toLowerCase();

  return formats.filter((fmt) => {
    if (category !== 'all' && normalizePickerCategory(fmt.category) !== category) {
      return false;
    }

    if (!q) return true;

    const inId = fmt.id.toLowerCase().includes(q);
    const inLabel = fmt.label.toLowerCase().includes(q);
    const inName = fmt.name.toLowerCase().includes(q);
    const inDesc = (fmt.description ?? '').toLowerCase().includes(q);
    const inExt = (fmt.extensions ?? []).some((ext) => ext.toLowerCase().includes(q));
    return inId || inLabel || inName || inDesc || inExt;
  });
}

function serializeFormatsAttribute(formats: readonly ClientFormatInfo[]): string {
  const compact = formats.map((f) => ({
    id: f.id,
    label: f.label,
    name: f.name,
    category: f.category,
    description: f.description ?? f.name,
    extensions: f.extensions ?? [f.id],
  }));
  return escapeHtml(JSON.stringify(compact));
}

function parseFormatsAttribute(raw: string | undefined): ClientFormatInfo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ClientFormatInfo =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ClientFormatInfo).id === 'string' &&
        typeof (item as ClientFormatInfo).label === 'string',
    );
  } catch {
    return [];
  }
}

export function createFormatPickerTriggerHtml(
  itemId: string,
  currentTargetId: string,
  compatibleFormats: ClientFormatInfo[],
): string {
  formatRegistryByItem.set(itemId, [...compatibleFormats]);

  const normalizedCurrent = currentTargetId.trim().toLowerCase();
  const currentFmt = compatibleFormats.find((f) => f.id.toLowerCase() === normalizedCurrent);
  const displayLabel = currentFmt?.label ?? (currentTargetId ? currentTargetId.toUpperCase() : 'SELECT');
  const displayTitle = currentFmt ? `${currentFmt.label} — ${currentFmt.name}` : `Output format: ${displayLabel}`;

  return `
    <div class="format-picker-wrap" data-format-picker-wrap data-item-id="${escapeHtml(itemId)}">
      <button
        type="button"
        class="format-picker-trigger"
        data-action="open-format-picker"
        data-id="${escapeHtml(itemId)}"
        data-item-id="${escapeHtml(itemId)}"
        data-target-id="${escapeHtml(normalizedCurrent)}"
        data-formats="${serializeFormatsAttribute(compatibleFormats)}"
        aria-haspopup="listbox"
        aria-expanded="false"
        title="${escapeHtml(displayTitle)}"
      >
        <span class="format-picker-trigger-label">${escapeHtml(displayLabel)}</span>
        <svg class="format-picker-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>
  `.trim();
}

export class FormatPickerPopover {
  private popoverEl: HTMLElement | null = null;
  private activeTrigger: HTMLElement | null = null;
  private activeItemId: string | null = null;
  private currentTargetId = '';
  private formats: ClientFormatInfo[] = [];
  private searchQuery = '';
  private activeCategory: PickerCategoryTab = 'all';
  private activeOptionIndex = 0;
  private onSelectCallback: FormatSelectHandler | null = null;
  private globalAbortController: AbortController | null = null;

  isOpen(): boolean {
    return this.popoverEl !== null && !this.popoverEl.classList.contains('hidden');
  }

  getActiveItemId(): string | null {
    return this.activeItemId;
  }

  open(
    triggerEl: HTMLElement,
    itemId: string,
    currentTargetId: string,
    formats: readonly ClientFormatInfo[],
    onSelect: FormatSelectHandler,
  ): void {
    if (typeof document === 'undefined') return;

    if (this.isOpen() && this.activeItemId === itemId && this.activeTrigger === triggerEl) {
      this.close();
      return;
    }

    this.close();

    this.activeTrigger = triggerEl;
    this.activeItemId = itemId;
    this.currentTargetId = currentTargetId.trim().toLowerCase();
    this.formats = [...formats];
    this.searchQuery = '';
    this.activeCategory = 'all';
    this.activeOptionIndex = Math.max(
      0,
      this.formats.findIndex((f) => f.id.toLowerCase() === this.currentTargetId),
    );
    this.onSelectCallback = onSelect;

    triggerEl.setAttribute('aria-expanded', 'true');
    triggerEl.classList.add('is-open');

    const popover = this.buildPopoverElement();
    this.popoverEl = popover;
    document.body.appendChild(popover);

    this.renderCategories();
    this.renderGrid();
    this.positionPopover();
    this.bindGlobalEvents();

    const searchInput = popover.querySelector<HTMLInputElement>('.format-picker-search');
    if (searchInput) {
      requestAnimationFrame(() => searchInput.focus({ preventScroll: true }));
    }
  }

  close(restoreFocus = false): void {
    if (this.globalAbortController) {
      this.globalAbortController.abort();
      this.globalAbortController = null;
    }

    const prevTrigger = this.activeTrigger;
    if (prevTrigger) {
      prevTrigger.setAttribute('aria-expanded', 'false');
      prevTrigger.classList.remove('is-open');
    }

    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
    }

    this.activeTrigger = null;
    this.activeItemId = null;
    this.onSelectCallback = null;

    if (restoreFocus && prevTrigger && prevTrigger.isConnected) {
      prevTrigger.focus({ preventScroll: true });
    }
  }

  destroy(): void {
    this.close(false);
  }

  private buildPopoverElement(): HTMLElement {
    const popover = document.createElement('div');
    popover.className = 'format-picker-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Select output format');

    popover.innerHTML = `
      <div class="format-picker-search-wrap">
        <svg class="format-picker-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="search"
          class="format-picker-search"
          placeholder="Search format... e.g. WEBP, MP3, JSON"
          aria-label="Search target format"
          autocomplete="off"
          spellcheck="false"
        />
        <kbd class="format-picker-kbd" aria-hidden="true">ESC</kbd>
      </div>
      <div class="format-picker-tabs" role="tablist" aria-label="Format categories"></div>
      <div class="format-picker-grid" role="listbox" aria-label="Compatible output formats"></div>
      <div class="format-picker-footer">
        <span class="format-picker-desc-title"></span>
        <span class="format-picker-desc-body">Hover a format to inspect details</span>
      </div>
    `;

    const searchInput = popover.querySelector<HTMLInputElement>('.format-picker-search');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.activeOptionIndex = 0;
      this.renderGrid();
    });

    searchInput?.addEventListener('keydown', (e) => {
      this.handleKeyNavigation(e);
    });

    popover.addEventListener('keydown', (e) => {
      if (e.target !== searchInput) {
        this.handleKeyNavigation(e);
      }
    });

    const tabsEl = popover.querySelector<HTMLElement>('.format-picker-tabs');
    tabsEl?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.format-picker-tab');
      if (!btn || btn.disabled) return;
      const cat = btn.dataset.category as PickerCategoryTab | undefined;
      if (!cat) return;
      this.activeCategory = cat;
      this.activeOptionIndex = 0;
      this.renderCategories();
      this.renderGrid();
    });

    const gridEl = popover.querySelector<HTMLElement>('.format-picker-grid');
    gridEl?.addEventListener('click', (e) => {
      const option = (e.target as HTMLElement).closest<HTMLButtonElement>('.format-picker-option');
      if (!option) return;
      const formatId = option.dataset.formatId;
      if (!formatId) return;
      this.commitSelection(formatId);
    });

    gridEl?.addEventListener('mouseover', (e) => {
      const option = (e.target as HTMLElement).closest<HTMLButtonElement>('.format-picker-option');
      if (!option) return;
      const formatId = option.dataset.formatId;
      if (formatId) this.updateFooterPreview(formatId);
    });

    gridEl?.addEventListener('focusin', (e) => {
      const option = (e.target as HTMLElement).closest<HTMLButtonElement>('.format-picker-option');
      if (!option) return;
      const formatId = option.dataset.formatId;
      if (formatId) this.updateFooterPreview(formatId);
    });

    return popover;
  }

  private renderCategories(): void {
    const tabsEl = this.popoverEl?.querySelector<HTMLElement>('.format-picker-tabs');
    if (!tabsEl) return;

    tabsEl.innerHTML = PICKER_CATEGORY_TABS.map((tab) => {
      const count =
        tab.id === 'all'
          ? this.formats.length
          : this.formats.filter((f) => normalizePickerCategory(f.category) === tab.id).length;
      const isActive = this.activeCategory === tab.id;
      const isDisabled = tab.id !== 'all' && count === 0;

      return `
        <button
          type="button"
          class="format-picker-tab ${isActive ? 'is-active' : ''}"
          role="tab"
          aria-selected="${isActive ? 'true' : 'false'}"
          data-category="${tab.id}"
          ${isDisabled ? 'disabled' : ''}
        >
          <span>${escapeHtml(tab.label)}</span>
          ${count > 0 && tab.id !== 'all' ? `<span class="format-picker-tab-count">${count}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  private renderGrid(): void {
    const gridEl = this.popoverEl?.querySelector<HTMLElement>('.format-picker-grid');
    if (!gridEl) return;

    const filtered = filterPickerFormats(this.formats, this.searchQuery, this.activeCategory);

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="format-picker-empty">
          No formats match <strong>${escapeHtml(this.searchQuery || this.activeCategory)}</strong>
        </div>
      `;
      this.updateFooterPreview(null);
      return;
    }

    if (this.activeOptionIndex >= filtered.length) {
      this.activeOptionIndex = 0;
    }

    gridEl.innerHTML = filtered
      .map((fmt, idx) => {
        const isSelected = fmt.id.toLowerCase() === this.currentTargetId;
        const isFocused = idx === this.activeOptionIndex;
        const desc = fmt.description ?? fmt.name;
        return `
          <button
            type="button"
            class="format-picker-option ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-highlighted' : ''}"
            role="option"
            aria-selected="${isSelected ? 'true' : 'false'}"
            data-format-id="${escapeHtml(fmt.id)}"
            title="${escapeHtml(`${fmt.name} — ${desc}`)}"
          >
            <span class="format-picker-option-top">
              <span class="format-picker-ext">${escapeHtml(fmt.label)}</span>
              ${
                isSelected
                  ? `<svg class="format-picker-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                  : ''
              }
            </span>
            <span class="format-picker-option-hint">${escapeHtml(desc)}</span>
          </button>
        `;
      })
      .join('');

    const previewTarget =
      filtered[this.activeOptionIndex]?.id ??
      filtered.find((f) => f.id.toLowerCase() === this.currentTargetId)?.id ??
      filtered[0]?.id ??
      null;
    this.updateFooterPreview(previewTarget);
  }

  private updateFooterPreview(formatId: string | null): void {
    const titleEl = this.popoverEl?.querySelector<HTMLElement>('.format-picker-desc-title');
    const bodyEl = this.popoverEl?.querySelector<HTMLElement>('.format-picker-desc-body');
    if (!titleEl || !bodyEl) return;

    if (!formatId) {
      titleEl.textContent = '';
      bodyEl.textContent = 'Try another keyword or switch to All';
      return;
    }

    const fmt = this.formats.find((f) => f.id.toLowerCase() === formatId.toLowerCase());
    if (!fmt) return;

    titleEl.textContent = fmt.name;
    bodyEl.textContent = fmt.description || `${fmt.label} output format`;
  }

  private handleKeyNavigation(e: KeyboardEvent): void {
    if (!this.popoverEl) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close(true);
      return;
    }

    const options = Array.from(
      this.popoverEl.querySelectorAll<HTMLButtonElement>('.format-picker-option'),
    );
    if (options.length === 0) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 3 : 1;
      this.activeOptionIndex = Math.min(options.length - 1, this.activeOptionIndex + step);
      this.syncHighlightedOption(options);
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowUp' ? 3 : 1;
      this.activeOptionIndex = Math.max(0, this.activeOptionIndex - step);
      this.syncHighlightedOption(options);
      return;
    }

    if (e.key === 'Enter') {
      const targetOption = options[this.activeOptionIndex] ?? options[0];
      const formatId = targetOption?.dataset.formatId;
      if (formatId) {
        e.preventDefault();
        this.commitSelection(formatId);
      }
    }
  }

  private syncHighlightedOption(options: HTMLButtonElement[]): void {
    options.forEach((opt, i) => {
      opt.classList.toggle('is-highlighted', i === this.activeOptionIndex);
    });
    const active = options[this.activeOptionIndex];
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
      const fmtId = active.dataset.formatId;
      if (fmtId) this.updateFooterPreview(fmtId);
    }
  }

  private commitSelection(targetFormatId: string): void {
    const itemId = this.activeItemId;
    const trigger = this.activeTrigger;
    const cb = this.onSelectCallback;

    if (trigger) {
      const fmt = this.formats.find((f) => f.id.toLowerCase() === targetFormatId.toLowerCase());
      const labelEl = trigger.querySelector<HTMLElement>('.format-picker-trigger-label');
      if (labelEl && fmt) {
        labelEl.textContent = fmt.label;
      }
      trigger.dataset.targetId = targetFormatId;

      const wrap = trigger.closest('.format-picker-wrap');
      const siblingSelect = wrap?.parentElement?.querySelector<HTMLSelectElement>(
        `select[data-action="target"][data-id="${itemId ?? ''}"]`,
      );
      if (siblingSelect && siblingSelect.value !== targetFormatId) {
        siblingSelect.value = targetFormatId;
      }
    }

    this.close(true);

    if (itemId && cb) {
      cb(itemId, targetFormatId);
    }
  }

  private positionPopover(): void {
    if (!this.popoverEl || !this.activeTrigger) return;

    const triggerRect = this.activeTrigger.getBoundingClientRect();
    const popRect = this.popoverEl.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 6;
    const margin = 12;

    const popWidth = Math.min(popRect.width || 360, viewportW - margin * 2);
    const popHeight = popRect.height || 340;

    let left = triggerRect.left;
    if (left + popWidth > viewportW - margin) {
      left = Math.max(margin, triggerRect.right - popWidth);
    }
    left = Math.max(margin, Math.min(left, viewportW - popWidth - margin));

    const spaceBelow = viewportH - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;

    let top: number;
    if (spaceBelow >= popHeight || spaceBelow >= spaceAbove) {
      top = Math.min(triggerRect.bottom + gap, viewportH - popHeight - margin);
      this.popoverEl.dataset.placement = 'bottom';
    } else {
      top = Math.max(margin, triggerRect.top - popHeight - gap);
      this.popoverEl.dataset.placement = 'top';
    }

    this.popoverEl.style.left = `${Math.round(left)}px`;
    this.popoverEl.style.top = `${Math.round(top)}px`;
  }

  private bindGlobalEvents(): void {
    this.globalAbortController = new AbortController();
    const { signal } = this.globalAbortController;

    document.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target as Node | null;
        if (!target) return;
        if (this.popoverEl?.contains(target)) return;
        if (this.activeTrigger?.contains(target)) return;
        this.close(false);
      },
      { capture: true, signal },
    );

    window.addEventListener(
      'resize',
      () => {
        if (!this.activeTrigger?.isConnected) {
          this.close(false);
          return;
        }
        this.positionPopover();
      },
      { signal },
    );

    window.addEventListener(
      'scroll',
      (e) => {
        if (this.popoverEl && e.target instanceof Node && this.popoverEl.contains(e.target)) {
          return;
        }
        if (!this.activeTrigger?.isConnected) {
          this.close(false);
          return;
        }
        this.positionPopover();
      },
      { capture: true, signal },
    );
  }
}

const sharedPopover = new FormatPickerPopover();

export function attachFormatPickerListeners(
  container: HTMLElement,
  onSelect: FormatSelectHandler,
): void {
  const prev = containerAbortControllers.get(container);
  if (prev) {
    prev.abort();
  }

  const controller = new AbortController();
  containerAbortControllers.set(container, controller);

  container.addEventListener(
    'click',
    (e) => {
      const trigger = (e.target as HTMLElement).closest<HTMLButtonElement>(
        '[data-action="open-format-picker"], .format-picker-trigger',
      );
      if (!trigger || !container.contains(trigger)) return;
      if (trigger.disabled || trigger.getAttribute('aria-disabled') === 'true') return;

      const itemId = trigger.dataset.itemId ?? trigger.dataset.id ?? '';
      if (!itemId) return;

      const currentTargetId = trigger.dataset.targetId ?? '';
      const formats =
        formatRegistryByItem.get(itemId) ?? parseFormatsAttribute(trigger.dataset.formats);

      sharedPopover.open(trigger, itemId, currentTargetId, formats, onSelect);
    },
    { signal: controller.signal },
  );
}

export function closeActiveFormatPicker(): void {
  sharedPopover.close(false);
}
