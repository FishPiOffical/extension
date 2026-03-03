import Fishpi from 'fishpi/browser';
import * as GM from './gm';
import * as msgbox from './msgbox';
const defaultAllowGlobals = [
  'crypto',
  'console',
  'customElements',
  'devicePixelRatio',
  'fullscreen',
  'history',
  'indexedDB',
  'innerHeight',
  'innerWidth',
  'location',
  'localStorage',
  'name',
  'navigator',
  'origin',
  'outerHeight',
  'outerWidth',
  'pageXOffset',
  'pageYOffset',
  'screen',
  'screenX',
  'screenY',
  'screenLeft',
  'screenTop',
  'sessionStorage',
  'scrollbars',
  'scrollX',
  'scrollY',
  'atob',
  'alert',
  'btoa',
  'cancelAnimationFrame',
  'cancelIdleCallback',
  'fetch',
  'requestAnimationFrame',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'confirm',
  'createImageBitmap',
  'focus',
  'getComputedStyle',
  'getSelection',
  'open',
  'postMessage',
  'prompt',
  'requestIdleCallback',
  'scroll',
  'scrollBy',
  'scrollTo',
  'stop',
  'addEventListener',
  'removeEventListener',
  'Element',
]

function matchUrl(pattern: string, currentHref: string, currentPath: string) {
  const p = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp('^' + p + '$');
  return regex.test(pattern.startsWith('/') ? currentPath : currentHref);
}

function readOnly(obj: any, fields: string[]) {
  // 浅拷贝原始对象
  const newObj = { ...obj };

  // 为指定字段设置只读属性
  fields.forEach(field => {
    if (field in newObj) {
      // 获取原始属性的描述符
      const descriptor = Object.getOwnPropertyDescriptor(newObj, field) || {};
      
      // 设置为只读：writable: false
      // 保持其他特性（如 enumerable, configurable）
      Object.defineProperty(newObj, field, {
        ...descriptor,
        writable: false,
        // 如果没有 setter，可以添加一个抛错误的 setter（但这里用 writable: false 更简单）
      });
    }
  });

  return newObj;
}

function pick(obj: any, fields: string[]) {
    const result: any = {};
    fields.forEach(field => {
      if (obj[field] !== undefined) {
        if (obj[field] instanceof Function) {
          result[field] = obj[field].bind(obj);
        }
        else result[field] = obj[field];
      }
    });
    return result;
}

function clone(obj: any, that: any = new Object()): any {
  if (obj instanceof Function) {
    return obj.bind(that);
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (obj instanceof Array) {
    return obj.map(item => clone(item, obj));
  }
  const clonedObj: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = clone(obj[key], obj);
    }
  }
  return clonedObj;
}

async function activate() {
  // @ts-ignore
  const scriptSrc = new URL(import.meta.url);
  const newWindow: any = pick(window, defaultAllowGlobals);
  const { apiKey } = await fetch('/getApiKeyInWeb').then((r) => r.json())
  newWindow.location = {
    ...readOnly(clone(location, window), ['href', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash']),
    get href() {
      return location.href;
    },
    set href(value) {
      if (!value.startsWith(location.origin) && !value.startsWith('/') && !value.startsWith('.')) {
        console.warn('只能修改为同源地址或者相对路径');
        return;
      }
      location.href = value;
    },
  }
  const jsItems = [`{{#Ids}}`];
  const themeItems = [`{{#Themes}}`];
  const userId = '{{#UserId}}';
  const extensionData = [`{{#ExtensionData}}`] as any[];
  const activationMap = new Map<any, Promise<void>>();

  async function activateExtension(item: any) {
    if (activationMap.has(item)) return activationMap.get(item);

    const promise = (async () => {
      const extension: any = extensionData.find((e: any) => e.id === item)!;
      if (extension?.matchUrls && extension.matchUrls.length > 0) {
        if (!extension.matchUrls.some((pattern: string) => matchUrl(pattern, location.href, location.pathname))) {
          return;
        }
      }

      if (extension?.dependencies && extension.dependencies.length > 0) {
        const deps = extension.dependencies.filter((id: any) => jsItems.includes(id));
        await Promise.all(deps.map((id: any) => activateExtension(id)));
      }

      const newLocalStorage = {
        ...localStorage,
        setItem(key: string, value: string) {
          return localStorage.setItem(`ext:${item}:${key}`, value);
        },
        getItem(key: string) {
          return localStorage.getItem(`ext:${item}:${key}`);
        },
        removeItem(key: string) {
          localStorage.removeItem(`ext:${item}:${key}`);
        },
        clear() {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith(`ext:${item}:`)) {
              localStorage.removeItem(key);
            }
          });
        }
      }
      const newSessionStorage = {
        ...sessionStorage,
        setItem(key: string, value: string) {
          return sessionStorage.setItem(`ext:${item}:${key}`, value);
        },
        getItem(key: string) {
          return sessionStorage.getItem(`ext:${item}:${key}`);
        },
        removeItem(key: string) {
          sessionStorage.removeItem(`ext:${item}:${key}`);
        },
        clear() {
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(`ext:${item}:`)) {
              sessionStorage.removeItem(key);
            }
          });
        }
      }
      function open(url: string, target?: string, features?: string) {
        if (!url.startsWith(location.origin) && !url.startsWith('/') && !url.startsWith('.')) {
          return msgbox.confirm(`${extension.name}想打开一个链接：<p>${url}</p>是否允许？`).then(allowed => {
            if (allowed) {
              return window.open(url, target, features);
            }
          });
        }
        return window.open(url, target, features);
      }
      try {
        const module = await import(`${scriptSrc.protocol}//${scriptSrc.host}/api/items/${item}.js?userId=${userId}`);
        const activate = module.activate;  // 获取导出的 activate 函数
        await activate?.({ 
          ...newWindow, 
          ...GM,
          GM_registerMenuCommand: (name: string, fn: Function, accessKey?: string) => {
            return GM.GM_registerMenuCommand(name, fn, accessKey, extension.name);
          },
          open, 
          localStorage: newLocalStorage, 
          sessionStorage: newSessionStorage 
        }, document, new Fishpi(apiKey));
      } catch (err) {
        console.error(`激活扩展 ${extension.name} 失败:`, err);
      }
    })();

    activationMap.set(item, promise);
    return promise;
  }

  jsItems.forEach(item => activateExtension(item));

  themeItems.forEach(async item => {
    const extension: any = extensionData.find((e: any) => e.id === item)!;
    if (extension?.matchUrls && extension.matchUrls.length > 0) {
      if (!extension.matchUrls.some((pattern: string) => matchUrl(pattern, location.href, location.pathname))) {
        return;
      }
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = `theme-${item}`;
    link.href = `${scriptSrc.protocol}//${scriptSrc.host}/api/items/${item}.css?userId=${userId}`;
    document.head.appendChild(link);
  });
}

activate();