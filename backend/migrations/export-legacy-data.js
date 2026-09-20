#!/usr/bin/env node

const {
  parseArgs,
  resolveConfigPath,
  loadConfig,
  dbFromConfig,
  connect,
  quoteId,
  tableExists,
  detectPrefix,
  nowStamp,
  writePackage,
} = require('./lib/migration-utils');

const LEGACY_TABLES = [
  'item',
  'user',
  'comment',
  'user_item_state',
  'global_storage',
  'item_dependencies_item',
  'item_dependencies_item_item',
  'item_purchased_by_user',
  'item_purchased_items_user',
  'item_dependency',
  'item_purchase',
  'item_code',
];

function printHelp() {
  console.log('Usage: node migrations/export-legacy-data.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --config <path>   Config file path, default: ./config.json');
  console.log('  --prefix <text>   Force table prefix, default: auto detect from config/db');
  console.log('  --out <path>      Output package path, default: migrations/legacy_export_<time>.json.gz');
  console.log('  --help            Show this help');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const configPath = resolveConfigPath(args.config);
  const config = loadConfig(configPath);
  const db = dbFromConfig(config);

  const connection = await connect(db);
  try {
    const configuredPrefix = args.prefix !== undefined ? String(args.prefix) : (config.db.entityPrefix || '');
    const prefix = await detectPrefix(connection, db.database, configuredPrefix);

    const outFile = args.out || `migrations/legacy_export_${nowStamp()}.json.gz`;
    const tables = {};
    const physicalTables = {};
    const rowCounts = {};

    for (const logicalName of LEGACY_TABLES) {
      const physicalName = `${prefix}${logicalName}`;
      const exists = await tableExists(connection, db.database, physicalName);
      if (!exists) {
        continue;
      }

      const [rows] = await connection.query(`SELECT * FROM ${quoteId(physicalName)}`);
      tables[logicalName] = rows;
      physicalTables[logicalName] = physicalName;
      rowCounts[logicalName] = rows.length;
    }

    const payload = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      source: {
        database: db.database,
        prefix,
        configuredPrefix,
        configPath,
      },
      rowCounts,
      physicalTables,
      tables,
    };

    const absOut = writePackage(outFile, payload);

    console.log('Export completed');
    console.log(`Config: ${configPath}`);
    console.log(`Database: ${db.database}`);
    console.log(`Detected prefix: "${prefix}"`);
    console.log(`Package: ${absOut}`);
    console.log('Rows:');
    Object.keys(rowCounts).sort().forEach((key) => {
      console.log(`  ${key}: ${rowCounts[key]}`);
    });
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
