import requests
from config import settings
from typing import Optional
from utils.errors import log_studio_error, LLMError


def generate_response(prompt: str, model: Optional[str] = None) -> str:
    url = f"{settings.ollama_host}/api/generate"
    payload = {
        "model": model or settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 8192,  # Increased for complex generation tasks
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=240)
        response.raise_for_status()
    except requests.exceptions.Timeout as e:
        raise LLMError(
            "LLM request timed out after 240 seconds",
            "LLM_TIMEOUT",
            {"timeout": 240, "model": model or settings.ollama_model}
        )
    except requests.exceptions.ConnectionError as e:
        raise LLMError(
            "Cannot connect to Ollama. Is Ollama running?",
            "LLM_NOT_RUNNING",
            {"ollama_host": settings.ollama_host}
        )
    except Exception as e:
        response_text = ""
        try:
            if 'response' in locals():
                response_text = response.text
        except:
            pass
        raise LLMError(
            f"LLM request failed: {str(e)}",
            "LLM_REQUEST_FAILED",
            {"error": str(e), "response": response_text[:500] if response_text else None}
        )
    
    result = response.json()
    response_text = result.get("response", "")
    
    if not response_text:
        raise LLMError(
            "LLM returned empty response",
            "LLM_EMPTY_RESPONSE",
            {"model": model or settings.ollama_model, "prompt_length": len(prompt)}
        )
    
    return response_text


def chat(prompt: str, context: str, model: Optional[str] = None) -> str:
    full_prompt = f"""You are a helpful research assistant. Use the following context to answer the question accurately. Cite your sources when possible.

Context:
{context}

Question: {prompt}

Answer:"""
    return generate_response(full_prompt, model)


def get_available_models() -> list[dict]:
    url = f"{settings.ollama_host}/api/tags"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        models = response.json().get("models", [])
        return [
            {"name": m.get("name", ""), "size": m.get("size", 0)}
            for m in models
            if m.get("name")
        ]
    except:
        return [
            {"name": "llama3.1:8b", "size": 4900000000},
            {"name": "wizard-math:7b", "size": 4100000000},
            {"name": "llava:latest", "size": 4700000000},
        ]


def get_models_for_task(task: str) -> str:
    task_models = {
        "chat": settings.model_for_chat,
        "quiz": settings.model_for_quiz,
        "study_guide": settings.model_for_study_guide,
        "flashcards": settings.model_for_flashcards,
        "theory_test": settings.model_for_theory_test,
    }
    return task_models.get(task, settings.ollama_model)