from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4

app = FastAPI(title="Notes API")

# in-memory store: {id: {"id": ..., "title": ..., "content": ...}}
notes_db: dict[str, dict] = {}


class NoteIn(BaseModel):
    title: str
    content: str


class Note(NoteIn):
    id: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/notes")
def list_notes():
    return list(notes_db.values())


@app.post("/notes", status_code=201)
def create_note(note: NoteIn):
    note_id = str(uuid4())
    record = {"id": note_id, "title": note.title, "content": note.content}
    notes_db[note_id] = record
    return record