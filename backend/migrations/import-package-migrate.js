#!/usr/bin/env node

const {
  parseArgs,
  resolveConfigPath,
  loadConfig,
  dbFromConfig,
  connect,
  quoteId,
  tableExists,
  getColumns,
  getPrimaryColumns,
  detectPrefix,
  readPackage,
  chunk,
  uniquePairs,
} = require('./lib/migration-utils');

function printHelp() {
  console.log('Usage: node migrations/import-package-migrate.js --in <package.json.gz> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --in <path>           Input package file path (.json or .json.gz)');
  console.log('  --config <path>       Config file path, default: ./config.json');
  console.log('  --prefix <text>       Force target table prefix, default: auto detect from config/db');
  console.log('  --keep-legacy         Keep old middle tables (item_dependencies_*/item_purchased_*)');
  console.log('  --help                Show this help');
}

function normalizeDependencyRows(tables) {
  if (Array.isArray(tables.item_dependency) && tables.item_dependency.length > 0) {
    return uniquePairs(tables.item_dependency, 'itemId', 'dependencyItemId');
  }

  const mapped = [];
  const legacyA = Array.isArray(tables.item_dependencies_item) ? tables.item_dependencies_item : [];
  const legacyB = Array.isArray(tables.item_dependencies_item_item) ? tables.item_dependencies_item_item : [];

  const parseLegacy = (row) => {
    const itemId = Number(row.itemId ?? row.itemId_1);
    const dependencyItemId = Number(row.dependencyItemId ?? row.dependenciesId ?? row.itemId_2);
    if (Number.isInteger(itemId) && itemId > 0 && Number.isInteger(dependencyItemId) && dependencyItemId > 0) {
      mapped.push({ itemId, dependencyItemId });
    }
  };

  legacyA.forEach(parseLegacy);
  legacyB.forEach(parseLegacy);

  return uniquePairs(mapped, 'itemId', 'dependencyItemId');
}

function normalizePurchaseRows(tables) {
  if (Array.isArray(tables.item_purchase) && tables.item_purchase.length > 0) {
    const out = [];
    const seen = new Set();
    tables.item_purchase.forEach((row) => {
      const itemId = Number(row.itemId);
      const userId = row.userId;
      if (!Number.isInteger(itemId) || itemId <= 0 || !userId) return;
      const k = `${itemId}:${userId}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ itemId, userId });
    });
    return out;
  }

  const mapped = [];
  const legacyA = Array.isArray(tables.item_purchased_by_user) ? tables.item_purchased_by_user : [];
  const legacyB = Array.isArray(tables.item_purchased_items_user) ? tables.item_purchased_items_user : [];

  const parseLegacy = (row) => {
    const itemId = Number(row.itemId ?? row.itemId_1);
    const userId = row.userId ?? row.userId_1 ?? row.userId_2;
    if (Number.isInteger(itemId) && itemId > 0 && userId) {
      mapped.push({ itemId, userId });
    }
  };

  legacyA.forEach(parseLegacy);
  legacyB.forEach(parseLegacy);

  const seen = new Set();
  return mapped.filter((row) => {
    const k = `${row.itemId}:${row.userId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const VALID_STATUS = new Set(['draft', 'pending', 'approved', 'rejected']);
const NUM_STATUS_MAP = {
  0: 'draft',
  1: 'pending',
  2: 'approved',
  3: 'rejected',
  4: 'rejected',
};

function normalizeStatus(value, fallback = 'approved') {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return NUM_STATUS_MAP[value] || fallback;
  }

  const raw = String(value).trim();
  if (!raw) {
    return fallback;
  }

  const lower = raw.toLowerCase();
  if (VALID_STATUS.has(lower)) {
    return lower;
  }

  if (/^\d+$/.test(lower)) {
    const n = Number(lower);
    return NUM_STATUS_MAP[n] || fallback;
  }

  if (raw.includes('通过') || lower.includes('approve')) {
    return 'approved';
  }
  if (raw.includes('拒绝') || lower.includes('reject')) {
    return 'rejected';
  }
  if (raw.includes('草稿') || lower.includes('draft')) {
    return 'draft';
  }
  if (raw.includes('待审') || lower.includes('pending')) {
    return 'pending';
  }

  return fallback;
}

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function toMysqlLocalDateTime(date) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function normalizeSqlValue(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toMysqlLocalDateTime(value);
  }
  if (typeof value === 'string' && ISO_DATETIME_RE.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return toMysqlLocalDateTime(parsed);
    }
  }
  if (Array.isArray(value)) {
    return value.join(',');
  }
  return value;
}

async function upsertRows(connection, database, tableName, rows, options = {}) {
  if (!rows || rows.length === 0) {
    return 0;
  }

  const exists = await tableExists(connection, database, tableName);
  if (!exists) {
    return 0;
  }

  const dropColumns = new Set(options.dropColumns || []);
  const onlyColumns = Array.isArray(options.onlyColumns) ? new Set(options.onlyColumns) : null;

  const tableColumns = await getColumns(connection, database, tableName);
  const primaryColumns = await getPrimaryColumns(connection, database, tableName);
  const tableColumnSet = new Set(tableColumns);

  let columns = tableColumns.filter((col) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, col)));
  columns = columns.filter((col) => !dropColumns.has(col));
  if (onlyColumns) {
    columns = columns.filter((col) => onlyColumns.has(col));
  }

  if (columns.length === 0) {
    return 0;
  }

  let total = 0;
  const batches = chunk(rows, 300);

  for (const batch of batches) {
    const values = [];
    const placeholders = [];

    batch.forEach((row) => {
      const entry = columns.map((col) => {
        if (!tableColumnSet.has(col)) return null;
        return Object.prototype.hasOwnProperty.call(row, col) ? normalizeSqlValue(row[col]) : null;
      });
      values.push(...entry);
      placeholders.push(`(${columns.map(() => '?').join(', ')})`);
    });

    const updateColumns = columns.filter((col) => !primaryColumns.includes(col));
    const updateSql = updateColumns.length > 0
      ? ` ON DUPLICATE KEY UPDATE ${updateColumns.map((col) => `${quoteId(col)}=VALUES(${quoteId(col)})`).join(', ')}`
      : '';

    const sql = `INSERT INTO ${quoteId(tableName)} (${columns.map((col) => quoteId(col)).join(', ')}) VALUES ${placeholders.join(', ')}${updateSql}`;
    await connection.execute(sql, values);
    total += batch.length;
  }

  return total;
}

async function fetchStatusDistribution(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT status, COUNT(*) AS cnt FROM ${quoteId(tableName)} GROUP BY status`,
  );
  const out = {};
  rows.forEach((row) => {
    const key = row.status === null || row.status === undefined || row.status === '' ? 'unknown' : String(row.status);
    out[key] = Number(row.cnt || 0);
  });
  return out;
}

// 批量 upsert 可能因唯一键冲突被 ON DUPLICATE KEY UPDATE 覆盖，
// 因此这里按状态分组显式回写一次，确保 status 与导出包完全一致。
async function applyStatusFixup(connection, tableName, itemCodes) {
  const groups = new Map();
  itemCodes.forEach((row) => {
    const status = row.status || 'pending';
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status).push(row.id);
  });

  for (const [status, ids] of groups.entries()) {
    for (const batch of chunk(ids, 500)) {
      const placeholders = batch.map(() => '?').join(', ');
      await connection.execute(
        `UPDATE ${quoteId(tableName)} SET status = ? WHERE id IN (${placeholders})`,
        [status, ...batch],
      );
    }
  }
}

function diffStatusDistribution(expected, actual) {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  const diffs = [];
  keys.forEach((key) => {
    const a = expected[key] || 0;
    const b = actual[key] || 0;
    if (a !== b) {
      diffs.push(`${key}: expected ${a}, actual ${b}`);
    }
  });
  return diffs;
}

function findRootId(rowMap, startId) {
  const visited = new Set();
  let current = rowMap.get(startId);
  while (current && current.upgradeFromId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = rowMap.get(Number(current.upgradeFromId));
    if (!parent) break;
    current = parent;
  }
  return current ? current.id : startId;
}

function normalizeLegacyData(tables) {
  const users = Array.isArray(tables.user) ? tables.user : [];
  const items = Array.isArray(tables.item) ? tables.item : [];
  const comments = Array.isArray(tables.comment) ? tables.comment : [];
  const states = Array.isArray(tables.user_item_state) ? tables.user_item_state : [];
  const globalStorage = Array.isArray(tables.global_storage) ? tables.global_storage : [];

  const isLegacyVersionAsItem = items.some((row) => Object.prototype.hasOwnProperty.call(row, 'version'))
    || items.some((row) => Object.prototype.hasOwnProperty.call(row, 'status'));

  const depRowsRaw = normalizeDependencyRows(tables);
  const purchaseRowsRaw = normalizePurchaseRows(tables);

  const legacyItemStatusById = new Map();
  items.forEach((row) => {
    const itemId = Number(row.id);
    if (Number.isInteger(itemId) && itemId > 0) {
      legacyItemStatusById.set(itemId, normalizeStatus(row.status, 'approved'));
    }
  });

  if (!isLegacyVersionAsItem) {
    const codeRows = Array.isArray(tables.item_code) ? tables.item_code : [];

    return {
      users,
      projects: items.map((row) => ({
        id: Number(row.id),
        name: row.name,
        description: row.description,
        type: row.type,
        price: Number(row.price || 0),
        authorId: row.authorId,
        identifier: row.identifier || null,
        createdAt: row.createdAt,
      })),
      itemCodes: codeRows.map((row, index) => ({
        id: Number(row.id || 0) || index + 1,
        itemId: Number(row.itemId),
        version: Number(row.version || 1),
        language: row.language || 'javascript',
        status: normalizeStatus(
          row.status,
          legacyItemStatusById.get(Number(row.itemId)) || 'approved',
        ),
        matchUrls: row.matchUrls || null,
        upgradeFromCodeId: row.upgradeFromCodeId || null,
        code: typeof row.code === 'string' ? row.code : '',
        reviewComment: row.reviewComment || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt || row.createdAt,
      })),
      dependencies: depRowsRaw,
      purchases: purchaseRowsRaw,
      comments,
      states,
      globalStorage,
    };
  }

  const codeFallbackMap = new Map();
  if (Array.isArray(tables.item_code)) {
    tables.item_code.forEach((row) => {
      const itemId = Number(row.itemId);
      if (Number.isInteger(itemId) && itemId > 0 && typeof row.code === 'string') {
        codeFallbackMap.set(itemId, row.code);
      }
    });
  }

  const itemRows = items
    .map((row) => ({ ...row, id: Number(row.id) }))
    .filter((row) => Number.isInteger(row.id) && row.id > 0);

  const rowMap = new Map(itemRows.map((row) => [row.id, row]));

  const rootIds = [];
  const versionToRoot = new Map();
  itemRows.forEach((row) => {
    const rootId = findRootId(rowMap, row.id);
    versionToRoot.set(row.id, rootId);
    rootIds.push(rootId);
  });

  const uniqueRootIds = Array.from(new Set(rootIds));
  const maxVersionId = itemRows.reduce((m, row) => Math.max(m, row.id), 0);

  const rootToProjectId = new Map();
  uniqueRootIds.forEach((rootId, idx) => {
    rootToProjectId.set(rootId, maxVersionId + idx + 1);
  });

  const projects = uniqueRootIds.map((rootId) => {
    const root = rowMap.get(rootId);
    return {
      id: rootToProjectId.get(rootId),
      name: root.name,
      description: root.description,
      type: root.type,
      price: Number(root.price || 0),
      authorId: root.authorId,
      identifier: root.identifier || null,
      createdAt: root.createdAt,
    };
  });

  const itemCodes = itemRows.map((row) => {
    const rootId = versionToRoot.get(row.id);
    const projectId = rootToProjectId.get(rootId);
    return {
      id: row.id,
      itemId: projectId,
      version: Number(row.version || 1),
      language: row.language || 'javascript',
      status: normalizeStatus(row.status, 'approved'),
      matchUrls: row.matchUrls || null,
      upgradeFromCodeId: row.upgradeFromId ? Number(row.upgradeFromId) : null,
      code: typeof row.code === 'string' ? row.code : (codeFallbackMap.get(row.id) || ''),
      reviewComment: row.reviewComment || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt || row.createdAt,
    };
  });

  const mapToProjectId = (legacyItemId) => {
    const rootId = versionToRoot.get(Number(legacyItemId));
    if (!rootId) return null;
    return rootToProjectId.get(rootId) || null;
  };

  const dependencies = [];
  const depSeen = new Set();
  depRowsRaw.forEach((row) => {
    const itemId = mapToProjectId(row.itemId);
    const depId = mapToProjectId(row.dependencyItemId);
    if (!itemId || !depId || itemId === depId) return;
    const k = `${itemId}:${depId}`;
    if (depSeen.has(k)) return;
    depSeen.add(k);
    dependencies.push({ itemId, dependencyItemId: depId });
  });

  const purchases = [];
  const purchaseSeen = new Set();
  purchaseRowsRaw.forEach((row) => {
    const itemId = mapToProjectId(row.itemId);
    if (!itemId || !row.userId) return;
    const k = `${itemId}:${row.userId}`;
    if (purchaseSeen.has(k)) return;
    purchaseSeen.add(k);
    purchases.push({ itemId, userId: row.userId });
  });

  const mappedComments = comments
    .map((row) => {
      const itemId = mapToProjectId(row.itemId);
      if (!itemId) return null;
      return { ...row, itemId };
    })
    .filter(Boolean);

  const stateMap = new Map();
  states.forEach((row) => {
    const itemId = mapToProjectId(row.itemId);
    if (!itemId || !row.userId) return;
    const key = `${row.userId}:${itemId}`;
    const existing = stateMap.get(key);
    const mapped = {
      ...row,
      itemId,
      selectedCodeId: Number(row.selectedCodeId || row.itemId || 0) || null,
    };
    if (!existing || Number(mapped.id || 0) > Number(existing.id || 0)) {
      stateMap.set(key, mapped);
    }
  });

  const mappedStates = Array.from(stateMap.values());

  return {
    users,
    projects,
    itemCodes,
    dependencies,
    purchases,
    comments: mappedComments,
    states: mappedStates,
    globalStorage,
  };
}

async function rebuildCoreTables(connection, database, prefix) {
  const itemTable = `${prefix}item`;
  const codeTable = `${prefix}item_code`;
  const depTable = `${prefix}item_dependency`;
  const purchaseTable = `${prefix}item_purchase`;
  const stateTable = `${prefix}user_item_state`;

  await connection.execute(`DROP TABLE IF EXISTS ${quoteId(itemTable)}`);
  await connection.execute(`DROP TABLE IF EXISTS ${quoteId(codeTable)}`);
  await connection.execute(`DROP TABLE IF EXISTS ${quoteId(depTable)}`);
  await connection.execute(`DROP TABLE IF EXISTS ${quoteId(purchaseTable)}`);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS ${quoteId(itemTable)} (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      type ENUM('extension', 'theme', 'app-extension', 'app-theme') NOT NULL,
      price INT NOT NULL DEFAULT 0,
      authorId VARCHAR(64) NOT NULL,
      identifier VARCHAR(100) NULL,
      createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_item_author_type (authorId, type),
      KEY idx_item_identifier (identifier)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS ${quoteId(codeTable)} (
      id INT NOT NULL AUTO_INCREMENT,
      itemId INT NOT NULL,
      version INT NOT NULL DEFAULT 1,
      language VARCHAR(255) NOT NULL,
      status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      matchUrls TEXT NULL,
      upgradeFromCodeId INT NULL,
      code LONGTEXT NOT NULL,
      reviewComment VARCHAR(255) NULL,
      createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      UNIQUE KEY uq_item_code_item_version (itemId, version),
      KEY idx_item_code_item_status (itemId, status),
      KEY idx_item_code_status_created (status, createdAt),
      KEY idx_item_code_upgrade_from (upgradeFromCodeId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS ${quoteId(depTable)} (
      id INT NOT NULL AUTO_INCREMENT,
      itemId INT NOT NULL,
      dependencyItemId INT NOT NULL,
      createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      UNIQUE KEY uq_item_dependency_pair (itemId, dependencyItemId),
      KEY idx_item_dependency_item_id (itemId),
      KEY idx_item_dependency_dependency_id (dependencyItemId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS ${quoteId(purchaseTable)} (
      id INT NOT NULL AUTO_INCREMENT,
      itemId INT NOT NULL,
      userId VARCHAR(64) NOT NULL,
      createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      UNIQUE KEY uq_item_purchase_pair (itemId, userId),
      KEY idx_item_purchase_item_id (itemId),
      KEY idx_item_purchase_user_id (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS ${quoteId(stateTable)} (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(64) NOT NULL,
      itemId INT NOT NULL,
      selectedCodeId INT NULL,
      isEnabled TINYINT(1) NOT NULL DEFAULT 1,
      isAutoUpdate TINYINT(1) NOT NULL DEFAULT 1,
      storage TEXT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_item_state_user_item (userId, itemId),
      KEY idx_user_item_state_user_id (userId),
      KEY idx_user_item_state_item_id (itemId),
      KEY idx_user_item_state_selected_code_id (selectedCodeId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const stateColumns = await getColumns(connection, database, stateTable);
  if (!stateColumns.includes('selectedCodeId')) {
    await connection.execute(`ALTER TABLE ${quoteId(stateTable)} ADD COLUMN ${quoteId('selectedCodeId')} INT NULL`);
  }

  return { itemTable, codeTable, depTable, purchaseTable, stateTable };
}

async function cleanupLegacyObjects(connection, prefix, keepLegacy) {
  if (keepLegacy) return;

  const toDrop = [
    `${prefix}item_dependencies_item`,
    `${prefix}item_dependencies_item_item`,
    `${prefix}item_purchased_by_user`,
    `${prefix}item_purchased_items_user`,
    `${prefix}v_item_latest_approved`,
  ];

  for (const name of toDrop) {
    await connection.execute(`DROP VIEW IF EXISTS ${quoteId(name)}`).catch(() => undefined);
    await connection.execute(`DROP TABLE IF EXISTS ${quoteId(name)}`).catch(() => undefined);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const inFile = args.in || args.input;
  if (!inFile) {
    throw new Error('Missing --in <package.json.gz>');
  }

  const { abs: packagePath, payload } = readPackage(inFile);
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    throw new Error('Invalid package format: missing tables');
  }

  const configPath = resolveConfigPath(args.config);
  const config = loadConfig(configPath);
  const db = dbFromConfig(config);

  const connection = await connect(db);
  try {
    const configuredPrefix = args.prefix !== undefined ? String(args.prefix) : (config.db.entityPrefix || '');
    const targetPrefix = await detectPrefix(connection, db.database, configuredPrefix);

    await connection.beginTransaction();

    const normalized = normalizeLegacyData(payload.tables);
    const names = await rebuildCoreTables(connection, db.database, targetPrefix);

    if (await tableExists(connection, db.database, `${targetPrefix}comment`)) {
      await connection.execute(`DELETE FROM ${quoteId(`${targetPrefix}comment`)}`);
    }
    if (await tableExists(connection, db.database, names.stateTable)) {
      await connection.execute(`DELETE FROM ${quoteId(names.stateTable)}`);
    }
    if (await tableExists(connection, db.database, `${targetPrefix}global_storage`)) {
      await connection.execute(`DELETE FROM ${quoteId(`${targetPrefix}global_storage`)}`);
    }

    const insertedUsers = await upsertRows(connection, db.database, `${targetPrefix}user`, normalized.users);
    const insertedItems = await upsertRows(connection, db.database, names.itemTable, normalized.projects, {
      onlyColumns: ['id', 'name', 'description', 'type', 'price', 'authorId', 'identifier', 'createdAt'],
    });
    const insertedCodes = await upsertRows(connection, db.database, names.codeTable, normalized.itemCodes, {
      onlyColumns: ['id', 'itemId', 'version', 'language', 'status', 'matchUrls', 'upgradeFromCodeId', 'code', 'reviewComment', 'createdAt', 'updatedAt'],
    });

    await applyStatusFixup(connection, names.codeTable, normalized.itemCodes);

    await upsertRows(connection, db.database, `${targetPrefix}comment`, normalized.comments);
    await upsertRows(connection, db.database, names.stateTable, normalized.states);

    const insertedDeps = await upsertRows(connection, db.database, names.depTable, normalized.dependencies, {
      onlyColumns: ['itemId', 'dependencyItemId'],
    });
    const insertedPurchases = await upsertRows(connection, db.database, names.purchaseTable, normalized.purchases, {
      onlyColumns: ['itemId', 'userId'],
    });
    const insertedGlobals = await upsertRows(connection, db.database, `${targetPrefix}global_storage`, normalized.globalStorage);

    const statusCount = normalized.itemCodes.reduce((acc, row) => {
      const key = row.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const actualStatusCount = await fetchStatusDistribution(connection, names.codeTable);
    const statusDiffs = diffStatusDistribution(statusCount, actualStatusCount);

    await cleanupLegacyObjects(connection, targetPrefix, Boolean(args['keep-legacy']));

    await connection.commit();

    console.log('Import and migration completed');
    console.log(`Package: ${packagePath}`);
    console.log(`Config: ${configPath}`);
    console.log(`Database: ${db.database}`);
    console.log(`Target prefix: "${targetPrefix}"`);
    console.log('Rows processed:');
    console.log(`  user: ${insertedUsers}`);
    console.log(`  item(project): ${insertedItems}`);
    console.log(`  item_code(version): ${insertedCodes}`);
    console.log(`  item_dependency(project-level): ${insertedDeps}`);
    console.log(`  item_purchase(project-level): ${insertedPurchases}`);
    console.log(`  global_storage: ${insertedGlobals}`);
    console.log(`  comment: ${normalized.comments.length}`);
    console.log(`  user_item_state: ${normalized.states.length}`);
    console.log('  item_code status (package):');
    Object.keys(statusCount).sort().forEach((k) => {
      console.log(`    ${k}: ${statusCount[k]}`);
    });
    console.log('  item_code status (database read-back):');
    Object.keys(actualStatusCount).sort().forEach((k) => {
      console.log(`    ${k}: ${actualStatusCount[k]}`);
    });

    if (statusDiffs.length > 0) {
      console.log('WARNING: status mismatch between package and database:');
      statusDiffs.forEach((line) => console.log(`    ${line}`));
      console.log('Hint: the backend runs TypeORM with synchronize enabled. If the DB shows');
      console.log('      correct values now but resets to "pending" after starting the app,');
      console.log('      TypeORM is altering the table on startup. Align the entity schema or');
      console.log('      disable synchronize for production.');
    } else {
      console.log('Status verification passed: database matches the package.');
    }
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Import/migration failed:', err.message);
  process.exit(1);
});
