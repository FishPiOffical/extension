import { readFileSync } from "fs"
import { join } from "path";

let cachedLoaderCode: string | null = null;

export const loaderCode = () => {
  if (cachedLoaderCode === null) {
    try {
      cachedLoaderCode = readFileSync(join(__dirname, '../../loader.min.js'), 'utf-8');
    } catch {
      try {
        cachedLoaderCode = readFileSync(join(process.cwd(), 'loader.min.js'), 'utf-8');
      } catch (e) {
        console.error('Failed to read loader.min.js:', e);
        return '';
      }
    }
  }
  return cachedLoaderCode;
};

export const clearLoaderTemplateCache = () => {
  cachedLoaderCode = null;
};

export const defaultAllowGlobals = [
  'crypto',
  'console',
  'customElements',
  'cloudStorage',
  'globalStorage',
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
  // GM Function export
  'GM_deleteValue',
  'GM_getValue',
  'GM_listValues',
  'GM_setValue',
  'GM_xmlhttpRequest',
  'GM_registerMenuCommand',
  'GM_addStyle',
  // msgbox export
  'msgbox',
]