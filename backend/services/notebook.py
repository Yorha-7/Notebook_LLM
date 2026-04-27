import uuid
from datetime import datetime
from db.database import get_db, row_to_dict
from models import Notebook


def create_notebook(name: str) -> Notebook:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    notebook_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO notebooks (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (notebook_id, name, now, now)
    )
    conn.commit()
    return Notebook(
        id=notebook_id,
        name=name,
        created_at=datetime.fromisoformat(now),
        updated_at=datetime.fromisoformat(now)
    )


def get_notebooks() -> list[Notebook]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notebooks ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    return [
        Notebook(
            id=row["id"],
            name=row["name"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"])
        )
        for row in rows
    ]


def get_notebook(notebook_id: str) -> Notebook | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notebooks WHERE id = ?", (notebook_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return Notebook(
        id=row["id"],
        name=row["name"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"])
    )


def update_notebook(notebook_id: str, name: str) -> Notebook | None:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE notebooks SET name = ?, updated_at = ? WHERE id = ?",
        (name, now, notebook_id)
    )
    if cursor.rowcount == 0:
        return None
    conn.commit()
    return get_notebook(notebook_id)


def delete_notebook(notebook_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notebooks WHERE id = ?", (notebook_id,))
    if cursor.rowcount == 0:
        return False
    conn.commit()
    return True