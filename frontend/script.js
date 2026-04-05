const BASE_URL = "https://sheetql-backend.onrender.com";

// 🔥 PRE-WARM BACKEND (Silent)
window.addEventListener("load", async () => {
    try {
        await fetch(`${BASE_URL}/`);
        console.log("Backend warmed up");
    } catch (err) {
        console.log("Pre-warm failed (safe to ignore)");
    }
});

// 🔥 HELPER: GET USER (handles both auth + anonymous)
function getCurrentUser() {
    let user = window.getUser();

    if (!user) {
        const anonId = localStorage.getItem("anon_id");
        if (anonId) {
            user = { uid: anonId };
        }
    }

    return user;
}

function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

// 🔥 UPLOAD
async function uploadCSV() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        logMessage("No file selected", "error");
        return;
    }

    const user = getCurrentUser();

    if (!user) {
        logMessage("Please login first", "error");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user.uid);

    logMessage("⬆ Uploading file...", "info");

    try {
        showLoader();

        logMessage("⚙ Processing data...", "info");

        const res = await fetch(`${BASE_URL}/upload`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (data.error) {
            logMessage(data.error, "error");
            hideLoader();
            return;
        }

        logMessage("Tables ready", "success");

        await loadTables();
        logMessage("Tables loaded", "info");

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

    try {
        const res = await fetch(`${BASE_URL}/tables`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: user.uid
            })
        });

        const data = await res.json();
        displayTables(data.tables);

    } catch (err) {
        console.error(err);
    }
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
            item.innerText = `└ ${t}`;

            item.onclick = () => {
                document.getElementById("query").value = `SELECT * FROM ${t};`;
            };

            tablesDiv.appendChild(item);
        });

        title.onclick = () => {
            sheetDiv.classList.toggle("active");
        };

        sheetDiv.appendChild(title);
        sheetDiv.appendChild(tablesDiv);
        container.appendChild(sheetDiv);
    }
}

function logMessage(message, type = "info") {
    const logBox = document.getElementById("logs");
    if (!logBox) return;

    const line = document.createElement("div");

    if (type === "error") {
        line.style.color = "#ff4d4d";
    } else if (type === "success") {
        line.style.color = "#00ff7f";
    } else {
        line.style.color = "#00cfff";
    }

    line.innerText = message;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

// 🔥 RUN QUERY
async function runQuery() {
    const user = getCurrentUser();
    const query = document.getElementById("query").value;

    if (!user) {
        alert("Login or use anonymously first");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: user.uid,
                query: query
            })
        });

        const data = await res.json();

        if (data.error) {
            logMessage(data.error, "error");
            return;
        }

        logMessage("Query executed", "success");
        window.saveQuery(query);

        displayResults(data);

    } catch (err) {
        console.error(err);
    }
}

// 🔥 DISPLAY RESULTS
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

// 🔥 AUTO UPLOAD ON FILE SELECT
document.getElementById("fileInput").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    document.getElementById("fileName").innerText = file.name;
    logMessage(`📄 File selected: ${file.name}`, "info");

    setTimeout(() => {
        uploadCSV();
    }, 800);
});

// 🔥 RESIZABLE LOGS ↔ QUERY
window.addEventListener("load", () => {
    const divider = document.getElementById("divider");
    const logsPanel = document.getElementById("logsPanel");
    const queryPanel = document.getElementById("queryPanel");
    const container = document.querySelector(".resizable-container");

    let isDragging = false;

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
});