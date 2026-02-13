import Fishpi from 'fishpi/browser';
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
]
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
        if (obj.hasOwnProperty(field)) {
            result[field] = obj[field];
        }
    });
    return result;
}

async function activate() {
  // @ts-ignore
  const scriptSrc = new URL(import.meta.url);
  const newWindow: any = pick(window, defaultAllowGlobals);
  const { apiKey } = await fetch('/getApiKeyInWeb').then((r) => r.json())
  const fishpi = new Fishpi(apiKey);
  newWindow.location = {
    ...readOnly(location, ['href', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash']),
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

  jsItems.forEach(async item => {
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
    const module = await import(`${scriptSrc.protocol}//${scriptSrc.host}/api/items/${item}.js`);  // 返回模块对象
    const activate = module.activate;  // 获取导出的 activate 函数
    await activate?.({ newWindow, localStorage: newLocalStorage, sessionStorage: newSessionStorage }, document, fishpi).catch(console.error);
  });

  themeItems.forEach(async item => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = `theme-${item}`;
    link.href = `${scriptSrc.protocol}//${scriptSrc.host}/api/items/${item}.css`;
    document.head.appendChild(link);
  });
}

activate();