const BASE_URL = "https://sheetql-backend.onrender.com";

// 🔥 UPLOAD
async function uploadCSV() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Select a file first");
        return;
    }

    const user = window.getUser();

    if (!user) {
        alert("Please login first");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user.uid);  // 🔥 CRITICAL

    try {
        const res = await fetch(`${BASE_URL}/upload`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        console.log("UPLOAD RESPONSE:", data);

        if (data.error) {
            alert(data.error);
            return;
        }

        alert("Upload successful!");
        loadTables();

    } catch (err) {
        console.error(err);
        alert("Upload failed");
    }
}


// 🔥 LOAD TABLES
async function loadTables() {
    const user = window.getUser();

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
    const div = document.getElementById("tables");
    div.innerHTML = "";

    tables.forEach(t => {
        const p = document.createElement("p");
        p.innerText = t;
        div.appendChild(p);
    });
}


// 🔥 RUN QUERY
async function runQuery() {
    const user = window.getUser();
    const query = document.getElementById("query").value;

    if (!user) {
        alert("Login first");
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
        console.log("QUERY:", data);

        if (data.error) {
            alert(data.error);
            return;
        }

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