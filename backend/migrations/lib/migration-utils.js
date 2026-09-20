const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mysql = require('mysql2/promise');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const eq = token.indexOf('=');
    if (eq > -1) {
      const key = token.slice(2, eq);
      args[key] = token.slice(eq + 1);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function resolveConfigPath(customPath) {
  if (customPath) {
    return path.resolve(process.cwd(), customPath);
  }
  return path.resolve(process.cwd(), 'config.json');
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !parsed.db) {
    throw new Error(`Invalid config format in ${configPath}`);
  }
  return parsed;
}

function dbFromConfig(config) {
  return {
    host: config.db.host,
    port: Number(config.db.port || 3306),
    user: config.db.username,
    password: config.db.password,
    database: config.db.database,
  };
}

async function connect(dbOptions) {
  return mysql.createConnection({
    host: dbOptions.host,
    port: dbOptions.port,
    user: dbOptions.user,
    password: dbOptions.password,
    database: dbOptions.database,
    multipleStatements: false,
    charset: 'utf8mb4',
  });
}

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function listTables(connection, database) {
  const [rows] = await connection.execute(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [database],
  );
  return rows.map((r) => r.TABLE_NAME);
}

async function tableExists(connection, database, tableName) {
  const [rows] = await connection.execute(
    'SELECT 1 AS ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
    [database, tableName],
  );
  return rows.length > 0;
}

async function getColumns(connection, database, tableName) {
  const [rows] = await connection.execute(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [database, tableName],
  );
  return rows.map((r) => r.COLUMN_NAME);
}

async function getPrimaryColumns(connection, database, tableName) {
  const [rows] = await connection.execute(
    'SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = \'PRIMARY\' ORDER BY ORDINAL_POSITION',
    [database, tableName],
  );
  return rows.map((r) => r.COLUMN_NAME);
}

async function detectPrefix(connection, database, configuredPrefix = '') {
  if (configuredPrefix) {
    const ok = await tableExists(connection, database, `${configuredPrefix}item`);
    if (ok) {
      return configuredPrefix;
    }
  }

  const tables = await listTables(connection, database);
  const set = new Set(tables);
  const candidates = new Map();

  tables.forEach((tableName) => {
    if (!tableName.endsWith('item')) {
      return;
    }
    const prefix = tableName.slice(0, -'item'.length);
    let score = 0;
    if (set.has(`${prefix}user`)) score += 1;
    if (set.has(`${prefix}comment`)) score += 1;
    if (set.has(`${prefix}user_item_state`)) score += 1;
    candidates.set(prefix, score);
  });

  if (candidates.size === 0) {
    return configuredPrefix || '';
  }

  const sorted = Array.from(candidates.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    if (a[0] === configuredPrefix) {
      return -1;
    }
    if (b[0] === configuredPrefix) {
      return 1;
    }
    return a[0].length - b[0].length;
  });

  return sorted[0][0];
}

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function writePackage(outputPath, payload) {
  const abs = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const text = JSON.stringify(payload, null, 2);
  if (abs.endsWith('.gz')) {
    const buffer = zlib.gzipSync(Buffer.from(text, 'utf8'));
    fs.writeFileSync(abs, buffer);
  } else {
    fs.writeFileSync(abs, text, 'utf8');
  }

  return abs;
}

function readPackage(inputPath) {
  const abs = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Package file not found: ${abs}`);
  }

  const raw = fs.readFileSync(abs);
  let text;

  if (abs.endsWith('.gz')) {
    text = zlib.gunzipSync(raw).toString('utf8');
  } else {
    text = raw.toString('utf8');
  }

  return { abs, payload: JSON.parse(text) };
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

function uniquePairs(rows, leftKey, rightKey) {
  const set = new Set();
  const out = [];

  rows.forEach((row) => {
    const left = Number(row[leftKey]);
    const right = Number(row[rightKey]);
    if (!Number.isInteger(left) || !Number.isInteger(right) || left <= 0 || right <= 0) {
      return;
    }
    const k = `${left}:${right}`;
    if (set.has(k)) {
      return;
    }
    set.add(k);
    out.push({ [leftKey]: left, [rightKey]: right });
  });

  return out;
}

const VALID_STATUS = new Set(['draft', 'pending', 'approved', 'rejected']);

const NUM_STATUS_MAP = {
  0: 'draft',
  1: 'pending',
  2: 'approved',
  3: 'rejected',
  4: 'rejected',
};

// 兼容历史/异形 status：字符串、数字、中文与英文关键词，无法识别时回落到 fallback。
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
    return NUM_STATUS_MAP[Number(lower)] || fallback;
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

async function fetchStatusDistribution(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT status, COUNT(*) AS cnt FROM ${quoteId(tableName)} GROUP BY status`,
  );
  const out = {};
  rows.forEach((row) => {
    const key = row.status === null || row.status === undefined || row.status === ''
      ? 'unknown'
      : String(row.status);
    out[key] = Number(row.cnt || 0);
  });
  return out;
}

module.exports = {
  parseArgs,
  resolveConfigPath,
  loadConfig,
  dbFromConfig,
  connect,
  quoteId,
  tableExists,
  listTables,
  getColumns,
  getPrimaryColumns,
  detectPrefix,
  nowStamp,
  writePackage,
  readPackage,
  chunk,
  uniquePairs,
  VALID_STATUS,
  NUM_STATUS_MAP,
  normalizeStatus,
  fetchStatusDistribution,
};
