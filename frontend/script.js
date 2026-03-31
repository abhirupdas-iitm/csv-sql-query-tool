async function uploadCSV() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    let formData = new FormData();
    formData.append("file", file);

    let response = await fetch("https://sheetql-backend.onrender.com/upload", {
        method: "POST",
        body: formData
    });

    let data = await response.json();
    alert(JSON.stringify(data));

    // 🔥 NEW LINE
    loadTables();
}


async function runQuery() {
    const query = document.getElementById("query").value;

    let response = await fetch("https://sheetql-backend.onrender.com/query", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: query })
    });

    let data = await response.json();

    displayResult(data);
}


// 🔥 NEW FUNCTION
async function loadTables() {
    let response = await fetch("https://sheetql-backend.onrender.com/tables");
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


// 🔥 NEW FUNCTION
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