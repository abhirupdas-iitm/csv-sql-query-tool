from fastapi import FastAPI, UploadFile, File, Body, Form
import pandas as pd
import sqlite3
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure data folder exists
os.makedirs("data", exist_ok=True)


@app.get("/")
def home():
    return {"message": "CSV to SQL API is running"}


# 🔥 UPLOAD (USER-SPECIFIC DB)
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    filename = file.filename

    try:
        db_path = f"data/{user_id}.db"
        conn = sqlite3.connect(db_path, check_same_thread=False)

        cursor = conn.cursor()

        # 🔥 CLEAR OLD TABLES FOR THIS USER ONLY
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        for table in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table[0]}")

        conn.commit()

        # 🔵 CSV
        if filename.endswith(".csv"):
            df = pd.read_csv(file.file)

            df.columns = [col.strip().replace(" ", "_").lower() for col in df.columns]
            df = df.dropna(how="all")
            df = df.where(pd.notnull(df), None)

            table_name = "default__data"
            df.to_sql(table_name, conn, if_exists="replace", index=False)

            return {
                "message": "CSV uploaded",
                "tables": [table_name]
            }

        # 🔵 EXCEL
        elif filename.endswith(".xlsx"):
            excel_file = pd.ExcelFile(file.file)

            created_tables = []

            for sheet_name in excel_file.sheet_names:
                df = excel_file.parse(sheet_name)

                df.columns = [col.strip().replace(" ", "_").lower() for col in df.columns]
                df = df.dropna(how="all")
                df = df.where(pd.notnull(df), None)

                clean_sheet = sheet_name.strip().replace(" ", "_").lower()
                table_name = f"{clean_sheet}__data"

                df.to_sql(table_name, conn, if_exists="replace", index=False)
                created_tables.append(table_name)

            return {
                "message": "Excel uploaded",
                "tables": created_tables
            }

        else:
            return {"error": "Unsupported file type"}

    except Exception as e:
        return {"error": str(e)}


# 🔥 GET TABLES (USER-SPECIFIC)
@app.post("/tables")
async def get_tables(data: dict = Body(...)):
    user_id = data.get("user_id")

    conn = sqlite3.connect(f"data/{user_id}.db")
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]

    return {"tables": tables}


# 🔥 QUERY (USER-SPECIFIC)
@app.post("/query")
async def run_query(data: dict = Body(...)):
    user_id = data.get("user_id")
    query = data.get("query")

    if not query:
        return {"error": "No query provided"}

    if not query.lower().strip().startswith("select"):
        return {"error": "Only SELECT queries allowed"}

    try:
        conn = sqlite3.connect(f"data/{user_id}.db")
        cursor = conn.execute(query)

        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]

        return {
            "columns": columns,
            "rows": rows
        }

    except Exception as e:
        return {"error": str(e)}