from fastapi import FastAPI, UploadFile, File, Body
import pandas as pd
import sqlite3
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to SQLite DB
import os

os.makedirs("data", exist_ok=True)
conn = sqlite3.connect("data/data.db", check_same_thread=False)


@app.get("/")
def home():
    return {"message": "CSV to SQL API is running"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename

    try:
        # 🔥 STEP 1: CLEAR OLD TABLES (ADD THIS EXACTLY HERE)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        for table in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table[0]}")

        conn.commit()

        # 🔥 STEP 2: NOW PROCESS NEW FILE

        # Case 1: CSV (single table)
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

@app.get("/tables")
def get_tables():
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    return {"tables": tables}

@app.post("/query")
async def run_query(data: dict = Body(...)):
    query = data.get("query")

    if not query:
        return {"error": "No query provided"}

    if not query.lower().strip().startswith("select"):
        return {"error": "Only SELECT queries allowed"}

    try:
        cursor = conn.execute(query)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]

        return {
            "columns": columns,
            "rows": rows
        }

    except Exception as e:
        return {"error": str(e)}