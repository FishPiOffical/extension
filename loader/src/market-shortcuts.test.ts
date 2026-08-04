import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterAndSortMarketItems,
  isMarketEntry,
  parseApiResponse,
} from './market-shortcuts.ts';

test('识别鱼排插件市场入口', () => {
  assert.equal(isMarketEntry('https://ext.adventext.fun/', '插件市场'), true);
  assert.equal(isMarketEntry('https://ext.adventext.fun/item/1', '插件市场'), false);
  assert.equal(isMarketEntry('https://example.com/', '插件市场'), false);
  assert.equal(isMarketEntry('https://ext.adventext.fun/', '扩展集市'), false);
});

test('只保留网页扩展和网页主题', () => {
  const result = filterAndSortMarketItems([
    { id: 1, name: '网页扩展', type: 'extension', isEnabled: false },
    { id: 2, name: '网页主题', type: 'theme', isEnabled: true },
    { id: 3, name: '客户端扩展', type: 'app-extension', isEnabled: true },
    { id: 4, name: '客户端主题', type: 'app-theme', isEnabled: true },
  ]);

  assert.deepEqual(result.map(item => item.id), [2, 1]);
});

test('启用项优先并按名称升序排列', () => {
  const result = filterAndSortMarketItems([
    { id: 1, name: '乙', type: 'extension', isEnabled: false },
    { id: 2, name: '乙', type: 'theme', isEnabled: true },
    { id: 3, name: '甲', type: 'extension', isEnabled: true },
    { id: 4, name: '甲', type: 'theme', isEnabled: false },
  ]);

  assert.deepEqual(result.map(item => item.id), [3, 2, 4, 1]);
});

test('解析统一接口响应', () => {
  assert.deepEqual(parseApiResponse({ code: 0, data: { value: 1 } }), { value: 1 });
  assert.throws(() => parseApiResponse({ code: 401, data: undefined, msg: '未登录' }), /未登录/);
  assert.throws(() => parseApiResponse({ code: 0 }), /响应无效/);
});
