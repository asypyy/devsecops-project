from uuid import uuid4
from fastapi import APIRouter, HTTPException, status
from psycopg2.extras import RealDictCursor
from app.database import get_conn
from app.models import UserRegister, UserLogin, TokenResponse
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter(tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
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


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, username, hashed_password FROM users WHERE username = %s", (user.username,))
            db_user = cur.fetchone()
            if not db_user or not verify_password(user.password, db_user["hashed_password"]):
                raise HTTPException(status_code=401, detail="Invalid username or password")

            token = create_access_token(str(db_user["id"]), db_user["username"])
            return {"access_token": token, "token_type": "bearer", "username": db_user["username"]}
