from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4

app = FastAPI(title="Notes API")

notes_db: dict[str, dict] = {}


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
    return list(notes_db.values())


@app.get("/notes/{note_id}")
def get_note(note_id: str):
    note = notes_db.get(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.post("/notes", status_code=201)
def create_note(note: NoteIn):
    note_id = str(uuid4())
    record = {"id": note_id, "title": note.title, "content": note.content}
    notes_db[note_id] = record
    return record


@app.put("/notes/{note_id}")
def replace_note(note_id: str, note: NoteIn):
    if note_id not in notes_db:
        raise HTTPException(status_code=404, detail="Note not found")
    record = {"id": note_id, "title": note.title, "content": note.content}
    notes_db[note_id] = record
    return record


@app.patch("/notes/{note_id}")
def update_note(note_id: str, update: NoteUpdate):
    existing = notes_db.get(note_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")
    if update.title is not None:
        existing["title"] = update.title
    if update.content is not None:
        existing["content"] = update.content
    notes_db[note_id] = existing
    return existing


@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str):
    if note_id not in notes_db:
        raise HTTPException(status_code=404, detail="Note not found")
    del notes_db[note_id]