from fastapi import FastAPI, UploadFile, File
import pandas as pd
import sqlite3

app = FastAPI()

conn = sqlite3.connect("data/data.db", check_same_thread=False)


@app.get("/")
def home():
    return {"message": "CSV to SQL API is running"}


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)

    # Clean columns
    df.columns = [col.strip().replace(" ", "_").lower() for col in df.columns]

    # Basic cleaning
    df = df.dropna(how="all")
    df = df.where(pd.notnull(df), None)

    df.to_sql("data", conn, if_exists="replace", index=False)

    return {"message": "CSV uploaded and table created"}


@app.post("/query")
async def run_query(query: str):
    if not query.lower().strip().startswith("select"):
        return {"error": "Only SELECT queries allowed"}

    cursor = conn.execute(query)
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]

    return {
        "columns": columns,
        "rows": rows
    }