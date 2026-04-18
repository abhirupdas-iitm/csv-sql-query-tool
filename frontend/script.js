// 🦆 DuckDB is fully client-side — no backend needed for upload/query
// 🔥 NAME CONVERSION HELPERS
function displayName(name) {
    return name.replace(/__/g, "-");
}

function dbName(name) {
    return name.replace(/-/g, "__");
}
// 🔥 INIT AFTER DOM LOAD
window.addEventListener("DOMContentLoaded", () => {

    // 🔥 SIDEBAR TOGGLE
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("active");
        });
    }

    // ❌ REMOVED duplicate file trigger here (IMPORTANT)

    // 🔥 RESIZABLE PANELS
    const divider = document.getElementById("divider");
    const logsPanel = document.getElementById("logsPanel");
    const queryPanel = document.getElementById("queryPanel");
    const container = document.querySelector(".resizable-container");

    let isDragging = false;

    if (divider) {
        divider.addEventListener("mousedown", () => {
            isDragging = true;
            document.body.style.cursor = "col-resize";
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;

            const rect = container.getBoundingClientRect();
            let offsetX = e.clientX - rect.left;
            let total = rect.width;

            let logsWidth = (offsetX / total) * 100;
            let queryWidth = 100 - logsWidth;

            if (logsWidth < 10 || queryWidth < 20) return;

            logsPanel.style.width = logsWidth + "%";
            queryPanel.style.width = queryWidth + "%";
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            document.body.style.cursor = "default";
        });
    }

});

// 🔥 USER HELPER
function getCurrentUser() {
    let user = window.getUser();

    if (!user) {
        const anonId = localStorage.getItem("anon_id");
        if (anonId) user = { uid: anonId };
    }

    return user;
}

function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

// 🔥 LOGS
function logMessage(message, type = "info") {
    const logBox = document.getElementById("logs");
    if (!logBox) return;

    const line = document.createElement("div");

    if (type === "error") line.style.color = "#ff4d4d";
    else if (type === "success") line.style.color = "#00ff7f";
    else line.style.color = "#00cfff";

    line.innerText = message;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

// 🔥 UPLOAD — now fully client-side via DuckDB WASM
async function uploadCSV() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) return;

    const user = getCurrentUser();
    if (!user) return;

    logMessage("⬆ Loading file into DuckDB...", "info");

    try {
        showLoader();

        // Wait for the duckdb.js module to finish loading (safety net for timing)
        await window.duckDBReady;

        // Initialise DuckDB engine (no-op if already done)
        await window.duckDB.initDB();

        // Load CSV into DuckDB — returns the table name
        const tableName = await window.duckDB.loadCSVFile(file);

        logMessage(`✅ Loaded as table: ${tableName}`, "success");
        document.getElementById("viewERDiagramBtn").classList.remove("hidden");
        await loadTables();

    } catch (err) {
        console.error(err);
        logMessage("❌ Upload failed: " + err.message, "error");
    } finally {
        hideLoader();
    }
}

// 🔥 LOAD TABLES — reads from DuckDB in-memory, no backend
async function loadTables() {
    try {
        const tables = await window.duckDB.listTables();
        displayTables(tables);
    } catch (err) {
        console.error("loadTables error:", err);
        logMessage("❌ Could not list tables: " + err.message, "error");
    }
}

// 🔥 DISPLAY TABLES
function displayTables(tables) {
    const container = document.getElementById("tables");
    container.innerHTML = "";

    const grouped = {};
    const dbNamesSet = new Set();
    const tableNamesSet = new Set();

    tables.forEach(t => {
        let parentName = "Database Tables";
        if (window.tableToFileMap && window.tableToFileMap[t]) {
            parentName = window.tableToFileMap[t];
        } else {
            // fallback if not in map
            parentName = t;
        }
        
        if (!grouped[parentName]) grouped[parentName] = [];
        grouped[parentName].push(t);
        dbNamesSet.add(parentName);
        tableNamesSet.add(t);
    });

    // Populate Datalist
    const datalist = document.getElementById("dbNamesList");
    if(datalist) {
        datalist.innerHTML = "";
        dbNamesSet.forEach(db => {
            const opt = document.createElement("option");
            opt.value = db;
            datalist.appendChild(opt);
        });
        tableNamesSet.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            datalist.appendChild(opt);
        });
    }

    for (const sheet in grouped) {
        const sheetDiv = document.createElement("div");
        sheetDiv.className = "sheet active";

        const title = document.createElement("div");
        title.style.display = "flex";
        title.style.justifyContent = "space-between";
        title.style.alignItems = "center";
        title.style.width = "100%";

        const titleText = document.createElement("span");
        titleText.innerHTML = `📁 <span>${sheet}</span>`;
        
        const dbEditIcon = document.createElement("span");
        dbEditIcon.innerHTML = "✏️";
        dbEditIcon.className = "action-icon";
        dbEditIcon.title = "Rename Database";
        dbEditIcon.onclick = (e) => { e.stopPropagation(); window.renameDatabaseFunc(sheet, titleText.querySelector("span")); };
        
        const titleContentDiv = document.createElement("div");
        titleContentDiv.appendChild(titleText);
        titleContentDiv.appendChild(dbEditIcon);
        title.appendChild(titleContentDiv);

        const tablesDiv = document.createElement("div");
        tablesDiv.className = "tables";

        grouped[sheet].forEach(t => {
            const item = document.createElement("div");
            item.style.display = "flex";
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";
            item.style.marginTop = "4px";

            const nameSpan = document.createElement("span");
            nameSpan.innerText = `└ ${t}`;
            nameSpan.style.cursor = "pointer";
            nameSpan.onclick = () => {
                document.getElementById("query").value = `SELECT * FROM "${t}";`;
            };
            
            const actionsDiv = document.createElement("div");
            actionsDiv.style.display = "flex";
            actionsDiv.style.gap = "5px";

            const downloadIcon = document.createElement("span");
            downloadIcon.innerHTML = "📥";
            downloadIcon.className = "action-icon";
            downloadIcon.title = "Download CSV";
            downloadIcon.onclick = (e) => { e.stopPropagation(); window.downloadTableFunc(t); };
            
            const editIcon = document.createElement("span");
            editIcon.innerHTML = "✏️";
            editIcon.className = "action-icon";
            editIcon.title = "Rename Table";
            editIcon.onclick = (e) => { e.stopPropagation(); window.renameTableFunc(t, nameSpan, sheet); };

            actionsDiv.appendChild(editIcon);
            actionsDiv.appendChild(downloadIcon);
            
            item.appendChild(nameSpan);
            item.appendChild(actionsDiv);
            tablesDiv.appendChild(item);
        });

        title.onclick = () => {
            const isActive = sheetDiv.classList.contains("active");

            // 🔥 CLOSE ALL SHEETS FIRST
            document.querySelectorAll(".sheet").forEach(s => {
                s.classList.remove("active");
            });

            // 🔥 OPEN ONLY IF IT WAS NOT ACTIVE
            if (!isActive) {
                sheetDiv.classList.add("active");
            }
        };

        sheetDiv.appendChild(title);
        sheetDiv.appendChild(tablesDiv);
        container.appendChild(sheetDiv);
    }
}

// 🔥 RUN QUERY — fully client-side via DuckDB WASM
async function runQuery() {
    const user = getCurrentUser();
    if (!user) return;

    let sql = document.getElementById("query").value.trim();
    if (!sql) return;

    let runSql = sql;
    // Auto-quote unquoted table names to prevent parse errors from hyphens without requiring the user to type quotes.
    if (window.tableToFileMap) {
        Object.keys(window.tableToFileMap).forEach(tableName => {
            if (tableName.includes("-")) {
                runSql = runSql.split(tableName).join(`"${tableName}"`);
            }
        });
        runSql = runSql.replace(/""/g, '"'); // Cleanup in case they already quoted it
    }

    logMessage("⚡ Running query...", "info");

    try {
        const data = await window.duckDB.queryDB(runSql);

        logMessage("✅ Query executed", "success");
        displayResults(data);

        // Save query then reload history after Firestore has time to persist
        await window.saveQuery(sql);
        setTimeout(() => {
            loadHistory();
        }, 500);

    } catch (err) {
        console.error(err);
        logMessage("❌ Query error: " + err.message, "error");
    }
}

// 🔥 RESULTS
function displayResults(data) {
    const div = document.getElementById("result");
    div.innerHTML = "";

    if (!data.rows || data.rows.length === 0) {
        div.innerHTML = "<p style='color:#888; padding:10px;'>No results.</p>";
        return;
    }

    const table = document.createElement("table");

    const headerRow = document.createElement("tr");
    data.columns.forEach(col => {
        const th = document.createElement("th");
        th.innerText = col;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    data.rows.forEach(row => {
        const tr = document.createElement("tr");
        row.forEach(cell => {
            const td = document.createElement("td");
            td.innerText = cell ?? "";
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });

    div.appendChild(table);
}

// 🔥 HISTORY
async function loadHistory() {
    const historyDiv = document.getElementById("historyList");
    if (!historyDiv) return;

    try {
        const queries = await window.getQueryHistory();

        if (!queries || queries.length === 0) {
            historyDiv.innerHTML = "<div style='color:#888; padding:10px;'>No queries yet...</div>";
            return;
        }

        historyDiv.innerHTML = "";

        queries.forEach((q, index) => {
            const item = document.createElement("div");
            item.className = "history-item";

            // Parse date safely (handles Firestore Timestamp and regular Date)
            let dateStr = "";
            if (q.created_at) {
                if (q.created_at.seconds) {
                    dateStr = new Date(q.created_at.seconds * 1000).toLocaleString();
                } else if (q.created_at.toDate) {
                    dateStr = q.created_at.toDate().toLocaleString();
                } else {
                    dateStr = new Date(q.created_at).toLocaleString();
                }
            }

            item.innerHTML = `
                <div class="history-index">#${index + 1}</div>
                <div class="history-query">${q.query}</div>
                <div class="history-time">${dateStr}</div>
            `;

            item.onclick = () => {
                document.getElementById("query").value = q.query;
            };

            historyDiv.appendChild(item);
        });
    } catch (err) {
        console.error("Error loading history:", err);
        historyDiv.innerHTML = "<div style='color:#ff4d4d; padding:10px;'>Failed to load history</div>";
    }
}

// 🔥 EXPOSE loadHistory globally so auth.js can call it
window.loadHistory = loadHistory;

// 🔥 ACTIONS & FEATURES
window.renameTableFunc = (oldName, nameSpan, dbName) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = oldName;
    input.className = "rename-input";
    input.setAttribute("list", "dbNamesList");
    
    nameSpan.innerHTML = "";
    nameSpan.appendChild(input);
    input.focus();

    const saveName = async () => {
        const newName = input.value.trim();
        if(newName && newName !== oldName) {
            try {
                showLoader();
                await window.duckDB.queryDB(`ALTER TABLE "${oldName}" RENAME TO "${newName}"`);
                logMessage(`✅ Renamed table ${oldName} to ${newName}`, "success");
                // Update tableToFileMap
                if(window.tableToFileMap && window.tableToFileMap[oldName]) {
                    window.tableToFileMap[newName] = window.tableToFileMap[oldName];
                    delete window.tableToFileMap[oldName];
                } else if(window.tableToFileMap) {
                    window.tableToFileMap[newName] = dbName;
                }
                await loadTables();
            } catch(e) {
                logMessage(`❌ Failed to rename table: ${e.message}`, "error");
                nameSpan.innerHTML = `└ ${oldName}`;
            } finally {
                hideLoader();
            }
        } else {
            nameSpan.innerHTML = `└ ${oldName}`;
        }
    };
    
    input.onblur = saveName;
    input.onkeydown = (e) => {
        if(e.key === "Enter") saveName();
        if(e.key === "Escape") nameSpan.innerHTML = `└ ${oldName}`;
    };
};

window.renameDatabaseFunc = (oldName, nameSpan) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = oldName;
    input.className = "rename-input";
    input.setAttribute("list", "dbNamesList");
    
    nameSpan.innerHTML = "";
    nameSpan.appendChild(input);
    input.focus();

    const saveName = async () => {
        const newName = input.value.trim();
        if(newName && newName !== oldName) {
            if(window.tableToFileMap) {
                Object.keys(window.tableToFileMap).forEach(tableName => {
                    if(window.tableToFileMap[tableName] === oldName) {
                        window.tableToFileMap[tableName] = newName;
                    }
                });
            }
            await loadTables();
        } else {
            nameSpan.innerText = oldName;
        }
    };
    
    input.onblur = saveName;
    input.onkeydown = (e) => {
        if(e.key === "Enter") saveName();
        if(e.key === "Escape") nameSpan.innerText = oldName;
    };
};

window.downloadTableFunc = async (tableName) => {
    try {
        logMessage(`📥 Downloading table ${tableName}...`, "info");
        const data = await window.duckDB.queryDB(`SELECT * FROM "${tableName}"`);
        if(!data || !data.rows || data.rows.length === 0) return logMessage("❌ Table is empty", "error");
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += data.columns.join(",") + "\r\n";
        data.rows.forEach(row => {
            let rowStr = row.map(v => {
                if (v === null || v === undefined) return "";
                const str = String(v);
                return str.match(/[",\n]/) ? `"${str.replace(/"/g, '""')}"` : str;
            }).join(",");
            csvContent += rowStr + "\r\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${tableName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        logMessage(`✅ Downloaded ${tableName}`, "success");
    } catch(err) {
        logMessage(`❌ Failed to download table: ${err.message}`, "error");
    }
};

window.showERDiagram = async () => {
    const modal = document.getElementById("erModal");
    const container = document.getElementById("erDiagramContainer");
    modal.classList.remove("hidden");
    container.innerHTML = "<h3 style='color:black;'>Generating ER Diagram...</h3>";
    
    try {
        const tables = await window.duckDB.listTables();
        if(tables.length === 0) {
            container.innerHTML = "<p style='color:black;'>No tables loaded to generate diagram.</p>";
            return;
        }
        
        let mermaidStr = "graph TD\n";
        mermaidStr += "classDef entity fill:#29b6f6,stroke:#fff,stroke-width:2px,color:#000;\n";
        mermaidStr += "classDef attr fill:#556b2f,stroke:#fff,stroke-width:2px,color:#fff;\n";
        mermaidStr += "classDef rel fill:#800020,stroke:#fff,stroke-width:2px,color:#fff;\n\n";

        let allCols = {}; 
        
        for (const t of tables) {
            const schema = await window.duckDB.queryDB(`DESCRIBE "${t}"`);
            allCols[t] = schema.rows.map(r => r[0].toLowerCase());
            
            const tId = "ENT_" + t.replace(/[^a-zA-Z0-9]/g, "");
            mermaidStr += `  ${tId}["${t}"]:::entity\n`;
            
            for(let row of schema.rows) {
                const colName = row[0];
                const cId = tId + "_ATTR_" + colName.replace(/[^a-zA-Z0-9]/g, "");
                mermaidStr += `  ${cId}(["${colName}"]):::attr\n`;
                mermaidStr += `  ${tId} --- ${cId}\n`;
            }
            mermaidStr += "\n";
        }
        
        // Basic heuristic for relations
        const possibleKeys = new Set();
        for (const t in allCols) {
            for (const c of allCols[t]) {
                if (c.endsWith("id") || c === "id" || c.includes("_id") || c.includes("id_")) {
                    possibleKeys.add(c);
                }
            }
        }
        
        let relCounter = 0;
        for (const key of possibleKeys) {
            let tablesWithKey = [];
            for (const t in allCols) {
                if (allCols[t].includes(key)) tablesWithKey.push(t);
            }
            // Draw lines if multiple tables share an ID-like column
            if (tablesWithKey.length > 1) {
                const relId = "REL_" + relCounter++;
                mermaidStr += `  ${relId}{"Shares ${key}"}:::rel\n`;
                for (const t of tablesWithKey) {
                    const tId = "ENT_" + t.replace(/[^a-zA-Z0-9]/g, "");
                    mermaidStr += `  ${relId} --- ${tId}\n`;
                }
            }
        }
        
        container.innerHTML = `<div class="mermaid">${mermaidStr}</div>`;
        if (window.mermaid) {
            await window.mermaid.run({
                nodes: [container.querySelector('.mermaid')]
            });
        }
    } catch(err) {
        console.error(err);
        logMessage(`❌ Failed to generate ER diagram: ${err.message}`, "error");
        container.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
};

window.closeERDiagram = () => {
    document.getElementById("erModal").classList.add("hidden");
};