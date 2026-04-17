// 🦆 DUCKDB — Client-side, CDN-based. No bundler required.
// Loads DuckDB WASM from jsDelivr. Works in plain HTML/JS projects.

const DUCKDB_CDN_BASE = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/";

const BUNDLES = {
    mvp: {
        mainModule:   DUCKDB_CDN_BASE + "duckdb-mvp.wasm",
        mainWorker:   DUCKDB_CDN_BASE + "duckdb-browser-mvp.worker.js",
    },
    eh: {
        mainModule:   DUCKDB_CDN_BASE + "duckdb-eh.wasm",
        mainWorker:   DUCKDB_CDN_BASE + "duckdb-browser-eh.worker.js",
    },
};

let db   = null;
let conn = null;

// Tracks which tables have been loaded (filename → table name)
const loadedFiles = {};

/**
 * 🔹 Initialize DuckDB once.
 * Safe to call multiple times — will no-op after first init.
 */
async function initDB() {
    if (db) return; // already initialized

    // Dynamically import the DuckDB ESM bundle from CDN
    const duckdb = await import(DUCKDB_CDN_BASE + "duckdb-browser-eh.esm.js");

    // Pick the best bundle for this browser
    const bundle = await duckdb.selectBundle(BUNDLES);

    const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: "application/javascript" })
    );

    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();

    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    conn = await db.connect();

    console.log("🦆 DuckDB initialized");
}

/**
 * 🔹 Get the active connection. Throws if not initialized.
 */
function getConnection() {
    if (!conn) throw new Error("DuckDB not initialized. Call initDB() first.");
    return conn;
}

/**
 * 🔹 Load a CSV File object into DuckDB as a table.
 * Table name is derived from the filename (sanitized).
 * Returns the table name so the UI can show it.
 *
 * @param {File} file - A browser File object
 * @returns {string} tableName
 */
async function loadCSVFile(file) {
    if (!db) throw new Error("DuckDB not initialized.");

    // Sanitize filename → table name  (e.g. "my-data.csv" → "my_data")
    const tableName = file.name
        .replace(/\.[^.]+$/, "")           // strip extension
        .replace(/[^a-zA-Z0-9_]/g, "_");   // replace special chars

    const buffer      = await file.arrayBuffer();
    const uint8Array  = new Uint8Array(buffer);

    // Register the raw bytes inside DuckDB's virtual FS
    await db.registerFileBuffer(file.name, uint8Array);

    // Create (or replace) a table backed by that file
    await conn.query(`
        CREATE OR REPLACE TABLE "${tableName}" AS
        SELECT * FROM read_csv_auto('${file.name}', header=true, sample_size=-1)
    `);

    loadedFiles[file.name] = tableName;
    console.log(`🦆 Loaded "${file.name}" → table "${tableName}"`);

    return tableName;
}

/**
 * 🔹 Run any SQL query and return rows as plain JS objects.
 *
 * @param {string} sql
 * @returns {Promise<{ columns: string[], rows: any[][] }>}
 */
async function queryDB(sql) {
    const connection = getConnection();
    const result     = await connection.query(sql);

    const schema  = result.schema.fields.map(f => f.name);
    const rawRows = result.toArray();

    const rows = rawRows.map(row =>
        schema.map(col => {
            const val = row[col];
            // Arrow JS BigInt → regular number for display
            return typeof val === "bigint" ? Number(val) : val;
        })
    );

    return { columns: schema, rows };
}

/**
 * 🔹 List all user tables currently loaded in DuckDB.
 * @returns {Promise<string[]>}
 */
async function listTables() {
    const connection = getConnection();
    const result     = await connection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );
    return result.toArray().map(r => r.table_name);
}

// Expose globally so script.js (non-module) can call them
window.duckDB = { initDB, loadCSVFile, queryDB, listTables };
