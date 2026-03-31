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
conn = sqlite3.connect("data/data.db", check_same_thread=False)


@app.get("/")
def home():
    return {"message": "CSV to SQL API is running"}


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)

    # Clean column names
    df.columns = [col.strip().replace(" ", "_").lower() for col in df.columns]

    # Basic cleaning
    df = df.dropna(how="all")
    df = df.where(pd.notnull(df), None)

    # Save to SQL
    df.to_sql("data", conn, if_exists="replace", index=False)

    return {"message": "CSV uploaded and table created"}


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