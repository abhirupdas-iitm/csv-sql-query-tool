const BASE_URL = "https://sheetql-backend.onrender.com";

// 🔥 PRE-WARM BACKEND
window.addEventListener("load", async () => {
    try {
        await fetch(`${BASE_URL}/`);
        console.log("Backend warmed up");
    } catch {
        console.log("Pre-warm failed (safe to ignore)");
    }
});
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

// 🔥 UPLOAD
async function uploadCSV() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) return;

    const user = getCurrentUser();
    if (!user) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user.uid);

    logMessage("⬆ Uploading file...", "info");

    try {
        showLoader();

        const res = await fetch(`${BASE_URL}/upload`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (data.error) {
            logMessage(data.error, "error");
            return;
        }

        logMessage("Tables ready", "success");
        await loadTables();

    } catch (err) {
        console.error(err);
        logMessage("Upload failed", "error");
    } finally {
        hideLoader();
    }
}

// 🔥 LOAD TABLES
async function loadTables() {
    const user = getCurrentUser();
    if (!user) return;

    const res = await fetch(`${BASE_URL}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid })
    });

    const data = await res.json();
    displayTables(data.tables);
}

// 🔥 DISPLAY TABLES
function displayTables(tables) {
    const container = document.getElementById("tables");
    container.innerHTML = "";

    const grouped = {};

    tables.forEach(t => {
        const [sheet] = t.split("__");
        if (!grouped[sheet]) grouped[sheet] = [];
        grouped[sheet].push(t);
    });

    for (const sheet in grouped) {
        const sheetDiv = document.createElement("div");
        sheetDiv.className = "sheet";

        const title = document.createElement("div");
        title.innerHTML = `📁 ${sheet}`;

        const tablesDiv = document.createElement("div");
        tablesDiv.className = "tables";

        grouped[sheet].forEach(t => {
            const item = document.createElement("div");
            item.innerText = `└ ${displayName(t)}`;
            item.onclick = () => {
                document.getElementById("query").value = `SELECT * FROM ${displayName(t)};`;
            };
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

// 🔥 RUN QUERY
async function runQuery() {
    const user = getCurrentUser();
    let query = document.getElementById("query").value;

    // 🔥 convert user-friendly names back to DB names
    query = query.replace(/([a-zA-Z0-9]+-[a-zA-Z0-9]+)/g, (match) => {
        return dbName(match);
    });

    if (!user) return;

    const res = await fetch(`${BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid, query })
    });

    const data = await res.json();

    if (data.error) {
        logMessage(data.error, "error");
        return;
    }

    logMessage("Query executed", "success");
    displayResults(data);

    // Save query then reload history after Firestore has time to persist
    await window.saveQuery(query);
    setTimeout(() => {
        loadHistory();
    }, 500);
}

// 🔥 RESULTS
function displayResults(data) {
    const div = document.getElementById("result");
    div.innerHTML = "";

    if (!data.rows) return;

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
            td.innerText = cell;
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