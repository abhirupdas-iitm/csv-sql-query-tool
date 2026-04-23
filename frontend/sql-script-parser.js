// 🔥 SQL SCRIPT PARSER — Converts PostgreSQL pg_dump output to DuckDB-compatible SQL
// Handles: CREATE TABLE, COPY...FROM stdin, ALTER TABLE, and skips PG-specific commands

/**
 * Parse a PostgreSQL dump file and return an array of executable DuckDB statements
 * along with metadata about what was parsed.
 * 
 * @param {string} scriptText - Raw contents of the .sql file
 * @returns {{ statements: Array<{sql: string, type: string, description: string}>, summary: {tables: number, inserts: number, constraints: number, skipped: number} }}
 */
function parsePgDump(scriptText) {
    const results = [];
    const summary = { tables: 0, inserts: 0, constraints: 0, skipped: 0 };

    // Normalize line endings
    const lines = scriptText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // ── SKIP: Empty lines and comments ──
        if (trimmed === '' || trimmed.startsWith('--')) {
            i++;
            continue;
        }

        // ── SKIP: SET statements ──
        if (/^SET\s+/i.test(trimmed)) {
            // Consume until semicolon
            i = consumeUntilSemicolon(lines, i);
            summary.skipped++;
            continue;
        }

        // ── SKIP: SELECT pg_catalog ──
        if (/^SELECT\s+pg_catalog\./i.test(trimmed)) {
            i = consumeUntilSemicolon(lines, i);
            summary.skipped++;
            continue;
        }

        // ── SKIP: ALTER TABLE ... OWNER TO ──
        if (/^ALTER\s+TABLE\s+.*OWNER\s+TO/i.test(trimmed)) {
            i = consumeUntilSemicolon(lines, i);
            summary.skipped++;
            continue;
        }

        // ── HANDLE: CREATE TABLE ──
        if (/^CREATE\s+TABLE/i.test(trimmed)) {
            const { sql, endIndex, tableName } = parseCreateTable(lines, i);
            if (sql) {
                results.push({
                    sql: sql,
                    type: 'CREATE_TABLE',
                    description: `Create table: ${tableName}`
                });
                summary.tables++;
            }
            i = endIndex;
            continue;
        }

        // ── HANDLE: COPY ... FROM stdin ──
        if (/^COPY\s+/i.test(trimmed)) {
            const { statements, endIndex, tableName, rowCount } = parseCopyBlock(lines, i);
            statements.forEach(stmt => {
                results.push({
                    sql: stmt,
                    type: 'INSERT',
                    description: `Insert data into ${tableName}`
                });
            });
            summary.inserts += rowCount;
            i = endIndex;
            continue;
        }

        // ── HANDLE: ALTER TABLE ... ADD CONSTRAINT ──
        if (/^ALTER\s+TABLE/i.test(trimmed)) {
            const { sql, endIndex, description, skip } = parseAlterTable(lines, i);
            if (skip) {
                summary.skipped++;
            } else if (sql) {
                results.push({
                    sql: sql,
                    type: 'CONSTRAINT',
                    description: description
                });
                summary.constraints++;
            }
            i = endIndex;
            continue;
        }

        // ── SKIP: Anything else we don't recognize ──
        i = consumeUntilSemicolon(lines, i);
        summary.skipped++;
    }

    return { statements: results, summary };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Consume lines until we find a semicolon, return the index AFTER the semicolon line
 */
function consumeUntilSemicolon(lines, startIdx) {
    let i = startIdx;
    while (i < lines.length) {
        if (lines[i].trim().endsWith(';')) {
            return i + 1;
        }
        i++;
    }
    return i; // EOF
}

/**
 * Collect lines from startIdx until we find a line ending with semicolon.
 * Returns the full collected text and the index AFTER the last line.
 */
function collectStatement(lines, startIdx) {
    let collected = '';
    let i = startIdx;
    while (i < lines.length) {
        collected += lines[i] + '\n';
        if (lines[i].trim().endsWith(';')) {
            return { text: collected.trim(), endIndex: i + 1 };
        }
        i++;
    }
    return { text: collected.trim(), endIndex: i };
}

// ═══════════════════════════════════════════════════════════
// CREATE TABLE PARSER
// ═══════════════════════════════════════════════════════════

function parseCreateTable(lines, startIdx) {
    const { text, endIndex } = collectStatement(lines, startIdx);

    // Strip schema prefix: public.tablename → tablename
    let sql = text.replace(/\bpublic\./gi, '');

    // Type mappings: PostgreSQL → DuckDB
    sql = mapPgTypes(sql);

    // Extract table name for logging
    const nameMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
    const tableName = nameMatch ? nameMatch[1].replace(/"/g, '') : 'unknown';

    return { sql, endIndex, tableName };
}

/**
 * Map PostgreSQL-specific types to DuckDB-compatible types
 */
function mapPgTypes(sql) {
    // character varying(n) → VARCHAR(n)
    sql = sql.replace(/\bcharacter\s+varying\s*(\([^)]*\))/gi, 'VARCHAR$1');
    // character varying (without length) → VARCHAR
    sql = sql.replace(/\bcharacter\s+varying\b/gi, 'VARCHAR');
    // character(n) → VARCHAR(n)
    sql = sql.replace(/\bcharacter\s*(\([^)]*\))/gi, 'VARCHAR$1');
    // double precision → DOUBLE
    sql = sql.replace(/\bdouble\s+precision\b/gi, 'DOUBLE');
    // timestamp without time zone → TIMESTAMP
    sql = sql.replace(/\btimestamp\s+without\s+time\s+zone\b/gi, 'TIMESTAMP');
    // timestamp with time zone → TIMESTAMPTZ
    sql = sql.replace(/\btimestamp\s+with\s+time\s+zone\b/gi, 'TIMESTAMPTZ');
    // time without time zone → TIME
    sql = sql.replace(/\btime\s+without\s+time\s+zone\b/gi, 'TIME');
    // time with time zone → TIME
    sql = sql.replace(/\btime\s+with\s+time\s+zone\b/gi, 'TIME');
    // serial → INTEGER  (DuckDB doesn't have serial, but the data is provided anyway)
    sql = sql.replace(/\bbigserial\b/gi, 'BIGINT');
    sql = sql.replace(/\bserial\b/gi, 'INTEGER');
    // text → VARCHAR
    sql = sql.replace(/\btext\b/gi, 'VARCHAR');
    // bytea → BLOB
    sql = sql.replace(/\bbytea\b/gi, 'BLOB');
    // jsonb → JSON
    sql = sql.replace(/\bjsonb\b/gi, 'JSON');
    // inet, cidr, macaddr → VARCHAR (no direct DuckDB support)
    sql = sql.replace(/\binet\b/gi, 'VARCHAR');
    sql = sql.replace(/\bcidr\b/gi, 'VARCHAR');
    sql = sql.replace(/\bmacaddr\b/gi, 'VARCHAR');
    // money → DECIMAL(19,4)
    sql = sql.replace(/\bmoney\b/gi, 'DECIMAL(19,4)');

    return sql;
}

// ═══════════════════════════════════════════════════════════
// COPY ... FROM stdin PARSER
// ═══════════════════════════════════════════════════════════

function parseCopyBlock(lines, startIdx) {
    const headerLine = lines[startIdx].trim();

    // Parse: COPY public.tablename (col1, col2, ...) FROM stdin;
    const copyMatch = headerLine.match(
        /^COPY\s+(?:public\.)?(\S+)\s*\(([^)]+)\)\s*FROM\s+stdin\s*;?\s*$/i
    );

    if (!copyMatch) {
        // Unrecognized COPY format, skip it
        return { statements: [], endIndex: consumeUntilCopyEnd(lines, startIdx + 1), tableName: 'unknown', rowCount: 0 };
    }

    const tableName = copyMatch[1].replace(/"/g, '');
    const columns = copyMatch[2].split(',').map(c => c.trim());

    // Read data lines until we hit \. (end of COPY data)
    let i = startIdx + 1;
    const dataRows = [];

    while (i < lines.length) {
        const dataLine = lines[i];
        if (dataLine.trim() === '\\.') {
            i++; // skip the \. line
            break;
        }
        dataRows.push(dataLine);
        i++;
    }

    // Convert to INSERT statements in batches
    const BATCH_SIZE = 500;
    const statements = [];

    for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
        const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);
        const valueRows = batch.map(row => {
            const fields = row.split('\t');
            const values = fields.map(field => {
                if (field === '\\N') return 'NULL';
                // Escape single quotes in data
                const escaped = field.replace(/'/g, "''");
                return `'${escaped}'`;
            });
            return `(${values.join(', ')})`;
        });

        const insertSQL = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n${valueRows.join(',\n')};`;
        statements.push(insertSQL);
    }

    return { statements, endIndex: i, tableName, rowCount: dataRows.length };
}

/**
 * Consume lines until we find the COPY end marker (\.)
 */
function consumeUntilCopyEnd(lines, startIdx) {
    let i = startIdx;
    while (i < lines.length) {
        if (lines[i].trim() === '\\.') {
            return i + 1;
        }
        i++;
    }
    return i;
}

// ═══════════════════════════════════════════════════════════
// ALTER TABLE PARSER
// ═══════════════════════════════════════════════════════════

function parseAlterTable(lines, startIdx) {
    const { text, endIndex } = collectStatement(lines, startIdx);

    // Skip FOREIGN KEY constraints (DuckDB has limited support + ordering issues)
    if (/FOREIGN\s+KEY/i.test(text)) {
        return { sql: null, endIndex, description: 'Skipped FK constraint', skip: true };
    }

    // Skip OWNER TO
    if (/OWNER\s+TO/i.test(text)) {
        return { sql: null, endIndex, description: 'Skipped OWNER TO', skip: true };
    }

    // Process PRIMARY KEY and other constraints
    let sql = text;

    // Strip "ONLY" keyword: ALTER TABLE ONLY public.x → ALTER TABLE public.x
    sql = sql.replace(/\bALTER\s+TABLE\s+ONLY\b/gi, 'ALTER TABLE');

    // Strip schema prefix
    sql = sql.replace(/\bpublic\./gi, '');

    const description = /PRIMARY\s+KEY/i.test(sql) ? 'Add PRIMARY KEY constraint' : 'ALTER TABLE statement';

    return { sql, endIndex, description, skip: false };
}

// ═══════════════════════════════════════════════════════════
// EXPOSE GLOBALLY
// ═══════════════════════════════════════════════════════════

window.parsePgDump = parsePgDump;
