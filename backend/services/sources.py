import uuid
import ast
from datetime import datetime
from db.database import get_db, row_to_dict
from models import Source


def create_source(notebook_id: str, name: str, file_type: str, file_path: str, metadata: dict = None) -> Source:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    source_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO sources (id, notebook_id, name, type, file_path, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (source_id, notebook_id, name, file_type, file_path, str(metadata) if metadata else None, now)
    )
    conn.commit()
    return Source(
        id=source_id,
        notebook_id=notebook_id,
        name=name,
        type=file_type,
        file_path=file_path,
        metadata=metadata,
        created_at=datetime.fromisoformat(now)
    )


def get_sources(notebook_id: str) -> list[Source]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sources WHERE notebook_id = ? ORDER BY created_at DESC", (notebook_id,))
    rows = cursor.fetchall()
    return [
        Source(
            id=row["id"],
            notebook_id=row["notebook_id"],
            name=row["name"],
            type=row["type"],
            file_path=row["file_path"],
            metadata=ast.literal_eval(row["metadata"]) if row["metadata"] else None,
            created_at=datetime.fromisoformat(row["created_at"])
        )
        for row in rows
    ]


def get_source(source_id: str) -> Source | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sources WHERE id = ?", (source_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return Source(
        id=row["id"],
        notebook_id=row["notebook_id"],
        name=row["name"],
        type=row["type"],
        file_path=row["file_path"],
        metadata=ast.literal_eval(row["metadata"]) if row["metadata"] else None,
        created_at=datetime.fromisoformat(row["created_at"])
    )


def delete_source(source_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    if cursor.rowcount == 0:
        return False
    conn.commit()
    return True