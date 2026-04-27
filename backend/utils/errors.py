import logging
import traceback
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("notebookllm")


class StudioError(Exception):
    """Base exception for studio features with structured error info"""
    def __init__(self, message: str, error_code: str, details: dict = None, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.status_code = status_code

    def to_dict(self) -> dict:
        return {
            "success": False,
            "error": self.error_code,
            "message": self.message,
            "details": self.details
        }


class SourceError(StudioError):
    """Error related to source parsing"""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "SOURCE_ERROR", details, status_code=400)


class LLMError(StudioError):
    """Error related to LLM generation"""
    def __init__(self, message: str, error_code: str = "LLM_ERROR", details: dict = None):
        super().__init__(message, error_code, details, status_code=503)


class JSONParseError(StudioError):
    """Error parsing LLM response"""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "JSON_PARSE_ERROR", details, status_code=500)


class ValidationError(StudioError):
    """Validation error for request data"""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "VALIDATION_ERROR", details, status_code=400)


def log_studio_error(location: str, error: Exception, context: dict = None):
    """Log studio errors with full context for debugging"""
    error_info = {
        "location": location,
        "error_type": type(error).__name__,
        "error_message": str(error),
        "traceback": traceback.format_exc(),
    }
    if context:
        error_info.update(context)
    
    logger.error(f"Studio error at {location}: {error}", extra=error_info)
    return error_info


def format_error_response(error: Exception, include_debug: bool = False) -> dict:
    """Format error into API response"""
    if isinstance(error, StudioError):
        response = error.to_dict()
        if include_debug and hasattr(error, 'details'):
            response["debug"] = error.details
        return response
    
    # Unknown error
    return {
        "success": False,
        "error": "INTERNAL_ERROR",
        "message": "An unexpected error occurred",
        "details": {"original_error": str(error)} if include_debug else {}
    }


def safe_execute(func, *args, error_location: str = None, default_return=None, context: dict = None, **kwargs):
    """Execute function with error handling - returns default on failure"""
    try:
        return func(*args, **kwargs)
    except Exception as e:
        if error_location:
            log_studio_error(error_location, e, context)
        return default_return