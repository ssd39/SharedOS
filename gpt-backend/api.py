from fastapi import FastAPI
from pydantic import BaseModel
import text_to_sql
from langchain.sql_database import SQLDatabase
import json
import psycopg2
import time
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChartRequest(BaseModel):
    question: str
    opena_ai_key: str
    conn_uri: str

class DataRequest(BaseModel):
    query: str
    conn_uri: str

@app.post("/query")
async def get_data(data_request: DataRequest):
    sqlQuery = data_request.query
    conn_uri = data_request.conn_uri
    try:
        connection = psycopg2.connect(conn_uri)
        cursor = connection.cursor()
        cursor.execute(sqlQuery)
        results = cursor.fetchall()
        return {"success": True, "data": results}
    except Exception as e:
        print(e)
    return { "success": False }

@app.post("/chart")
async def create_chart(chart_request: ChartRequest):
    question = chart_request.question
    conn_uri = chart_request.conn_uri
    opena_ai_key = chart_request.opena_ai_key
    try:
        conn_uri_dileact = conn_uri.replace("postgresql://", "postgresql+psycopg2://")
        db = SQLDatabase.from_uri(conn_uri_dileact)
        sqlQuery = text_to_sql.getSqlQuery(opena_ai_key=opena_ai_key, db=db, question=question).replace("LIMIT 5", "")
        connection = psycopg2.connect(conn_uri)
        cursor = connection.cursor()
        cursor.execute(sqlQuery)
        results = cursor.fetchall()
        spec =  text_to_sql.getVegaLiteSpec(opena_ai_key=opena_ai_key, db=db, query=sqlQuery, question=question, sampleRow=results[0])
        return {"success": True, "spec": spec, "query": sqlQuery}
    except Exception as e:
        print(e)
    return {"success": False}
