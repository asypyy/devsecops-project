from uuid import uuid4
import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from psycopg2.extras import RealDictCursor
from app.database import get_conn
from app.models import NoteIn, NoteUpdate
from app.auth import get_current_user

router = APIRouter(prefix="/notes", tags=["Notes"])


def purge_expired_notes(conn, user_id: str):
    """Purge notes that have exceeded their auto_delete_at timestamp."""
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM notes 
            WHERE user_id = %s AND auto_delete_at IS NOT NULL AND auto_delete_at <= NOW()
            """,
            (user_id,),
        )
        conn.commit()


@router.get("")
def list_notes(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        purge_expired_notes(conn, current_user["id"])
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, content, 
                       COALESCE(tags, '') as tags, 
                       COALESCE(is_pinned, false) as is_pinned,
                       created_at,
                       auto_delete_at,
                       remind_at
                FROM notes 
                WHERE user_id = %s 
                ORDER BY is_pinned DESC, created_at DESC, id DESC
                """,
                (current_user["id"],),
            )
            notes = cur.fetchall()
            for n in notes:
                if isinstance(n.get("created_at"), (datetime.datetime, datetime.date)):
                    n["created_at"] = n["created_at"].isoformat()
                if isinstance(n.get("auto_delete_at"), (datetime.datetime, datetime.date)):
                    n["auto_delete_at"] = n["auto_delete_at"].isoformat()
                if isinstance(n.get("remind_at"), (datetime.datetime, datetime.date)):
                    n["remind_at"] = n["remind_at"].isoformat()
            return notes


@router.get("/{note_id}")
def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        purge_expired_notes(conn, current_user["id"])
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, content, 
                       COALESCE(tags, '') as tags, 
                       COALESCE(is_pinned, false) as is_pinned,
                       created_at,
                       auto_delete_at,
                       remind_at
                FROM notes 
                WHERE id = %s AND user_id = %s
                """,
                (note_id, current_user["id"]),
            )
            note = cur.fetchone()
            if not note:
                raise HTTPException(status_code=404, detail="Note not found")
            if isinstance(note.get("created_at"), (datetime.datetime, datetime.date)):
                note["created_at"] = note["created_at"].isoformat()
            if isinstance(note.get("auto_delete_at"), (datetime.datetime, datetime.date)):
                note["auto_delete_at"] = note["auto_delete_at"].isoformat()
            if isinstance(note.get("remind_at"), (datetime.datetime, datetime.date)):
                note["remind_at"] = note["remind_at"].isoformat()
            return note


@router.post("", status_code=status.HTTP_201_CREATED)
def create_note(note: NoteIn, current_user: dict = Depends(get_current_user)):
    note_id = str(uuid4())
    tags = note.tags.strip() if note.tags else ""
    is_pinned = bool(note.is_pinned)

    # Validate created_at
    created_at = datetime.datetime.now(datetime.timezone.utc)
    if note.created_at:
        try:
            parsed_dt = datetime.datetime.fromisoformat(note.created_at)
            if parsed_dt.tzinfo is None:
                parsed_dt = parsed_dt.replace(tzinfo=datetime.timezone.utc)
            if parsed_dt > created_at:
                raise HTTPException(status_code=400, detail="Note creation date cannot be in the future")
            created_at = parsed_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid creation date format")

    # Validate auto_delete_at
    auto_delete_at = None
    if note.auto_delete_at:
        try:
            parsed_auto = datetime.datetime.fromisoformat(note.auto_delete_at)
            if parsed_auto.tzinfo is None:
                parsed_auto = parsed_auto.replace(tzinfo=datetime.timezone.utc)

            if parsed_auto <= created_at:
                raise HTTPException(status_code=400, detail="Auto-delete time must be after the creation date/time")
            if parsed_auto > (created_at + datetime.timedelta(days=3)):
                raise HTTPException(status_code=400, detail="Auto-delete time cannot exceed 3 days from creation date")

            auto_delete_at = parsed_auto
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid auto-delete date format")

    # Parse remind_at if provided
    remind_at = None
    if note.remind_at:
        try:
            parsed_remind = datetime.datetime.fromisoformat(note.remind_at)
            if parsed_remind.tzinfo is None:
                parsed_remind = parsed_remind.replace(tzinfo=datetime.timezone.utc)
            remind_at = parsed_remind
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid reminder date format")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO notes (id, user_id, title, content, tags, is_pinned, created_at, auto_delete_at, remind_at) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (note_id, current_user["id"], note.title, note.content, tags, is_pinned, created_at, auto_delete_at, remind_at),
            )
            conn.commit()
    return {
        "id": note_id,
        "title": note.title,
        "content": note.content,
        "tags": tags,
        "is_pinned": is_pinned,
        "created_at": created_at.isoformat(),
        "auto_delete_at": auto_delete_at.isoformat() if auto_delete_at else None,
        "remind_at": remind_at.isoformat() if remind_at else None,
    }


@router.put("/{note_id}")
def replace_note(note_id: str, note: NoteIn, current_user: dict = Depends(get_current_user)):
    tags = note.tags.strip() if note.tags else ""
    is_pinned = bool(note.is_pinned)

    auto_delete_at = None
    if note.auto_delete_at:
        try:
            parsed_auto = datetime.datetime.fromisoformat(note.auto_delete_at)
            if parsed_auto.tzinfo is None:
                parsed_auto = parsed_auto.replace(tzinfo=datetime.timezone.utc)
            auto_delete_at = parsed_auto
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid auto-delete date format")

    remind_at = None
    if note.remind_at:
        try:
            parsed_remind = datetime.datetime.fromisoformat(note.remind_at)
            if parsed_remind.tzinfo is None:
                parsed_remind = parsed_remind.replace(tzinfo=datetime.timezone.utc)
            remind_at = parsed_remind
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid reminder date format")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE notes 
                SET title = %s, content = %s, tags = %s, is_pinned = %s, auto_delete_at = %s, remind_at = %s 
                WHERE id = %s AND user_id = %s
                """,
                (note.title, note.content, tags, is_pinned, auto_delete_at, remind_at, note_id, current_user["id"]),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()
    return {
        "id": note_id,
        "title": note.title,
        "content": note.content,
        "tags": tags,
        "is_pinned": is_pinned,
        "auto_delete_at": auto_delete_at.isoformat() if auto_delete_at else None,
        "remind_at": remind_at.isoformat() if remind_at else None,
    }


@router.patch("/{note_id}")
def update_note(note_id: str, update: NoteUpdate, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, content, tags, is_pinned, auto_delete_at, remind_at FROM notes WHERE id = %s AND user_id = %s",
                (note_id, current_user["id"]),
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Note not found")

            new_title = update.title if update.title is not None else existing["title"]
            new_content = update.content if update.content is not None else existing["content"]
            new_tags = update.tags.strip() if update.tags is not None else (existing["tags"] or "")
            new_pinned = update.is_pinned if update.is_pinned is not None else bool(existing["is_pinned"])
            
            new_auto_delete = existing["auto_delete_at"]
            if update.auto_delete_at is not None:
                if update.auto_delete_at:
                    new_auto_delete = datetime.datetime.fromisoformat(update.auto_delete_at)
                    if new_auto_delete.tzinfo is None:
                        new_auto_delete = new_auto_delete.replace(tzinfo=datetime.timezone.utc)
                else:
                    new_auto_delete = None

            new_remind = existing["remind_at"]
            if update.remind_at is not None:
                if update.remind_at:
                    new_remind = datetime.datetime.fromisoformat(update.remind_at)
                    if new_remind.tzinfo is None:
                        new_remind = new_remind.replace(tzinfo=datetime.timezone.utc)
                else:
                    new_remind = None

            cur.execute(
                """
                UPDATE notes 
                SET title = %s, content = %s, tags = %s, is_pinned = %s, auto_delete_at = %s, remind_at = %s 
                WHERE id = %s AND user_id = %s
                """,
                (new_title, new_content, new_tags, new_pinned, new_auto_delete, new_remind, note_id, current_user["id"]),
            )
            conn.commit()
            return {
                "id": note_id,
                "title": new_title,
                "content": new_content,
                "tags": new_tags,
                "is_pinned": new_pinned,
                "auto_delete_at": new_auto_delete.isoformat() if new_auto_delete else None,
                "remind_at": new_remind.isoformat() if new_remind else None,
            }


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM notes WHERE id = %s AND user_id = %s", (note_id, current_user["id"]))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()
