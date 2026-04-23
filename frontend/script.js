// 🦆 DuckDB is fully client-side — no backend needed for upload/query
// 🔥 NAME CONVERSION HELPERS
function displayName(name) {
    return name.replace(/__/g, "-");
}

function dbName(name) {
    return name.replace(/-/g, "__");
}

window.lastQueryResult = null;
window.myChart = null;

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

    // 🔥 REFRESH SNIPPETS ON LOAD
    setTimeout(window.loadSnippets, 2000);

    // 🔥 INITIAL SYNC
    window.syncEditor();
    
    // 🔥 LOAD THEME
    const savedTheme = localStorage.getItem("sheetql_theme");
    if(savedTheme) window.updateThemeColor(savedTheme);

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
                document.getElementById("query").value = `SELECT * FROM ${t};`;
                if(window.syncEditor) window.syncEditor();
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
    
    // 🔥 AUTO-QUOTE SYSTEM
    // Transparently wrap known table names in quotes so the user doesn't have to
    try {
        const tables = await window.duckDB.listTables();
        tables.forEach(tableName => {
            // Use regex to find the table name as a whole word, 
            // but only if it's NOT already preceded by a double quote.
            const regex = new RegExp(`(?<!")\\b${tableName.replace(/-/g, '\\-')}\\b(?!")`, 'g');
            runSql = runSql.replace(regex, `"${tableName}"`);
        });
    } catch (e) {
        console.error("Auto-quote failed:", e);
    }

    logMessage("⚡ Running query...", "info");

    try {
        const startTime = performance.now();
        const data = await window.duckDB.queryDB(runSql);
        const duration = (performance.now() - startTime).toFixed(1);

        window.lastQueryResult = data;

        logMessage(`✅ Query executed in ${duration}ms`, "success");
        
        // Update metadata and show actions
        const meta = document.getElementById("queryMetadata");
        if(meta) meta.innerText = `(${data.rows.length} rows, ${duration}ms)`;
        
        document.getElementById("downloadResultBtn").classList.remove("hidden");
        
        // Detection for chart-ability
        const isChartable = data.columns.length >= 2;
        if(isChartable) {
            document.getElementById("toggleChartBtn").classList.remove("hidden");
            document.getElementById("chartType").classList.remove("hidden");
        } else {
            document.getElementById("toggleChartBtn").classList.add("hidden");
            document.getElementById("chartType").classList.add("hidden");
        }

        displayResults(data);

        // Reset chart if it exists
        if(window.myChart) {
            window.myChart.destroy();
            window.myChart = null;
            document.getElementById("resultChartContainer").classList.add("hidden");
            document.getElementById("resultTableContainer").classList.remove("hidden");
            document.getElementById("toggleChartBtn").innerText = "📊 Visualise";
        }

        // Save query then reload history after Firestore has time to persist
        await window.saveQuery(sql);
        setTimeout(() => {
            loadHistory();
        }, 500);

    } catch (err) {
        console.error(err);
        logMessage("❌ Query error: " + err.message, "error");
        document.getElementById("downloadResultBtn").classList.add("hidden");
        document.getElementById("toggleChartBtn").classList.add("hidden");
        if(document.getElementById("queryMetadata")) document.getElementById("queryMetadata").innerText = "";
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
        container.innerHTML = "<h3 style='color:var(--accent);'>Generating ER Diagram...</h3>";
    
    try {
        const tables = await window.duckDB.listTables();
        if(tables.length === 0) {
            container.innerHTML = "<p style='color:#888;'>No tables loaded to generate diagram.</p>";
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

// 🔥 PHASE 2: NEW FEATURES

window.downloadCurrentResult = () => {
    if(!window.lastQueryResult) return;
    const data = window.lastQueryResult;
    
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
    link.setAttribute("download", `query_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logMessage("✅ Exported results to CSV", "success");
};

window.toggleChartView = () => {
    const tableDiv = document.getElementById("resultTableContainer");
    const chartDiv = document.getElementById("resultChartContainer");
    const btn = document.getElementById("toggleChartBtn");

    if (chartDiv.classList.contains("hidden")) {
        tableDiv.classList.add("hidden");
        chartDiv.classList.remove("hidden");
        btn.innerText = "🔙 Show Table";
        renderChart();
    } else {
        tableDiv.classList.remove("hidden");
        chartDiv.classList.add("hidden");
        btn.innerText = "📊 Visualise";
    }
};

function renderChart() {
    if (!window.lastQueryResult) return;
    const data = window.lastQueryResult;
    const container = document.getElementById('resultChartContainer');
    
    // Clear the container and re-inject a fresh canvas to prevent Chart.js state collision
    container.innerHTML = '<canvas id="resultChart"></canvas>';
    const canvas = document.getElementById('resultChart');
    const ctx = canvas.getContext('2d');

    const chartType = document.getElementById("chartType").value || "bar";

    // 1. IMPROVED DATA HEURISTIC
    let valueColIndex = -1;
    for (let i = 1; i < data.columns.length; i++) {
        const isNumeric = data.rows.slice(0, 10).some(r => {
            const val = r[i];
            return typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val));
        });
        if (isNumeric) {
            valueColIndex = i;
            break;
        }
    }
    if (valueColIndex === -1) valueColIndex = 1;

    let chartData = data.rows.map(r => ({
        label: String(r[0]),
        value: parseFloat(r[valueColIndex]) || 0
    }));

    // 2. SORT DATA for pie/radar (descending by value for readability)
    if (chartType === 'pie' || chartType === 'radar') {
        chartData = chartData.sort((a, b) => b.value - a.value);
    }

    const labels = chartData.map(d => d.label);
    const values = chartData.map(d => d.value);
    const label = data.columns[valueColIndex];

    // 3. SCALE CONFIGURATION
    let scales = {};
    if (chartType === 'radar') {
        scales = {
            r: {
                angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                grid: { color: 'rgba(255, 255, 255, 0.2)' },
                pointLabels: { color: '#fff' },
                ticks: { backdropColor: 'transparent', color: '#fff' }
            }
        };
    } else if (chartType !== 'pie') {
        scales = {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#fff' }
            },
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#fff' }
            }
        };
    }

    try {
        if (window.myChart) window.myChart.destroy();

        window.myChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: chartType === 'pie' ? 
                        labels.map((_, i) => `hsla(${(i * 360) / labels.length}, 70%, 50%, 0.6)`) : 
                        'rgba(0, 230, 118, 0.3)',
                    borderColor: '#00e676',
                    borderWidth: 2,
                    fill: chartType === 'radar' || chartType === 'line'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: scales,
                plugins: {
                    legend: {
                        display: chartType !== 'bar',
                        labels: { color: '#fff' },
                        position: chartType === 'pie' ? 'right' : 'top'
                    }
                }
            }
        });
    } catch(err) {
        console.error("Rendering Error:", err);
        logMessage(`❌ Chart rendering error: ${err.message}`, "error");
    }
}

// 🔥 ER DIAGRAM ZOOM & PAN LOGIC
let zoomScale = 1;
let isPanning = false;
let startX, startY, scrollLeft, scrollTop;

function initERInteractions() {
    const container = document.getElementById("erDiagramContainer");
    
    // Zoom via Wheel
    container.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomScale = Math.min(Math.max(0.1, zoomScale + delta), 3);
        applyERTransform();
    });

    // Pan via Mouse
    container.addEventListener("mousedown", (e) => {
        isPanning = true;
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
    });

    container.addEventListener("mouseleave", () => { isPanning = false; });
    container.addEventListener("mouseup", () => { isPanning = false; });

    container.addEventListener("mousemove", (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const y = e.pageY - container.offsetTop;
        const walkX = (x - startX) * 2;
        const walkY = (y - startY) * 2;
        container.scrollLeft = scrollLeft - walkX;
        container.scrollTop = scrollTop - walkY;
    });

    // Zoom Controls
    if (!document.querySelector(".zoom-controls")) {
        const controls = document.createElement("div");
        controls.className = "zoom-controls";
        controls.innerHTML = `
            <div class="zoom-btn" onclick="adjustZoom(0.1)">+</div>
            <div class="zoom-btn" onclick="adjustZoom(-0.1)">-</div>
            <div class="zoom-btn" onclick="resetZoom()">↺</div>
        `;
        container.parentElement.appendChild(controls);
    }
}

window.adjustZoom = (delta) => {
    zoomScale = Math.min(Math.max(0.1, zoomScale + delta), 3);
    applyERTransform();
};

window.resetZoom = () => {
    zoomScale = 1;
    applyERTransform();
    const container = document.getElementById("erDiagramContainer");
    container.scrollLeft = 0;
    container.scrollTop = 0;
};

function applyERTransform() {
    const mermaidEl = document.querySelector("#erDiagramContainer .mermaid");
    if(mermaidEl) {
        mermaidEl.style.transform = `scale(${zoomScale})`;
    }
}

// Wrap showERDiagram to add interaction init
const originalShowER = window.showERDiagram;
window.showERDiagram = async () => {
    await originalShowER();
    setTimeout(initERInteractions, 500);
};

// 🔥 PHASE 3 Features

window.syncEditor = () => {
    const query = document.getElementById("query");
    const overlay = document.querySelector("#editorOverlay code");
    if (!query || !overlay) return;

    let content = query.value;
    if (content[content.length - 1] === "\n") content += " ";
    
    overlay.textContent = content;
    if (window.Prism) {
        window.Prism.highlightElement(overlay);
    }
    
    // Sync scroll
    document.getElementById("editorOverlay").scrollTop = query.scrollTop;
};

// Hook scroll to sync highlighter
window.addEventListener('load', () => {
    const q = document.getElementById("query");
    if(q) {
        q.addEventListener('scroll', () => {
            document.getElementById("editorOverlay").scrollTop = q.scrollTop;
        });
    }
});

window.switchSidebarTab = (tab) => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".sidebar-content").forEach(c => c.classList.add("hidden"));
    
    if (tab === 'history') {
        document.querySelector(".tab-btn[onclick*='history']").classList.add("active");
        document.getElementById("historyTab").classList.remove("hidden");
    } else {
        document.querySelector(".tab-btn[onclick*='saved']").classList.add("active");
        document.getElementById("savedTab").classList.remove("hidden");
        window.loadSnippets();
    }
};

window.saveSnippet = async () => {
    const nameInput = document.getElementById("snippetName");
    const name = nameInput.value.trim();
    const queryText = document.getElementById("query").value.trim();
    
    if (!name || !queryText) return logMessage("❌ Name and query are required!", "error");
    
    try {
        showLoader();
        await window.saveSnippet(name, queryText);
        logMessage(`✅ Saved snippet: ${name}`, "success");
        nameInput.value = "";
        window.loadSnippets();
    } catch (err) {
        logMessage(`❌ Failed to save snippet: ${err.message}`, "error");
    } finally {
        hideLoader();
    }
};

window.loadSnippets = async () => {
    const container = document.getElementById("savedList");
    if (!container) return;
    
    const snippets = await window.getSnippets();
    if (!snippets || snippets.length === 0) {
        container.innerHTML = "<div style='color:#888; padding:10px;'>No snippets saved yet...</div>";
        return;
    }
    
    container.innerHTML = "";
    snippets.forEach(s => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `
            <div style="color:var(--accent-bright); font-weight:bold; font-size:12px;">${s.name}</div>
            <div class="history-query">${s.query}</div>
        `;
        item.onclick = () => {
            document.getElementById("query").value = s.query;
            window.syncEditor();
        };
        container.appendChild(item);
    });
};

window.toggleSettings = () => {
    document.getElementById("settingsPanel").classList.toggle("hidden");
};

// 🔥 CLICK OUTSIDE TO CLOSE SETTINGS
document.addEventListener("click", (e) => {
    const panel = document.getElementById("settingsPanel");
    const btn = document.getElementById("themeBtn");
    if (!panel || !btn) return;

    if (!panel.contains(e.target) && e.target !== btn && !panel.classList.contains("hidden")) {
        panel.classList.add("hidden");
    }
});

window.updateThemeColor = (color) => {
    document.documentElement.style.setProperty('--accent', color);
    
    // Simple logic to generate a "bright" version (lighter)
    const bright = hexToLighter(color, 20);
    document.documentElement.style.setProperty('--accent-bright', bright);
    
    localStorage.setItem("sheetql_theme", color);
    const picker = document.getElementById("accentColor");
    if(picker) picker.value = color;
};

function hexToLighter(hex, percent) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    
    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
    
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}