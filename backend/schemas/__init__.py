from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class NotebookCreate(BaseModel):
    name: str


class NotebookUpdate(BaseModel):
    name: str


class NotebookResponse(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str


class SourceResponse(BaseModel):
    id: str
    notebook_id: str
    name: str
    type: str
    file_path: str
    metadata: Optional[dict] = None
    created_at: str


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: str
    notebook_id: str
    role: str
    content: str
    citations: Optional[list] = None
    created_at: str


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    message: MessageResponse
    sources: Optional[list] = None


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    explanation: Optional[str] = None


class QuizRequest(BaseModel):
    difficulty: str = "medium"
    num_questions: int = 10
    max_marks: int = 100
    quiz_category: str = "theory"


class QuizResponse(BaseModel):
    questions: List[QuizQuestion]
    topic: Optional[str] = None


class QuizResult(BaseModel):
    quiz_id: Optional[str] = None
    notebook_id: str
    score: int
    total: int
    topic_scores: dict = {}


class QuizResultResponse(BaseModel):
    id: str
    notebook_id: str
    quiz_type: str
    difficulty: str
    score: int
    total: int
    topic_scores: dict
    weak_topics: List[str]
    created_at: str


class TheoryQuestion(BaseModel):
    model_config = {"protected_namespaces": ("pydantic_",)}
    
    question: str
    solution: str
    diagram: Optional[str] = None
    marks: int = 5
    question_number: int = 1


class TheoryTestRequest(BaseModel):
    num_questions: int = 10
    duration_minutes: int = 60


class TheoryTestResponse(BaseModel):
    questions: List[TheoryQuestion]
    total_marks: int
    duration_minutes: int
    subject: Optional[str] = None