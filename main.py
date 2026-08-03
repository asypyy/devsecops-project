import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

app = FastAPI(title="Notes API")

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "postgres"),
    "port": os.environ.get("DB_PORT", "5432"),
    "dbname": os.environ.get("DB_NAME", "notesdb"),
    "user": os.environ.get("DB_USER", "notesuser"),
    "password": os.environ.get("DB_PASSWORD"),
}


@contextmanager
def get_conn():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id UUID PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL
                )
            """)
            conn.commit()


@app.on_event("startup")
def startup():
    init_db()


class NoteIn(BaseModel):
    title: str
    content: str


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class Note(NoteIn):
    id: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/notes")
def list_notes():
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, title, content FROM notes")
            return cur.fetchall()


@app.get("/notes/{note_id}")
def get_note(note_id: str):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, title, content FROM notes WHERE id = %s", (note_id,))
            note = cur.fetchone()
            if not note:
                raise HTTPException(status_code=404, detail="Note not found")
            return note


@app.post("/notes", status_code=201)
def create_note(note: NoteIn):
    note_id = str(uuid4())
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO notes (id, title, content) VALUES (%s, %s, %s)",
                (note_id, note.title, note.content),
            )
            conn.commit()
    return {"id": note_id, "title": note.title, "content": note.content}


@app.put("/notes/{note_id}")
def replace_note(note_id: str, note: NoteIn):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE notes SET title = %s, content = %s WHERE id = %s",
                (note.title, note.content, note_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()
    return {"id": note_id, "title": note.title, "content": note.content}


@app.patch("/notes/{note_id}")
def update_note(note_id: str, update: NoteUpdate):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, title, content FROM notes WHERE id = %s", (note_id,))
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Note not found")

            new_title = update.title if update.title is not None else existing["title"]
            new_content = update.content if update.content is not None else existing["content"]

            cur.execute(
                "UPDATE notes SET title = %s, content = %s WHERE id = %s",
                (new_title, new_content, note_id),
            )
            conn.commit()
            return {"id": note_id, "title": new_title, "content": new_content}


@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM notes WHERE id = %s", (note_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()