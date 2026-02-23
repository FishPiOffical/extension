// 命名空间前缀：避免和站点自己的 localStorage key 冲突
const PREFIX = "__GM__:";

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