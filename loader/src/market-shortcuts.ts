export interface MarketItem {
  id: number;
  name: string;
  type: string;
  isEnabled: boolean;
}

interface ApiEnvelope<T> {
  code?: number;
  data?: T;
  msg?: string;
}

interface MarketShortcutOptions {
  apiKey: string;
  apiOrigin: string;
}

const MARKET_ENTRY_ORIGIN = 'https://ext.adventext.fun';
const MARKET_ENTRY_LABEL = '插件市场';
const HOST_ID = 'fishpi-market-shortcuts';
const BOUND_ATTRIBUTE = 'data-fishpi-market-shortcuts';

export function isMarketEntry(href: string | null, ariaLabel: string | null): boolean {
  if (ariaLabel !== MARKET_ENTRY_LABEL || !href) return false;

  try {
    const url = new URL(href, 'https://fishpi.cn');
    return url.origin === MARKET_ENTRY_ORIGIN && (url.pathname === '/' || url.pathname === '');
  } catch {
    return false;
  }
}

export function filterAndSortMarketItems(items: MarketItem[]): MarketItem[] {
  return items
    .filter(item => item.type === 'extension' || item.type === 'theme')
    .sort((a, b) => {
      if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
}

export function parseApiResponse<T>(response: ApiEnvelope<T>): T {
  if (response.code !== undefined && response.code !== 0) {
    throw new Error(response.msg || '请求失败');
  }
  if (response.data === undefined) throw new Error('响应无效');
  return response.data;
}

function supportsShortcutPanel(): boolean {
  return location.hostname === 'fishpi.cn'
    && window.innerWidth > 768
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function setupMarketShortcuts({ apiKey, apiOrigin }: MarketShortcutOptions): void {
  if (!apiKey || !supportsShortcutPanel() || document.getElementById(HOST_ID)) return;
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setupMarketShortcuts({ apiKey, apiOrigin }), { once: true });
    return;
  }

  let accessToken = '';
  let panelOpen = false;
  let openTimer: number | undefined;
  let closeTimer: number | undefined;
  let requestVersion = 0;
  let items: MarketItem[] = [];
  let currentEntry: HTMLAnchorElement | null = null;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        position: fixed;
        z-index: 1000002;
        display: none;
        width: min(340px, calc(100vw - 24px));
        color: #24292f;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }
      :host(.open) { display: block; }
      .panel {
        overflow: hidden;
        background: #fff;
        border: 1px solid rgba(27, 31, 36, .15);
        border-radius: 8px;
        box-shadow: 0 12px 32px rgba(27, 31, 36, .18);
      }
      .status {
        display: none;
        padding: 8px 12px;
        border-bottom: 1px solid #d8dee4;
        color: #57606a;
        font-size: 12px;
      }
      .status.show { display: block; }
      .list { max-height: min(420px, calc(100vh - 100px)); overflow-y: auto; }
      .state {
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6e7781;
      }
      .item {
        min-height: 54px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto 28px;
        align-items: center;
        gap: 10px;
        padding: 8px 10px 8px 12px;
        border-bottom: 1px solid #d8dee4;
      }
      .item:last-child { border-bottom: 0; }
      .info { min-width: 0; }
      .name {
        overflow: hidden;
        color: #24292f;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .type { margin-top: 2px; color: #6e7781; font-size: 12px; }
      .switch { position: relative; width: 34px; height: 20px; display: inline-block; }
      .switch input { position: absolute; opacity: 0; pointer-events: none; }
      .slider {
        position: absolute;
        inset: 0;
        cursor: pointer;
        border-radius: 10px;
        background: #8c959f;
        transition: background .15s;
      }
      .slider::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        transition: transform .15s;
      }
      input:checked + .slider { background: #1f883d; }
      input:checked + .slider::after { transform: translateX(14px); }
      input:focus-visible + .slider { outline: 2px solid #0969da; outline-offset: 2px; }
      input:disabled + .slider { cursor: wait; opacity: .6; }
      .detail {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        color: #57606a;
        text-decoration: none;
      }
      .detail:hover { background: #f3f4f6; color: #0969da; }
      .detail:focus-visible { outline: 2px solid #0969da; outline-offset: 1px; }
      .detail svg { width: 16px; height: 16px; fill: currentColor; }
      @media (prefers-color-scheme: dark) {
        :host { color: #e6edf3; }
        .panel { background: #161b22; border-color: #30363d; }
        .status, .item { border-color: #30363d; }
        .status, .state, .type, .detail { color: #8b949e; }
        .name { color: #e6edf3; }
        .detail:hover { background: #21262d; color: #58a6ff; }
      }
    </style>
    <div class="panel" role="dialog" aria-label="插件列表">
      <div class="status" role="status"></div>
      <div class="list"><div class="state">加载中</div></div>
    </div>
  `;
  document.body.appendChild(host);

  const listElement = shadow.querySelector<HTMLElement>('.list')!;
  const statusElement = shadow.querySelector<HTMLElement>('.status')!;

  function showStatus(message: string): void {
    statusElement.textContent = message;
    statusElement.classList.toggle('show', Boolean(message));
  }

  function showState(message: string): void {
    listElement.innerHTML = '';
    const state = document.createElement('div');
    state.className = 'state';
    state.textContent = message;
    listElement.appendChild(state);
  }

  async function readJson<T>(response: Response): Promise<T> {
    const payload = await response.json() as ApiEnvelope<T>;
    if (!response.ok) throw new Error(payload.msg || '请求失败');
    return parseApiResponse(payload);
  }

  async function authenticate(): Promise<string> {
    const response = await fetch(`${apiOrigin}/api/auth/getToken`, {
      headers: { 'fishpi-key': apiKey },
    });
    const auth = await readJson<{ access_token: string }>(response);
    if (!auth.access_token) throw new Error('登录失败');
    accessToken = auth.access_token;
    return accessToken;
  }

  async function authorizedFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (!accessToken) await authenticate();
    const response = await fetch(`${apiOrigin}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (response.status === 401 && retry) {
      accessToken = '';
      await authenticate();
      return authorizedFetch<T>(path, init, false);
    }
    return readJson<T>(response);
  }

  function itemTypeLabel(type: string): string {
    return type === 'theme' ? '主题' : '扩展';
  }

  function renderItems(): void {
    listElement.innerHTML = '';
    if (items.length === 0) {
      showState('暂无已购作品');
      return;
    }

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'item';

      const info = document.createElement('div');
      info.className = 'info';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = item.name;
      name.title = item.name;
      const type = document.createElement('div');
      type.className = 'type';
      type.textContent = itemTypeLabel(item.type);
      info.append(name, type);

      const toggle = document.createElement('label');
      toggle.className = 'switch';
      toggle.title = item.isEnabled ? '禁用' : '启用';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = item.isEnabled;
      input.setAttribute('role', 'switch');
      input.setAttribute('aria-label', `${item.name}${item.isEnabled ? '禁用' : '启用'}`);
      const slider = document.createElement('span');
      slider.className = 'slider';
      toggle.append(input, slider);

      const detail = document.createElement('a');
      detail.className = 'detail';
      detail.href = `${apiOrigin}/item/${item.id}`;
      detail.target = '_blank';
      detail.rel = 'noopener noreferrer';
      detail.title = '详情';
      detail.setAttribute('aria-label', `${item.name}详情`);
      detail.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"/></svg>';

      input.addEventListener('change', async () => {
        const nextState = input.checked;
        input.disabled = true;
        showStatus('');
        try {
          const result = await authorizedFetch<{ isEnabled: boolean }>(`/api/items/${item.id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isEnabled: nextState }),
          });
          item.isEnabled = result.isEnabled;
          items = filterAndSortMarketItems(items);
          renderItems();
          showStatus(`${item.isEnabled ? '已启用' : '已禁用'}，刷新生效`);
        } catch {
          input.checked = item.isEnabled;
          input.disabled = false;
          showStatus('操作失败');
        }
      });

      row.append(info, toggle, detail);
      listElement.appendChild(row);
    }
  }

  function positionPanel(): void {
    if (!panelOpen || !currentEntry?.isConnected) return;
    const rect = currentEntry.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
    const top = Math.min(window.innerHeight - 12, rect.bottom + 8);
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  async function loadItems(version: number): Promise<void> {
    showStatus('');
    showState('加载中');
    try {
      const result = await authorizedFetch<MarketItem[]>('/api/items/my-purchases');
      if (!panelOpen || version !== requestVersion) return;
      items = filterAndSortMarketItems(Array.isArray(result) ? result : []);
      renderItems();
    } catch {
      if (!panelOpen || version !== requestVersion) return;
      showState('加载失败');
      window.setTimeout(closePanel, 600);
    }
  }

  function openPanel(entry: HTMLAnchorElement): void {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    currentEntry = entry;
    if (panelOpen) return;
    panelOpen = true;
    host.classList.add('open');
    positionPanel();
    requestVersion += 1;
    void loadItems(requestVersion);
  }

  function closePanel(): void {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    if (!panelOpen) return;
    panelOpen = false;
    requestVersion += 1;
    host.classList.remove('open');
    currentEntry = null;
  }

  function scheduleOpen(entry: HTMLAnchorElement): void {
    window.clearTimeout(closeTimer);
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => openPanel(entry), 250);
  }

  function scheduleClose(): void {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(closePanel, 150);
  }

  function bindEntry(entry: HTMLAnchorElement): void {
    if (entry.hasAttribute(BOUND_ATTRIBUTE)) return;
    entry.setAttribute(BOUND_ATTRIBUTE, 'true');
    entry.addEventListener('mouseenter', () => scheduleOpen(entry));
    entry.addEventListener('mouseleave', scheduleClose);
    entry.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      openPanel(entry);
    });
  }

  function findAndBindEntries(): void {
    if (panelOpen && !currentEntry?.isConnected) closePanel();
    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(entry => {
      if (isMarketEntry(entry.href, entry.getAttribute('aria-label'))) bindEntry(entry);
    });
  }

  host.addEventListener('mouseenter', () => window.clearTimeout(closeTimer));
  host.addEventListener('mouseleave', scheduleClose);
  document.addEventListener('pointerdown', event => {
    if (!panelOpen || host.contains(event.target as Node) || currentEntry?.contains(event.target as Node)) return;
    closePanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePanel();
  });
  window.addEventListener('resize', () => {
    if (!supportsShortcutPanel()) closePanel();
    else positionPanel();
  });
  window.addEventListener('scroll', positionPanel, true);

  findAndBindEntries();
  const observer = new MutationObserver(findAndBindEntries);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
