#!/usr/bin/env node

// 只修复 item_code.status，不触碰其它数据。
// 适用场景：导入时目标表缺少 status 列，行插入后被补列默认值 pending，
// 导致首页等按 approved 过滤的查询拿不到数据。

const {
  parseArgs,
  resolveConfigPath,
  loadConfig,
  dbFromConfig,
  connect,
  quoteId,
  tableExists,
  getColumns,
  detectPrefix,
  readPackage,
  chunk,
  normalizeStatus,
  fetchStatusDistribution,
} = require('./lib/migration-utils');

function printHelp() {
  console.log('Usage: node migrations/repair-item-code-status.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --in <path>       Source package path (.json or .json.gz), default: migrations/legacy_export.json.gz');
  console.log('  --config <path>   Config file path, default: ./config.json');
  console.log('  --prefix <text>   Force target table prefix, default: auto detect from config/db');
  console.log('  --dry-run         Only report what would change, do not write');
  console.log('  --help            Show this help');
}

// 从导出包推导 codeId -> status 映射。
// 旧结构：每个版本一行 item，item_code.id = item.id
// 新结构：item_code already holds statuses
function buildStatusMap(payload) {
  const tables = payload.tables || {};
  const items = Array.isArray(tables.item) ? tables.item : [];
  const legacyShape = items.some((row) => Object.prototype.hasOwnProperty.call(row, 'status'));

  const map = new Map();
  let source = 'unknown';

  if (legacyShape) {
    source = 'item.status (legacy version-as-item)';
    items.forEach((row) => {
      const id = Number(row.id);
      if (!Number.isInteger(id) || id <= 0) return;
      map.set(id, normalizeStatus(row.status, 'approved'));
    });
    return { map, source };
  }

  const codes = Array.isArray(tables.item_code) ? tables.item_code : [];
  if (codes.length > 0) {
    source = 'item_code.status (already migrated package)';
    codes.forEach((row) => {
      const id = Number(row.id);
      if (!Number.isInteger(id) || id <= 0) return;
      map.set(id, normalizeStatus(row.status, 'approved'));
    });
  }

  return { map, source };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const dryRun = Boolean(args['dry-run']);
  const inFile = args.in || args.input || 'migrations/legacy_export.json.gz';

  const { abs: packagePath, payload } = readPackage(inFile);
  if (!payload || !payload.tables) {
    throw new Error('Invalid package format: missing tables');
  }

  const { map: codeStatusMap, source } = buildStatusMap(payload);
  if (codeStatusMap.size === 0) {
    throw new Error('No usable status information found in package');
  }

  const configPath = resolveConfigPath(args.config);
  const config = loadConfig(configPath);
  const db = dbFromConfig(config);

  const connection = await connect(db);
  try {
    const configuredPrefix = args.prefix !== undefined ? String(args.prefix) : (config.db.entityPrefix || '');
    const prefix = await detectPrefix(connection, db.database, configuredPrefix);
    const codeTable = `${prefix}item_code`;

    if (!(await tableExists(connection, db.database, codeTable))) {
      throw new Error(`Table not found: ${codeTable}`);
    }

    const columns = await getColumns(connection, db.database, codeTable);
    if (!columns.includes('status')) {
      throw new Error(`Column "status" not found on ${codeTable}`);
    }

    const before = await fetchStatusDistribution(connection, codeTable);

    const [idRows] = await connection.query(`SELECT id FROM ${quoteId(codeTable)}`);
    const matched = [];
    const unmatched = [];

    idRows.forEach((row) => {
      const id = Number(row.id);
      const status = codeStatusMap.get(id);
      if (status) {
        matched.push({ id, status });
      } else {
        unmatched.push(id);
      }
    });

    const expected = matched.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    console.log('Repair item_code.status');
    console.log(`Package: ${packagePath}`);
    console.log(`Status source: ${source}`);
    console.log(`Config: ${configPath}`);
    console.log(`Database: ${db.database}`);
    console.log(`Table: ${codeTable}`);
    console.log(`Rows in table: ${idRows.length}`);
    console.log(`Matched by package: ${matched.length}`);
    console.log(`Unmatched (kept as-is): ${unmatched.length}`);
    console.log(`Dry run: ${dryRun ? 'yes' : 'no'}`);
    console.log('status before:');
    Object.keys(before).sort().forEach((k) => console.log(`  ${k}: ${before[k]}`));
    console.log('status expected:');
    Object.keys(expected).sort().forEach((k) => console.log(`  ${k}: ${expected[k]}`));

    if (unmatched.length > 0) {
      console.log(`Unmatched id sample: ${unmatched.slice(0, 10).join(', ')}`);
    }

    if (dryRun) {
      console.log('Dry run complete, no writes performed.');
      return;
    }

    const groups = new Map();
    matched.forEach((row) => {
      if (!groups.has(row.status)) {
        groups.set(row.status, []);
      }
      groups.get(row.status).push(row.id);
    });

    let updated = 0;
    await connection.beginTransaction();
    try {
      for (const [status, ids] of groups.entries()) {
        for (const batch of chunk(ids, 500)) {
          const placeholders = batch.map(() => '?').join(', ');
          const [result] = await connection.execute(
            `UPDATE ${quoteId(codeTable)} SET status = ? WHERE id IN (${placeholders})`,
            [status, ...batch],
          );
          updated += Number(result.affectedRows || 0);
        }
      }

      const after = await fetchStatusDistribution(connection, codeTable);
      const mismatched = Object.keys(expected).filter((k) => (after[k] || 0) !== expected[k]);

      if (mismatched.length > 0) {
        await connection.rollback();
        console.log('Verification failed, rolled back. Mismatched statuses:');
        mismatched.forEach((k) => console.log(`  ${k}: expected ${expected[k]}, actual ${after[k] || 0}`));
        return;
      }

      await connection.commit();

      console.log(`Rows updated: ${updated}`);
      console.log('status after:');
      Object.keys(after).sort().forEach((k) => console.log(`  ${k}: ${after[k]}`));
      console.log('Verification passed: item_code.status now matches the package.');
    } catch (err) {
      await connection.rollback();
      throw err;
    }
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Repair failed:', err.message);
  process.exit(1);
});
