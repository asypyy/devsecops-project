import os
import datetime
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import bcrypt
import jwt

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="DevSecOps Notes API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "postgres"),
    "port": os.environ.get("DB_PORT", "5432"),
    "dbname": os.environ.get("DB_NAME", "notesdb"),
    "user": os.environ.get("DB_USER", "notesuser"),
    "password": os.environ.get("DB_PASSWORD"),
}

JWT_SECRET = os.environ.get("JWT_SECRET", "devsecops-super-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"

security = HTTPBearer()


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
            # Users table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Notes table with user_id foreign key
            cur.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id UUID PRIMARY KEY,
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL
                )
            """)
            # Schema migration: add user_id column if notes table already existed without it
            cur.execute("""
                ALTER TABLE notes 
                ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
            """)
            conn.commit()


@app.on_event("startup")
def startup():
    init_db()


# Security Utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        username = payload.get("username")
        if not user_id or not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return {"id": user_id, "username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# Pydantic Schemas
class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class NoteIn(BaseModel):
    title: str
    content: str


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


# Routes
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRegister):
    if len(user.username.strip()) < 3 or len(user.password) < 4:
        raise HTTPException(
            status_code=400,
            detail="Username must be at least 3 characters and password at least 4 characters",
        )

    user_id = str(uuid4())
    hashed_pw = hash_password(user.password)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s", (user.username,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Username already exists")

            cur.execute(
                "INSERT INTO users (id, username, hashed_password) VALUES (%s, %s, %s)",
                (user_id, user.username, hashed_pw),
            )
            conn.commit()

    return {"id": user_id, "username": user.username, "message": "User created successfully"}


@app.post("/login", response_model=TokenResponse)
def login(user: UserLogin):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, username, hashed_password FROM users WHERE username = %s", (user.username,))
            db_user = cur.fetchone()
            if not db_user or not verify_password(user.password, db_user["hashed_password"]):
                raise HTTPException(status_code=401, detail="Invalid username or password")

            token = create_access_token(str(db_user["id"]), db_user["username"])
            return {"access_token": token, "token_type": "bearer", "username": db_user["username"]}


@app.get("/notes")
def list_notes(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, content FROM notes WHERE user_id = %s ORDER BY id DESC",
                (current_user["id"],),
            )
            return cur.fetchall()


@app.get("/notes/{note_id}")
def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, content FROM notes WHERE id = %s AND user_id = %s",
                (note_id, current_user["id"]),
            )
            note = cur.fetchone()
            if not note:
                raise HTTPException(status_code=404, detail="Note not found")
            return note


@app.post("/notes", status_code=201)
def create_note(note: NoteIn, current_user: dict = Depends(get_current_user)):
    note_id = str(uuid4())
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO notes (id, user_id, title, content) VALUES (%s, %s, %s, %s)",
                (note_id, current_user["id"], note.title, note.content),
            )
            conn.commit()
    return {"id": note_id, "title": note.title, "content": note.content}


@app.put("/notes/{note_id}")
def replace_note(note_id: str, note: NoteIn, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE notes SET title = %s, content = %s WHERE id = %s AND user_id = %s",
                (note.title, note.content, note_id, current_user["id"]),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()
    return {"id": note_id, "title": note.title, "content": note.content}


@app.patch("/notes/{note_id}")
def update_note(note_id: str, update: NoteUpdate, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, content FROM notes WHERE id = %s AND user_id = %s",
                (note_id, current_user["id"]),
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Note not found")

            new_title = update.title if update.title is not None else existing["title"]
            new_content = update.content if update.content is not None else existing["content"]

            cur.execute(
                "UPDATE notes SET title = %s, content = %s WHERE id = %s AND user_id = %s",
                (new_title, new_content, note_id, current_user["id"]),
            )
            conn.commit()
            return {"id": note_id, "title": new_title, "content": new_content}


@app.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM notes WHERE id = %s AND user_id = %s", (note_id, current_user["id"]))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Note not found")
            conn.commit()