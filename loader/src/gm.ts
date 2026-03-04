// 命名空间前缀：避免和站点自己的 localStorage key 冲突
const PREFIX = "__GM__:";

interface GM_MenuCommand {
  name: string;
  fn: Function;
  accessKey?: string;
  group?: string;
}

const menuCommands: GM_MenuCommand[] = [];
let ballEl: HTMLElement | null = null;
let menuListEl: HTMLElement | null = null;

// 可选：按“脚本名”做隔离（你可以改成固定字符串或从 meta 里读）
const SCRIPT_NS = "default-script";
const nsKey = (key: string) => `${PREFIX}${SCRIPT_NS}:${String(key)}`;

function safeParse(json: any) {
  try { return JSON.parse(json); } catch { return undefined; }
}

// GM_setValue(key, value)
// 支持：string/number/boolean/object/array/null
export const GM_setValue = function (key: string, value: any) {
  const record = { t: typeof value, v: value };
  localStorage.setItem(nsKey(key), JSON.stringify(record));
};

// GM_getValue(key, defaultValue)
export const GM_getValue = function (key: string, defaultValue: any) {
  const raw = localStorage.getItem(nsKey(key));
  if (raw == null) return defaultValue;

  const record = safeParse(raw);
  if (!record || !("v" in record)) return defaultValue;

  // 这里不强制按 t 做复杂兼容；直接返回 v
  return record.v;
};

// GM_deleteValue(key)
export const GM_deleteValue = function (key: string) {
  localStorage.removeItem(nsKey(key));
};

// GM_listValues() -> string[]
export const GM_listValues = function () {
  const prefix = `${PREFIX}${SCRIPT_NS}:`;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k.slice(prefix.length));
  }
  return keys;
};

// GM_addStyle(css)
export const GM_addStyle = function (css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  return style;
};

function headersToObject(headerStr: string) {
  const out: any = {};
  if (!headerStr) return out;
  headerStr.trim().split(/[\r\n]+/).forEach(line => {
    const idx = line.indexOf(":");
    if (idx > -1) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      // 简单处理重复 header：用逗号拼接
      out[k] = out[k] ? out[k] + ", " + v : v;
    }
  });
  return out;
}

function buildResponse(xhr: any) {
  // GM 的 responseHeaders 是原始字符串，finalUrl 也常见
  const responseHeaders = xhr.getAllResponseHeaders() || "";
  const headers = headersToObject(responseHeaders);

  // XHR 的 responseType 不支持 "json" 时也能用 responseText 手动 parse；这里不强制
  const isTextLike = xhr.responseType === "" || xhr.responseType === "text";
  const responseText = isTextLike ? xhr.responseText : undefined;

  return {
    // 常用字段
    status: xhr.status,
    statusText: xhr.statusText,
    readyState: xhr.readyState,

    // GM 常见字段
    responseHeaders,
    response: xhr.response,     // 可能是 string / ArrayBuffer / Blob / Document
    responseText,               // 仅 text-like 时提供
    responseXML: xhr.responseXML || null,
    finalUrl: xhr.responseURL || "",

    // 额外附送：解析后的 headers（非 GM 标准，但好用）
    headers,
  };
}

/**
 * GM_xmlhttpRequest(details)
 * details:
 *  - method, url, headers, data/body
 *  - timeout, responseType ("", "text", "arraybuffer", "blob", "document", "json"(不标准Xhr))
 *  - overrideMimeType
 *  - onload, onerror, ontimeout, onprogress, onreadystatechange
 *  - withCredentials (类比 GM 的 anonymous=false；anonymous=true => withCredentials=false)
 */
export const GM_xmlhttpRequest = function(details: any) {
  if (!details || !details.url) throw new Error("GM_xmlhttpRequest: details.url is required");

  const method = (details.method || "GET").toUpperCase();
  const xhr = new XMLHttpRequest();

  // open
  xhr.open(method, details.url, true);

  // timeout
  if (typeof details.timeout === "number") xhr.timeout = details.timeout;

  // withCredentials / anonymous
  // 油猴：anonymous=true 通常表示不带 cookie；网页里只能控制 withCredentials
  if (typeof details.anonymous === "boolean") {
    xhr.withCredentials = !details.anonymous;
  } else if (typeof details.withCredentials === "boolean") {
    xhr.withCredentials = details.withCredentials;
  }

  // responseType
  // XHR2 支持: "", "text", "arraybuffer", "blob", "document", "json"(部分浏览器)
  if (details.responseType) {
    try {
      xhr.responseType = details.responseType === "json" ? "text" : details.responseType;
    } catch {
      // 某些环境不允许设置 responseType（比如老浏览器或不支持的类型）
    }
  }

  // overrideMimeType
  if (details.overrideMimeType && xhr.overrideMimeType) {
    xhr.overrideMimeType(details.overrideMimeType);
  }

  // headers
  if (details.headers) {
    for (const [k, v] of Object.entries(details.headers)) {
      try { xhr.setRequestHeader(k, String(v)); } catch {}
    }
  }

  // 事件：尽量模拟 GM 的回调签名 responseObj
  const call = (fn: Function, extra = {}) => {
    if (typeof fn === "function") {
      const res = Object.assign(buildResponse(xhr), extra);
      try { fn(res); } catch (e) { setTimeout(() => { throw e; }); }
    }
  };

  xhr.onreadystatechange = () => call(details.onreadystatechange, {});

  xhr.onprogress = (ev) =>
    call(details.onprogress, { lengthComputable: ev.lengthComputable, loaded: ev.loaded, total: ev.total });

  xhr.onload = () => {
    // 处理 responseType=json 的兼容：我们用 text 拉回来再 parse
    if (details.responseType === "json") {
      const base = buildResponse(xhr);
      let json = null;
      try { json = base.responseText ? JSON.parse(base.responseText) : null; } catch { json = null; }
      call(details.onload, { response: json, responseJSON: json }); // responseJSON 非标准，方便用
      return;
    }
    call(details.onload, {});
  };

  xhr.onerror = () => call(details.onerror, {});
  xhr.ontimeout = () => call(details.ontimeout, {});
  xhr.onabort = () => call(details.onabort, {});

  // send
  const body = ("data" in details) ? details.data : (("body" in details) ? details.body : undefined);
  xhr.send(body);

  // 返回带 abort 的句柄（GM 也会返回一个对象可 abort）
  return {
    abort() { try { xhr.abort(); } catch {} },
    // 方便调试/扩展：暴露原始 xhr
    _xhr: xhr,
  };
};

function injectMenuStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('gm-menu-style')) return;
  const style = document.createElement('style');
  style.id = 'gm-menu-style';
  style.textContent = `
    .gm-floating-ball {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: move;
        z-index: 1000001;
        display: none;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, background-color 0.2s;
        overflow: hidden;
        user-select: none;
        touch-action: none;
    }
    .gm-floating-ball:hover {
        transform: scale(1.1);
        background-color: #f8f9fa;
    }
    .gm-floating-ball img {
        object-fit: contain;
    }
    .gm-menu-list {
        position: fixed;
        bottom: 70px;
        right: 20px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.05);
        z-index: 1000001;
        display: none;
        flex-direction: column;
        min-width: 180px;
        max-width: 320px;
        max-height: calc(100vh - 100px);
        padding: 6px 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        overflow-y: auto;
        border: 1px solid rgba(0,0,0,0.08);
        scrollbar-width: thin;
        transform-origin: bottom right;
    }
    .gm-menu-list.show {
        display: flex;
        animation: gm-menu-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes gm-menu-fade-in {
        from { opacity: 0; transform: translateY(10px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .gm-menu-group {
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 4px;
        margin-bottom: 4px;
    }
    .gm-menu-group:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }
    .gm-menu-group-title {
        padding: 8px 16px 4px;
        font-size: 12px;
        font-weight: 600;
        color: #8c959f;
        pointer-events: none;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .gm-menu-item {
        padding: 10px 20px;
        cursor: pointer;
        transition: background-color 0.15s, color 0.15s;
        color: #1f2328;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .gm-menu-item:hover {
        background-color: #f3f4f6;
        color: #0969da;
    }
    .gm-menu-item:active {
        background-color: #ebeef1;
    }
  `;
  document.head.appendChild(style);
}

function updateMenuUI() {
  if (typeof document === 'undefined') return;
  if (!document.body) {
    window.addEventListener('load', updateMenuUI, { once: true });
    return;
  }
  if (menuCommands.length === 0) return;

  injectMenuStyle();

  if (!ballEl) {
    ballEl = document.createElement('div');
    ballEl.className = 'gm-floating-ball';
    ballEl.title = '脚本菜单';
    ballEl.innerHTML = `<img src="https://fishpi.cn/images/faviconH.png" alt="GM Menu">`;

    // 拖拽移动支持
    let isDragging = false;
    let startX: number, startY: number;
    let initialLeft: number, initialTop: number;

    const savedPos = safeParse(localStorage.getItem('__GM__:menu-ball-pos'));
    if (savedPos) {
      ballEl.style.bottom = 'auto';
      ballEl.style.right = 'auto';
      ballEl.style.left = savedPos.x + 'px';
      ballEl.style.top = savedPos.y + 'px';
    }

    const startDrag = (e: MouseEvent | TouchEvent) => {
      isDragging = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;
      const rect = ballEl!.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      const onDragging = (ev: MouseEvent | TouchEvent) => {
        const curX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
        const curY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
        if (!isDragging && (Math.abs(curX - startX) > 5 || Math.abs(curY - startY) > 5)) {
          isDragging = true;
          ballEl!.style.transition = 'none';
        }
        if (isDragging) {
          let nx = initialLeft + (curX - startX);
          let ny = initialTop + (curY - startY);
          // 边界限制
          nx = Math.max(0, Math.min(window.innerWidth - 40, nx));
          ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
          ballEl!.style.left = nx + 'px';
          ballEl!.style.top = ny + 'px';
          ballEl!.style.bottom = 'auto';
          ballEl!.style.right = 'auto';

          // 更新菜单位置
          if (menuListEl) {
             menuListEl.style.bottom = 'auto';
             menuListEl.style.right = 'auto';
             menuListEl.style.left = Math.max(10, Math.min(window.innerWidth - 190, nx - 140)) + 'px';
             menuListEl.style.top = Math.max(10, Math.min(window.innerHeight - 200, ny - (menuListEl.offsetHeight || 0) - 10)) + 'px';
          }
        }
      };

      const stopDrag = () => {
        document.removeEventListener('mousemove', onDragging);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDragging);
        document.removeEventListener('touchend', stopDrag);
        if (isDragging) {
          ballEl!.style.transition = '';
          const rect = ballEl!.getBoundingClientRect();
          localStorage.setItem('__GM__:menu-ball-pos', JSON.stringify({ x: rect.left, y: rect.top }));
        }
      };

      document.addEventListener('mousemove', onDragging);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', onDragging, { passive: false });
      document.addEventListener('touchend', stopDrag);
    };

    ballEl.addEventListener('mousedown', startDrag);
    ballEl.addEventListener('touchstart', startDrag, { passive: false });

    ballEl.onclick = (e) => {
      if (isDragging) return;
      e.stopPropagation();
      if (menuListEl) {
        const isShow = menuListEl.classList.toggle('show');
        if (isShow) {
           const rect = ballEl!.getBoundingClientRect();
           menuListEl.style.bottom = 'auto';
           menuListEl.style.right = 'auto';
           // 尽量在球的正上方或合适位置
           let left = rect.left - 140;
           let top = rect.top - (menuListEl.offsetHeight || 0) - 10;
           if (left < 10) left = 10;
           if (top < 10) top = rect.bottom + 10;
           if (left + 180 > window.innerWidth) left = window.innerWidth - 190;
           
           menuListEl.style.left = left + 'px';
           menuListEl.style.top = top + 'px';
        }
      }
    };
    document.body.appendChild(ballEl);

    document.addEventListener('click', () => {
      menuListEl?.classList.remove('show');
    });
  }

  if (!menuListEl) {
    menuListEl = document.createElement('div');
    menuListEl.className = 'gm-menu-list';
    menuListEl.onclick = (e) => e.stopPropagation();
    document.body.appendChild(menuListEl);
  }

  ballEl.style.display = 'flex';
  menuListEl.innerHTML = '';
  const groups: Record<string, GM_MenuCommand[]> = {};
  menuCommands.forEach(cmd => {
    const g = cmd.group || '';
    if (!groups[g]) groups[g] = [];
    groups[g].push(cmd);
  });

  const sortedGroups = Object.keys(groups).sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b);
  });

  for (const groupName of sortedGroups) {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'gm-menu-group';
    
    if (groupName !== '') {
      const gTitleEl = document.createElement('div');
      gTitleEl.className = 'gm-menu-group-title';
      gTitleEl.textContent = groupName;
      groupContainer.appendChild(gTitleEl);
    }

    for (const cmd of groups[groupName]) {
      const itemEl = document.createElement('div');
      itemEl.className = 'gm-menu-item';
      itemEl.textContent = cmd.name;
      itemEl.title = cmd.name;
      itemEl.onclick = () => {
        cmd.fn();
        menuListEl?.classList.remove('show');
      };
      groupContainer.appendChild(itemEl);
    }
    menuListEl.appendChild(groupContainer);
  }
}

export const GM_registerMenuCommand = function (name: string, fn: any, accessKey?: string, group?: string) {
  menuCommands.push({ name, fn, accessKey, group });
  updateMenuUI();
};