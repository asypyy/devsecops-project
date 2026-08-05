import os

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "postgres"),
    "port": os.environ.get("DB_PORT", "5432"),
    "dbname": os.environ.get("DB_NAME", "notesdb"),
    "user": os.environ.get("DB_USER", "notesuser"),
    "password": os.environ.get("DB_PASSWORD"),
}

JWT_SECRET = os.environ.get("JWT_SECRET", "devsecops-super-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"
