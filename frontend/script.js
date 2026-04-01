import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const BASE_URL = "https://sheetql-backend.onrender.com";

function getUser() {
    const auth = getAuth();
    return auth.currentUser;
}


// 🔥 UPLOAD
async function uploadCSV() {
    const file = document.getElementById("fileInput").files[0];
    const user = getUser();

    if (!user) {
        alert("Login first!");
        return;
    }

    let formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user.uid);

    let response = await fetch(`${BASE_URL}/upload`, {
        method: "POST",
        body: formData
    });

    let data = await response.json();
    alert(JSON.stringify(data));

    loadTables();
}


// 🔥 QUERY
async function runQuery() {
    const user = getUser();

    if (!user) {
        alert("Login first!");
        return;
    }

    const query = document.getElementById("query").value;

    let response = await fetch(`${BASE_URL}/query`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            query: query,
            user_id: user.uid
        })
    });

    let data = await response.json();
    displayResult(data);
}


// 🔥 LOAD TABLES
async function loadTables() {
    const user = getUser();

    if (!user) return;

    let response = await fetch(`${BASE_URL}/tables`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user_id: user.uid
        })
    });

    let data = await response.json();

    let grouped = {};

    data.tables.forEach(table => {
        let [sheet, name] = table.split("__");

        if (!grouped[sheet]) {
            grouped[sheet] = [];
        }

        grouped[sheet].push(name);
    });

    displayTables(grouped);
}


// 🔥 DISPLAY TABLES
function displayTables(grouped) {
    let container = document.getElementById("tables");
    container.innerHTML = "";

    for (let sheet in grouped) {
        let sheetDiv = document.createElement("div");
        sheetDiv.innerHTML = `📁 <b>${sheet}</b>`;
        sheetDiv.style.cursor = "pointer";

        let tableList = document.createElement("div");
        tableList.style.display = "none";
        tableList.style.marginLeft = "20px";

        grouped[sheet].forEach(table => {
            let tableItem = document.createElement("div");
            tableItem.innerHTML = `📄 ${table}`;
            tableList.appendChild(tableItem);
        });

        sheetDiv.onclick = () => {
            tableList.style.display =
                tableList.style.display === "none" ? "block" : "none";
        };

        container.appendChild(sheetDiv);
        container.appendChild(tableList);
    }
}


// 🔥 DISPLAY RESULT
function displayResult(data) {
    let resultDiv = document.getElementById("result");

    if (data.error) {
        resultDiv.innerHTML = data.error;
        return;
    }

    let table = "<table border='1'><tr>";

    data.columns.forEach(col => {
        table += `<th>${col}</th>`;
    });

    table += "</tr>";

    data.rows.forEach(row => {
        table += "<tr>";
        row.forEach(cell => {
            table += `<td>${cell}</td>`;
        });
        table += "</tr>";
    });

    table += "</table>";

    resultDiv.innerHTML = table;
}