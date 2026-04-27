import uuid
import ast
from datetime import datetime
from db.database import get_db
from models import Message


def save_quiz_result(
    notebook_id: str,
    quiz_type: str,
    difficulty: str,
    score: int,
    total: int,
    topic_scores: dict,
    weak_topics: list
) -> str:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    result_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO quiz_results (id, notebook_id, quiz_type, difficulty, score, total, topic_scores, weak_topics, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (result_id, notebook_id, quiz_type, difficulty, score, total, str(topic_scores), str(weak_topics), now)
    )
    conn.commit()
    return result_id


def get_quiz_results(notebook_id: str) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM quiz_results WHERE notebook_id = ? ORDER BY created_at DESC",
        (notebook_id,)
    )
    rows = cursor.fetchall()
    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "notebook_id": row["notebook_id"],
            "quiz_type": row["quiz_type"],
            "difficulty": row["difficulty"],
            "score": row["score"],
            "total": row["total"],
            "topic_scores": ast.literal_eval(row["topic_scores"]) if row["topic_scores"] else {},
            "weak_topics": ast.literal_eval(row["weak_topics"]) if row["weak_topics"] else [],
            "created_at": row["created_at"]
        })
    return results


def get_analytics(notebook_id: str) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM quiz_results WHERE notebook_id = ? ORDER BY created_at DESC LIMIT 20",
        (notebook_id,)
    )
    rows = cursor.fetchall()
    
    if not rows:
        return {"total_quizzes": 0, "average_score": 0, "weak_topics": [], "progress": []}
    
    total_quizzes = len(rows)
    total_score = sum(row["score"] for row in rows)
    total_max = sum(row["total"] for row in rows)
    average_score = (total_score / total_max * 100) if total_max > 0 else 0
    
    all_weak_topics = []
    for row in rows:
        topics = ast.literal_eval(row["weak_topics"]) if row["weak_topics"] else []
        all_weak_topics.extend(topics)
    
    topic_counts = {}
    for topic in all_weak_topics:
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
    
    weak_topics = sorted(topic_counts.keys(), key=lambda x: topic_counts[x], reverse=True)[:5]
    
    progress = []
    for row in rows:
        progress.append({
            "score": row["score"],
            "total": row["total"],
            "percentage": (row["score"] / row["total"] * 100) if row["total"] > 0 else 0,
            "quiz_type": row["quiz_type"],
            "difficulty": row["difficulty"],
            "created_at": row["created_at"]
        })
    
    return {
        "total_quizzes": total_quizzes,
        "average_score": round(average_score, 1),
        "weak_topics": weak_topics,
        "progress": progress
    }