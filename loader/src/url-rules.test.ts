import assert from 'node:assert/strict';
import test from 'node:test';
import { isUrlAllowed, matchUrl } from './url-rules.ts';

const href = 'https://fishpi.cn/article/123?tab=comments';
const path = '/article/123';

test('匹配完整地址和通配符', () => {
  assert.equal(matchUrl('https://fishpi.cn/*', href, path), true);
  assert.equal(matchUrl('https://example.com/*', href, path), false);
});

test('斜杠开头的规则只匹配路径', () => {
  assert.equal(matchUrl('/article/*', href, path), true);
  assert.equal(matchUrl('/admin/*', href, path), false);
});

test('空白名单不限制地址', () => {
  assert.equal(isUrlAllowed(href, path, [], {}, {}), true);
});

test('整体黑名单优先于白名单', () => {
  assert.equal(isUrlAllowed(
    href,
    path,
    ['https://fishpi.cn/*'],
    { allowUrls: ['https://fishpi.cn/*'], blockUrls: ['/article/*'] },
    {},
  ), false);
});

test('单项黑名单优先于白名单', () => {
  assert.equal(isUrlAllowed(
    href,
    path,
    ['https://fishpi.cn/*'],
    {},
    { allowUrls: ['/article/*'], blockUrls: ['https://fishpi.cn/article/*'] },
  ), false);
});

test('作者、整体和单项白名单必须全部命中', () => {
  assert.equal(isUrlAllowed(
    href,
    path,
    ['https://fishpi.cn/*'],
    { allowUrls: ['/article/*'] },
    { allowUrls: ['https://fishpi.cn/article/*'] },
  ), true);

  assert.equal(isUrlAllowed(
    href,
    path,
    ['https://fishpi.cn/*'],
    { allowUrls: ['/article/*'] },
    { allowUrls: ['/settings/*'] },
  ), false);
});

test('作者适用网址未命中时禁止运行', () => {
  assert.equal(isUrlAllowed(href, path, ['/settings/*'], {}, {}), false);
});
