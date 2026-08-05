from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends, status
from psycopg2.extras import RealDictCursor
from app.database import get_conn
from app.models import NoteIn, NoteUpdate
from app.auth import get_current_user

router = APIRouter(prefix="/notes", tags=["Notes"])


@router.get("")
def list_notes(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, content, COALESCE(tags, '') as tags, COALESCE(is_pinned, false) as is_pinned 
                FROM notes 
                WHERE user_id = %s 
                ORDER BY is_pinned DESC, id DESC
                """,
                (current_user["id"],),
            )
            return cur.fetchall()


@router.get("/{note_id}")
def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, content, COALESCE(tags, '') as tags, COALESCE(is_pinned, false) as is_pinned 
                FROM notes 
                WHERE id = %s AND user_id = %s
                """,
                (note_id, current_user["id"]),
            )
            note = cur.fetchone()
            if not note:
                raise HTTPException(status_code=404, detail="Note not found")
            return note


@router.post("", status_code=status.HTTP_201_CREATED)
def create_note(note: NoteIn, current_user: dict = Depends(get_current_user)):
    note_id = str(uuid4())
    tags = note.tags.strip() if note.tags else ""
    is_pinned = bool(note.is_pinned)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO notes (id, user_id, title, content, tags, is_pinned) 
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (note_id, current_user["id"], note.title, note.content, tags, is_pinned),
            )
            conn.commit()
    return {"id": note_id, "title": note.title, "content": note.content, "tags": tags, "is_pinned": is_pinned}


@router.put("/{note_id}")
def replace_note(note_id: str, note: NoteIn, current_user: dict = Depends(get_current_user)):
    tags = note.tags.strip() if note.tags else ""
    is_pinned = bool(note.is_pinned)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE notes 
                SET title = %s, content = %s, tags = %s, is_pinned = %s 
                WHERE id = %s AND user_id = %s
                """,
                (note.title, note.content, tags, is_pinned, note_id, current_user["id"]),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()
    return {"id": note_id, "title": note.title, "content": note.content, "tags": tags, "is_pinned": is_pinned}


@router.patch("/{note_id}")
def update_note(note_id: str, update: NoteUpdate, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, content, tags, is_pinned FROM notes WHERE id = %s AND user_id = %s",
                (note_id, current_user["id"]),
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Note not found")

            new_title = update.title if update.title is not None else existing["title"]
            new_content = update.content if update.content is not None else existing["content"]
            new_tags = update.tags.strip() if update.tags is not None else (existing["tags"] or "")
            new_pinned = update.is_pinned if update.is_pinned is not None else bool(existing["is_pinned"])

            cur.execute(
                """
                UPDATE notes 
                SET title = %s, content = %s, tags = %s, is_pinned = %s 
                WHERE id = %s AND user_id = %s
                """,
                (new_title, new_content, new_tags, new_pinned, note_id, current_user["id"]),
            )
            conn.commit()
            return {"id": note_id, "title": new_title, "content": new_content, "tags": new_tags, "is_pinned": new_pinned}


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM notes WHERE id = %s AND user_id = %s", (note_id, current_user["id"]))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()
