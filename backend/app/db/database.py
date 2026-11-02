"""The original repo's LangGraph PostgreSQL checkpoint approach."""
import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from app.core.config import get_settings


def connect_memory():
    url = get_settings().database_url
    if not url:
        raise RuntimeError("Please configure DATABASE_URL in backend/.env")
    connection = psycopg.connect(url, autocommit=True)
    saver = PostgresSaver(connection)
    saver.setup()  # LangGraph creates its own checkpoint tables.
    return connection, saver
