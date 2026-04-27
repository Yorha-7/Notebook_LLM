from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    embedding_model: str = "all-MiniLM-L6-v2"
    data_dir: Path = Path("./data")
    chroma_dir: Path = Path("./data/chroma")
    host: str = "0.0.0.0"
    port: int = 8000
    max_file_size_mb: int = 50
    
    model_for_chat: str = "llama3.1:8b"
    model_for_quiz: str = "wizard-math:7b"
    model_for_study_guide: str = "llama3.1:8b"
    model_for_flashcards: str = "wizard-math:7b"
    model_for_theory_test: str = "wizard-math:7b"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        protected_namespaces = ('settings_',)


settings = Settings()