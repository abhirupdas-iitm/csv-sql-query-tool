async function uploadCSV() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    let formData = new FormData();
    formData.append("file", file);

    let response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData
    });

    let data = await response.json();
    alert(JSON.stringify(data));
}


async function runQuery() {
    const query = document.getElementById("query").value;

    let response = await fetch("http://127.0.0.1:8000/query", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: query })
    });

    let data = await response.json();

    displayResult(data);
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