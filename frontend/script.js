const BASE_URL = "https://sheetql-backend.onrender.com";

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

// 🔥 UPLOAD
async function uploadCSV() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Select a file first");
        return;
    }

    const user = getCurrentUser();

    if (!user) {
        alert("Please login or use anonymously first");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user.uid);

    try {
        const res = await fetch(`${BASE_URL}/upload`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        console.log("UPLOAD RESPONSE:", data);

        if (data.error) {
            logMessage(data.error, "error");
            return;
        }

        logMessage("Upload successful", "success");
        loadTables();

    } catch (err) {
        console.error(err);
        logMessage("Upload failed", "error");
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
        console.log("TABLES:", data);

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

            // 🔥 BONUS: click → auto fill query
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

    logBox.scrollTop = logBox.scrollHeight; // auto-scroll
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
        logMessage("Query executed successfully", "success");
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

    // headers
    const headerRow = document.createElement("tr");
    data.columns.forEach(col => {
        const th = document.createElement("th");
        th.innerText = col;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // rows
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


// 🔥 FILE NAME DISPLAY
document.getElementById("fileInput").addEventListener("change", function () {
    const fileName = this.files[0]?.name || "No file chosen";
    document.getElementById("fileName").innerText = fileName;
});