from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import json


@dataclass
class Notebook:
    id: str
    name: str
    created_at: datetime
    updated_at: datetime

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


@dataclass
class Source:
    id: str
    notebook_id: str
    name: str
    type: str
    file_path: str
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None

    def to_dict(self):
        return {
            "id": self.id,
            "notebook_id": self.notebook_id,
            "name": self.name,
            "type": self.type,
            "file_path": self.file_path,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


@dataclass
class Message:
    id: str
    notebook_id: str
    role: str
    content: str
    citations: Optional[list] = None
    created_at: Optional[datetime] = None

    def to_dict(self):
        return {
            "id": self.id,
            "notebook_id": self.notebook_id,
            "role": self.role,
            "content": self.content,
            "citations": self.citations,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }