import psycopg2
from contextlib import contextmanager
from app.config import DB_CONFIG


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
            # Schema migrations for user_id, is_pinned, and tags columns
            cur.execute("""
                ALTER TABLE notes 
                ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
            """)
            cur.execute("""
                ALTER TABLE notes 
                ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
            """)
            cur.execute("""
                ALTER TABLE notes 
                ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';
            """)
            conn.commit()
