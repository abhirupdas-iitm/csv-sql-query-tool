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

// 🔥 SQL SCRIPT EXECUTION — runs parsed PostgreSQL dump statements in DuckDB
async function loadSQLScript(file, logCallback) {
    if (!db) throw new Error("DuckDB not initialized. Network might have blocked it.");

    const log = logCallback || console.log;
    const scriptText = await file.text();

    log(`📜 Parsing SQL script (${(scriptText.length / 1024).toFixed(1)} KB)...`, "info");

    // Use the parser to convert PostgreSQL dump → DuckDB statements
    const { statements, summary } = window.parsePgDump(scriptText);

    log(`📋 Parsed: ${summary.tables} tables, ${summary.inserts} data rows, ${summary.constraints} constraints (${summary.skipped} skipped)`, "info");

    if (statements.length === 0) {
        throw new Error("No executable statements found in the SQL script.");
    }

    const createdTables = [];
    let executed = 0;
    let errors = 0;

    for (const stmt of statements) {
        try {
            await conn.query(stmt.sql);
            executed++;

            if (stmt.type === 'CREATE_TABLE') {
                const tableNameMatch = stmt.description.match(/Create table:\s*(.+)/);
                const tName = tableNameMatch ? tableNameMatch[1] : 'unknown';
                createdTables.push(tName);
                log(`✅ ${stmt.description}`, "success");

                // Track file association
                window.tableToFileMap = window.tableToFileMap || {};
                const cleanFileName = file.name.replace(/\.[^.]+$/, "");
                window.tableToFileMap[tName] = cleanFileName;
            } else if (stmt.type === 'INSERT') {
                // Log insert progress less verbosely
                if (executed % 5 === 0 || stmt === statements[statements.length - 1]) {
                    log(`📥 ${stmt.description} (${executed}/${statements.length} statements)`, "info");
                }
            } else if (stmt.type === 'CONSTRAINT') {
                log(`🔗 ${stmt.description}`, "success");
            }
        } catch (err) {
            errors++;
            console.warn(`⚠️ Statement failed: ${stmt.description}`, err.message);
            log(`⚠️ Skipped: ${stmt.description} — ${err.message}`, "info");
        }
    }

    log(`🎉 Script complete! ${executed} statements executed, ${errors} skipped.`, "success");

    return createdTables.join(", ") || "No tables created";
}

async function queryDB(sql) {
    if (!conn) throw new Error("DuckDB not initialized.");

    const result = await conn.query(sql);
    const cols = result.schema.fields.map(f => f.name);
    const types = result.schema.fields.map(f => {
        if (f.type && f.type.toString) return f.type.toString().toLowerCase();
        return '';
    });

    const rows = result.toArray().map(row =>
        cols.map((col, i) => {
            let v = row[col];
            const typeStr = types[i];

            if (v === null || v === undefined) return v;

            // Properly format Arrow Date and Timestamp outputs
            if (typeStr.includes('date') || typeStr.includes('timestamp')) {
                let ms = 0;
                if (typeof v === 'bigint' || typeof v === 'number') {
                    const num = Number(v);
                    // Arrow Date<Day> is sometimes returned as days since epoch (tiny number)
                    if (typeStr === 'date<day>' && num < 10000000) {
                        ms = num * 24 * 60 * 60 * 1000;
                    } else {
                        // Usually returned as milliseconds (e.g. TimestampMillisecond)
                        ms = num;
                    }
                } else if (v instanceof Date) {
                    ms = v.getTime();
                } else {
                    return v; // Not a recognized format, return as is
                }

                const d = new Date(ms);
                const pad = (n) => n.toString().padStart(2, '0');
                const yyyy = d.getUTCFullYear();
                const mm = pad(d.getUTCMonth() + 1);
                const dd = pad(d.getUTCDate());
                
                if (typeStr.includes('timestamp')) {
                    const hh = pad(d.getUTCHours());
                    const min = pad(d.getUTCMinutes());
                    const ss = pad(d.getUTCSeconds());
                    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
                } else {
                    return `${yyyy}-${mm}-${dd}`;
                }
            }

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
window.duckDB = { initDB, loadCSVFile, loadSQLScript, queryDB, listTables };

// Signal to script.js that the duckDB APIs are loaded and ready
_resolveReady(window.duckDB);
