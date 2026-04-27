import uuid
import ast
from datetime import datetime
from db.database import get_db
from models import Message


def create_message(notebook_id: str, role: str, content: str, citations: list = None) -> Message:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    message_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO messages (id, notebook_id, role, content, citations, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (message_id, notebook_id, role, content, str(citations) if citations else None, now)
    )
    conn.commit()
    return Message(
        id=message_id,
        notebook_id=notebook_id,
        role=role,
        content=content,
        citations=citations,
        created_at=datetime.fromisoformat(now)
    )


def get_messages(notebook_id: str) -> list[Message]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM messages WHERE notebook_id = ? ORDER BY created_at ASC", (notebook_id,))
    rows = cursor.fetchall()
    return [
        Message(
            id=row["id"],
            notebook_id=row["notebook_id"],
            role=row["role"],
            content=row["content"],
            citations=ast.literal_eval(row["citations"]) if row["citations"] else None,
            created_at=datetime.fromisoformat(row["created_at"])
        )
        for row in rows
    ]


def clear_history(notebook_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE notebook_id = ?", (notebook_id,))
    conn.commit()
    return True