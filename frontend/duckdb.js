// 🦆 DUCKDB WASM — Vanilla JS implementation using Dynamic Import.
// No bundlers, no module script tags needed. Pure bulletproof JS.

let db = null;
let conn = null;
let duckdbModule = null;

// The global safety promise ensures we can await initialization
let _resolveReady;
window.duckDBReady = new Promise(resolve => { _resolveReady = resolve; });

async function initDB() {
    if (db) return;

    try {
        console.log("🦆 Fetching completely fresh DuckDB engine...");
        // Dynamically import the full, esbuild-bundled module from jsDelivr
        // This solves all apache-arrow dependency issues that happen with local files
        duckdbModule = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev45.0/+esm?v=7');

        // DuckDB built-in auto-resolver for CDN worker/wasm files
        const bundles = duckdbModule.getJsDelivrBundles();
        const bundle = await duckdbModule.selectBundle(bundles);

        // Safely map the cross-origin worker script using the built-in helper
        const worker = await duckdbModule.createWorker(bundle.mainWorker);
        const logger = new duckdbModule.ConsoleLogger();

        db = new duckdbModule.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

        conn = await db.connect();
        console.log("✅ DuckDB engine initialized and connected!");
    } catch (err) {
        console.error("❌ Extreme DuckDB Load Failure:", err);
        throw err;
    }
}

async function loadCSVFile(file) {
    if (!db) throw new Error("DuckDB not initialized. Network might have blocked it.");

    const ext = file.name.split('.').pop().toLowerCase();

    const tableName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .toLowerCase();

    let bytes = new Uint8Array(await file.arrayBuffer());
    let filenameToRegister = file.name;

    // 🌟 INTERCEPT EXCEL FILES AND CONVERT TO CSV!
    if (ext === "xlsx" || ext === "xls") {
        console.log("📊 Excel file detected! Converting to CSV...");
        if (typeof XLSX === "undefined") throw new Error("XLSX library not loaded!");

        // Read the excel file bytes
        const workbook = XLSX.read(bytes, { type: 'array' });

        let loadedTables = [];

        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            // Convert to CSV string!
            const csvString = XLSX.utils.sheet_to_csv(worksheet);

            // Convert string back to bytes for DuckDB
            const encoder = new TextEncoder();
            const sheetBytes = encoder.encode(csvString);

            const cleanSheet = sheetName.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").toLowerCase();
            const sheetFileName = `${file.name}-${cleanSheet}.csv`;
            const sheetTableName = `${cleanSheet}-data`;

            // Track file association
            window.tableToFileMap = window.tableToFileMap || {};
            const cleanFileName = file.name.replace(/\.[^.]+$/, "");
            window.tableToFileMap[sheetTableName] = cleanFileName;

            await db.registerFileBuffer(sheetFileName, sheetBytes);
            await conn.query(`
                CREATE OR REPLACE TABLE "${sheetTableName}" AS
                SELECT * FROM read_csv_auto('${sheetFileName}', header=true, sample_size=-1)
            `);
            console.log(`🦆 Mapped "${file.name}" (Sheet: ${sheetName}) → table "${sheetTableName}"`);
            loadedTables.push(sheetTableName);
        }

        return loadedTables.join(", ");
    }

    await db.registerFileBuffer(filenameToRegister, bytes);

    await conn.query(`
        CREATE OR REPLACE TABLE "${tableName}" AS
        SELECT * FROM read_csv_auto('${filenameToRegister}', header=true, sample_size=-1)
    `);

    // Track file association for default CSV uploads too
    window.tableToFileMap = window.tableToFileMap || {};
    const cleanFileName = file.name.replace(/\.[^.]+$/, "");
    window.tableToFileMap[tableName] = cleanFileName;

    console.log(`🦆 Mapped "${file.name}" → table "${tableName}"`);
    return tableName;
}

async function queryDB(sql) {
    if (!conn) throw new Error("DuckDB not initialized.");

    const result = await conn.query(sql);
    const cols = result.schema.fields.map(f => f.name);
    const rows = result.toArray().map(row =>
        cols.map(col => {
            const v = row[col];
            return typeof v === 'bigint' ? Number(v) : v;
        })
    );

    return { columns: cols, rows };
}

async function listTables() {
    if (!conn) return [];
    const result = await conn.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );
    return result.toArray().map(r => r.table_name);
}

// 🔹 Export locally to window globally for the rest of the application
window.duckDB = { initDB, loadCSVFile, queryDB, listTables };

// Signal to script.js that the duckDB APIs are loaded and ready
_resolveReady(window.duckDB);
