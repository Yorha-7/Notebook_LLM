from fastapi import FastAPI, UploadFile, File, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import shutil
import uuid
import json
import re
import logging
from pathlib import Path

from config import settings
from schemas import (
    NotebookCreate, NotebookUpdate, NotebookResponse,
    ChatRequest, ChatResponse, MessageResponse,
    QuizRequest, QuizResponse, QuizResult,
    TheoryTestRequest
)
from services import notebook as notebook_service
from services import sources as sources_service
from services import chat as chat_service
from services import quiz as quiz_service
from services import llm
from services import research
from services import embeddings
import parsers.pdf as pdf_parser
import parsers.docx as docx_parser
import parsers.txt as txt_parser
from db.vector import get_collection, delete_collection
from utils.errors import (
    log_studio_error, format_error_response,
    StudioError, LLMError, JSONParseError
)

logger = logging.getLogger("notebookllm")

app = FastAPI(title="NotebookLLM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "NotebookLLM API"}


@app.get("/api/notebooks", response_model=List[NotebookResponse])
async def list_notebooks():
    notebooks = notebook_service.get_notebooks()
    return [n.to_dict() for n in notebooks]


@app.post("/api/notebooks", response_model=NotebookResponse)
async def create_notebook(data: NotebookCreate):
    notebook = notebook_service.create_notebook(data.name)
    return notebook.to_dict()


@app.get("/api/notebooks/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(notebook_id: str):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook.to_dict()


@app.put("/api/notebooks/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(notebook_id: str, data: NotebookUpdate):
    notebook = notebook_service.update_notebook(notebook_id, data.name)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook.to_dict()


@app.delete("/api/notebooks/{notebook_id}")
async def delete_notebook(notebook_id: str):
    success = notebook_service.delete_notebook(notebook_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notebook not found")
    delete_collection(notebook_id)
    return {"message": "Deleted successfully"}


@app.get("/api/notebooks/{notebook_id}/sources")
async def list_sources(notebook_id: str):
    sources = sources_service.get_sources(notebook_id)
    return [s.to_dict() for s in sources]


@app.post("/api/notebooks/{notebook_id}/sources")
async def upload_source(
    notebook_id: str,
    file: UploadFile = File(...),
    ocr: bool = Query(False, description="Run OCR for scanned PDFs"),
    background_tasks: BackgroundTasks = None
):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    content = await file.read()
    file_size = len(content)
    max_size = settings.max_file_size_mb * 1024 * 1024 if hasattr(settings, 'max_file_size_mb') else 100 * 1024 * 1024
    
    if file_size > max_size:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {max_size // (1024*1024)}MB")
    
    sources_dir = settings.data_dir / "sources" / notebook_id
    sources_dir.mkdir(parents=True, exist_ok=True)
    
    file_ext = file.filename.split(".")[-1].lower()
    file_name = f"{uuid.uuid4()}.{file_ext}"
    file_path = sources_dir / file_name
    
    with file_path.open("wb") as buffer:
        buffer.write(content)
    
    file_type = file_ext
    
    try:
        if file_type == "pdf":
            is_scanned = pdf_parser.is_scanned_pdf(str(file_path))
            if ocr or is_scanned:
                text = pdf_parser.parse_pdf_ocr_fallback(str(file_path))
                metadata = pdf_parser.get_pdf_metadata(str(file_path))
                metadata["ocr"] = True
            else:
                text = pdf_parser.parse_pdf(str(file_path))
                metadata = pdf_parser.get_pdf_metadata(str(file_path))
        elif file_type == "docx":
            text = docx_parser.parse_docx(str(file_path))
            metadata = {}
        elif file_type in ["txt", "text"]:
            text = txt_parser.parse_txt(str(file_path))
            metadata = {}
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    
    source = sources_service.create_source(
        notebook_id=notebook_id,
        name=file.filename,
        file_type=file_type,
        file_path=str(file_path),
        metadata=metadata
    )
    
    background_tasks.add_task(
        embeddings.add_source_embeddings,
        notebook_id=notebook_id,
        source_id=source.id,
        source_name=source.name,
        text=text
    )
    
    return source.to_dict()


@app.delete("/api/notebooks/{notebook_id}/sources/{source_id}")
async def delete_source(notebook_id: str, source_id: str):
    source = sources_service.get_source(source_id)
    if not source or source.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Source not found")
    
    embeddings.delete_source_embeddings(notebook_id, source_id)
    success = sources_service.delete_source(source_id)
    
    file_path = Path(source.file_path)
    if file_path.exists():
        file_path.unlink()
    
    if not success:
        raise HTTPException(status_code=404, detail="Source not found")
    return {"message": "Deleted successfully"}


@app.post("/api/notebooks/{notebook_id}/chat", response_model=ChatResponse)
async def send_chat_message(notebook_id: str, request: ChatRequest):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    user_message = chat_service.create_message(
        notebook_id=notebook_id,
        role="user",
        content=request.message
    )
    
    relevant_docs = embeddings.search_similar(
        notebook_id=notebook_id,
        query=request.message,
        top_k=5
    )
    
    context = "\n\n".join([
        f"[Source: {doc['metadata']['source_name']}]\n{doc['content']}"
        for doc in relevant_docs if doc.get('content') and doc.get('metadata')
    ])
    
    if not context:
        response_text = "No relevant source documents found. Please upload documents to enable RAG-based answers."
    else:
        response_text = llm.chat(request.message, context, llm.get_models_for_task("chat"))
    
    assistant_message = chat_service.create_message(
        notebook_id=notebook_id,
        role="assistant",
        content=response_text,
        citations=[doc.get('metadata') for doc in relevant_docs]
    )
    
    return ChatResponse(
        message=MessageResponse(**assistant_message.to_dict()),
        sources=relevant_docs
    )


@app.get("/api/notebooks/{notebook_id}/history")
async def get_chat_history(notebook_id: str):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    messages = chat_service.get_messages(notebook_id)
    return [m.to_dict() for m in messages]


@app.post("/api/notebooks/{notebook_id}/studio/flashcards")
async def generate_flashcards(notebook_id: str):
    """Generate flashcards with comprehensive error handling"""
    logger.info(f"Generating flashcards for notebook: {notebook_id}")
    
    # Step 1: Validate notebook
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        return {"success": False, "error": "NOTEBOOK_NOT_FOUND", "message": "Notebook not found", "flashcards": []}
    
    # Step 2: Get sources
    sources = sources_service.get_sources(notebook_id)
    if not sources:
        return {"success": False, "error": "NO_SOURCES", "message": "No sources available. Please add sources first.", "flashcards": []}
    
    # Step 3: Parse source content
    combined_text = ""
    parse_errors = []
    for source in sources:
        try:
            if source.type == "pdf":
                text = pdf_parser.parse_pdf(source.file_path)
            elif source.type == "docx":
                text = docx_parser.parse_docx(source.file_path)
            elif source.type in ["txt", "text"]:
                text = txt_parser.parse_txt(source.file_path)
            else:
                continue
            
            if text and text.strip():
                combined_text += text + "\n"
        except Exception as e:
            logger.warning(f"Parse error for {source.name}: {e}")
            parse_errors.append(source.name)
    
    if not combined_text.strip():
        return {"success": False, "error": "PARSE_FAILED", "message": "Could not extract text from sources.", "details": {"errors": parse_errors}, "flashcards": []}
    
    # Step 4: Generate with LLM
    prompt = f"""Create 10 flashcards from the content below. Each flashcard should have:
- "question": A clear, specific question
- "answer": A concise answer

Return ONLY a valid JSON array:
[{{"question": "?", "answer": "?"}}, ...]

Content:
{combined_text[:8000]}

Generate exactly 10 flashcards. Return ONLY the JSON array."""

    llm_response = None
    try:
        llm_response = llm.generate_response(prompt, llm.get_models_for_task("flashcards"))
    except LLMError as e:
        log_studio_error("flashcards.llm", e, {"notebook_id": notebook_id})
        return {"success": False, "error": e.error_code, "message": e.message, "flashcards": []}
    except Exception as e:
        log_studio_error("flashcards.llm", e, {"notebook_id": notebook_id})
        return {"success": False, "error": "LLM_FAILED", "message": str(e), "flashcards": []}
    
    # Step 5: Parse JSON
    flashcards = []
    try:
        cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', llm_response)
        cleaned = re.sub(r'```json\s*', '', cleaned)
        cleaned = re.sub(r'```\s*', '', cleaned)
        
        try:
            flashcards = json.loads(cleaned)
        except json.JSONDecodeError:
            json_match = re.search(r'\[[\s\S]*\]', cleaned)
            if json_match:
                flashcards = json.loads(json_match.group())
        
        if not isinstance(flashcards, list):
            flashcards = []
        flashcards = [f for f in flashcards if isinstance(f, dict) and f.get('question') and f.get('answer')]
        flashcards = flashcards[:10]
    except Exception as e:
        logger.error(f"Flashcard parse error: {e}")
        return {"success": False, "error": "JSON_PARSE_FAILED", "message": "Failed to parse flashcards", "debug": {"raw": llm_response[:500]}, "flashcards": []}
    
    if not flashcards:
        return {"success": False, "error": "NO_VALID_CARDS", "message": "Could not generate valid flashcards from content.", "flashcards": []}
    
    logger.info(f"Generated {len(flashcards)} flashcards")
    return {"success": True, "flashcards": flashcards}


@app.post("/api/notebooks/{notebook_id}/studio/study-guide")
async def generate_study_guide(notebook_id: str):
    """Generate study guide with comprehensive error handling"""
    logger.info(f"Generating study guide for notebook: {notebook_id}")
    
    # Validate
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        return {"success": False, "error": "NOTEBOOK_NOT_FOUND", "message": "Notebook not found", "study_guide": ""}
    
    sources = sources_service.get_sources(notebook_id)
    if not sources:
        return {"success": False, "error": "NO_SOURCES", "message": "No sources available.", "study_guide": ""}
    
    # Parse content
    combined_text = ""
    for source in sources:
        try:
            if source.type == "pdf":
                text = pdf_parser.parse_pdf(source.file_path)
            elif source.type == "docx":
                text = docx_parser.parse_docx(source.file_path)
            elif source.type in ["txt", "text"]:
                text = txt_parser.parse_txt(source.file_path)
            else:
                continue
            if text and text.strip():
                combined_text += text + "\n"
        except Exception as e:
            logger.warning(f"Parse error for {source.name}: {e}")
    
    if not combined_text.strip():
        return {"success": False, "error": "PARSE_FAILED", "message": "Could not extract text from sources.", "study_guide": ""}
    
    # Generate
    prompt = f"""Create a comprehensive study guide from the content below. Use MARKDOWN formatting:

# Study Guide

## Key Concepts
- List and explain each key concept (use **bold** for important terms)

## Main Ideas  
- Explain the main ideas from the content

## Important Terms
| Term | Definition |
|------|------------|
| term1 | definition1 |
| term2 | definition2 |

## Summary
- Brief summary of the content

Content:
{combined_text[:6000]}

Generate well-formatted markdown."""

    study_guide = ""
    try:
        study_guide = llm.generate_response(prompt, llm.get_models_for_task("study_guide"))
    except LLMError as e:
        log_studio_error("study_guide.llm", e, {"notebook_id": notebook_id})
        return {"success": False, "error": e.error_code, "message": e.message, "study_guide": ""}
    except Exception as e:
        log_studio_error("study_guide.llm", e, {"notebook_id": notebook_id})
        return {"success": False, "error": "LLM_FAILED", "message": str(e), "study_guide": ""}
    
    if not study_guide.strip():
        return {"success": False, "error": "EMPTY_RESPONSE", "message": "LLM returned empty response", "study_guide": ""}
    
    logger.info("Study guide generated successfully")
    return {"success": True, "study_guide": study_guide}


@app.post("/api/notebooks/{notebook_id}/studio/quiz")
async def generate_quiz(notebook_id: str, request: QuizRequest):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    sources = sources_service.get_sources(notebook_id)
    if not sources:
        return {"questions": [], "error": "No sources available. Please add sources first."}
    
    combined_text = ""
    for source in sources:
        if source.type == "pdf":
            combined_text += pdf_parser.parse_pdf(source.file_path) + "\n"
        elif source.type == "docx":
            combined_text += docx_parser.parse_docx(source.file_path) + "\n"
        elif source.type in ["txt", "text"]:
            combined_text += txt_parser.parse_txt(source.file_path) + "\n"
    
    if not combined_text.strip():
        return {"questions": [], "error": "Could not extract text from sources."}
    
    # Extract numerical/formula content for numerical questions
    import re
    numerical_content = combined_text
    # Find lines with formulas, equations, or calculations
    formula_lines = []
    for line in combined_text.split('\n'):
        line = line.strip()
        # Look for lines containing: =, %, formula indicators, or numbers with context
        if any(char in line for char in ['=', 'α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'σ', 'π', 'ω']) or \
           re.search(r'\d+\.?\d*\s*(×|÷|\+|\-|\*|\/|%)', line) or \
           re.search(r'(mW|dB|kHz|MHz|GHz|Hz|V|mV|kV)', line, re.IGNORECASE):
            formula_lines.append(line)
        # Also include lines with specific numerical terms
        elif any(term in line.lower() for term in ['frequency', 'voltage', 'current', 'power', 'attenuation', 'bandwidth', 'modulation', 'encoding', 'rate', 'efficiency', 'decibel', 'signal']):
            formula_lines.append(line)
    
    numerical_context = '\n'.join(formula_lines[:30]) if formula_lines else combined_text[:2000]
    
    category_prompts = {
        "theory": {
            "description": "factual and conceptual questions testing understanding of key concepts, definitions, and principles",
            "example": "What is modulation? Define bandwidth. Explain the purpose of source coding."
        },
        "numerical": {
            "description": "calculation-based problems that require using formulas and computing values from the content",
            "example": f"Use values from this content to create numerical problems:\n{numerical_context[:500]}"
        },
        "exam": {
            "description": "university-level application questions combining theory with calculations, multi-step problem solving",
            "example": f"Based on content like:\n{numerical_context[:500]}"
        }
    }
    
    category = request.quiz_category if request.quiz_category in category_prompts else "theory"
    category_info = category_prompts[category]
    
    difficulty_hints = {
        "easy": "basic recall and simple questions",
        "medium": "moderate difficulty requiring understanding", 
        "hard": "challenging questions requiring deep understanding and application"
    }
    
    prompt = f"""Create {request.num_questions} {request.difficulty} difficulty quiz questions from the content below.

CATEGORY: {category.upper()}
TYPE: {category_info['description']}

Generate exactly {request.num_questions} multiple choice questions using this JSON format:
[{{"question": "specific question text based on content", "options": ["specific answer A", "specific answer B", "specific answer C", "specific answer D"], "correct_index": 0-3, "explanation": "brief explanation why this answer is correct"}}]

Requirements:
- Each option MUST be a real, specific answer derived from the content (not generic like "option A")
- correct_index indicates the correct answer (0=A, 1=B, 2=C, 3=D)
- Include a brief explanation for each answer
- Questions should be challenging and test actual understanding

KEY CONTENT FOR NUMERICAL QUESTIONS:
{numerical_context}

MAIN CONTENT:
{combined_text[:6000]}

IMPORTANT: For NUMERICAL category questions, extract actual values, formulas, and calculations from the content above. Create questions that require using these specific values from the source material.

Return ONLY the JSON array, no other text."""
    
    response = llm.generate_response(prompt, llm.get_models_for_task("quiz"))
    
    questions = []
    
    # Clean response
    cleaned_response = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', response)
    cleaned_response = re.sub(r'```json\s*', '', cleaned_response)
    cleaned_response = re.sub(r'```\s*', '', cleaned_response)
    cleaned_response = re.sub(r'<|>', '', cleaned_response)
    
    try:
        questions = json.loads(cleaned_response)
    except json.JSONDecodeError:
        json_match = re.search(r'\[[\s\S]*\]', cleaned_response)
        if json_match:
            partial = json_match.group()
            # Try to fix incomplete JSON - complete unclosed strings and arrays
            # Count brackets
            open_brackets = partial.count('[')
            close_brackets = partial.count(']')
            
            # Try the partial JSON first
            try:
                questions = json.loads(partial)
            except json.JSONDecodeError:
                # Try to extract individual complete objects using balanced bracket counting
                valid_questions = []
                in_object = False
                brace_count = 0
                current_obj = ""
                
                for i, char in enumerate(partial):
                    if char == '{':
                        in_object = True
                        brace_count = 1
                        current_obj = char
                    elif in_object:
                        current_obj += char
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                in_object = False
                                try:
                                    obj = json.loads(current_obj)
                                    if isinstance(obj, dict) and 'question' in obj and 'options' in obj:
                                        if 'correct_index' not in obj:
                                            obj['correct_index'] = 0
                                        if 'explanation' not in obj:
                                            obj['explanation'] = ''
                                        valid_questions.append(obj)
                                except:
                                    pass
                                current_obj = ""
                
                if valid_questions:
                    questions = valid_questions
                else:
                    return {"questions": [], "error": "Quiz generation failed. Please try again."}
        else:
            return {"questions": [], "error": "Quiz generation failed. Please try again."}
    
    if not isinstance(questions, list):
        return {"questions": [], "error": "Invalid quiz format received"}
    
    questions = [q for q in questions if isinstance(q, dict) and q.get('question') and q.get('options')]
    questions = questions[:request.num_questions]
    
    if not questions:
        return {"questions": [], "error": "Could not generate valid quiz questions."}
    
    return {
        "questions": questions,
        "topic": request.quiz_category,
        "difficulty": request.difficulty,
        "max_marks": request.max_marks
    }


@app.post("/api/notebooks/{notebook_id}/studio/theory-test")
async def generate_theory_test(notebook_id: str, request: TheoryTestRequest):
    """Generate theory test with comprehensive error handling"""
    logger.info(f"Generating theory test for notebook: {notebook_id}")
    
    # Step 1: Validate notebook exists
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        logger.warning(f"Notebook not found: {notebook_id}")
        return {"success": False, "error": "NOTEBOOK_NOT_FOUND", "message": "Notebook not found", "questions": []}
    
    # Step 2: Get sources
    sources = sources_service.get_sources(notebook_id)
    if not sources:
        logger.warning(f"No sources for notebook: {notebook_id}")
        return {"success": False, "error": "NO_SOURCES", "message": "No sources available. Please add sources first.", "questions": []}
    
    # Step 3: Parse source content with error handling
    combined_text = ""
    parse_errors = []
    for source in sources:
        try:
            if source.type == "pdf":
                text = pdf_parser.parse_pdf(source.file_path)
            elif source.type == "docx":
                text = docx_parser.parse_docx(source.file_path)
            elif source.type == "txt":
                text = txt_parser.parse_txt(source.file_path)
            else:
                continue
            
            if text and text.strip():
                combined_text += text + "\n"
            else:
                parse_errors.append(f"Empty content from: {source.name}")
        except Exception as e:
            logger.warning(f"Failed to parse {source.name}: {e}")
            parse_errors.append(f"Failed to parse: {source.name}")
    
    if not combined_text.strip():
        logger.error(f"No text extracted from sources. Errors: {parse_errors}")
        return {
            "success": False,
            "error": "PARSE_FAILED",
            "message": "Could not extract text from sources.",
            "details": {"parse_errors": parse_errors},
            "questions": []
        }
    
    # Step 4: Research (optional, non-blocking)
    research_context = ""
    try:
        topic_words = combined_text.split()[:100]
        key_topic = ' '.join(topic_words[:10])
        research_context = research.research_for_exam_paper(
            subject=notebook.name,
            topics=[key_topic, "university exam questions", "exam preparation"]
        )
    except Exception as e:
        logger.warning(f"Research failed (continuing without): {e}")
        research_context = ""
    
    # Step 5: Build prompt
    prompt = f"""Generate a university exam paper with {request.num_questions} questions from the content below.

# Step 5: Extract KEY TOPICS from source content first (for forcing real content)
    # Get first 1500 chars of actual content as "known topics"
    source_excerpt = combined_text[:1500] if combined_text else ""
    
    # Also add research topics if available
    research_topics = ""
    if research_context:
        # Extract just the first 500 chars from research
        research_topics = research_context[:500]
    
    # Build prompt WITHOUT any examples - just format description
    prompt = f"""TASK: Generate exactly {request.num_questions} university exam questions based on the SOURCE CONTENT below.

OUTPUT FORMAT (pure JSON, NO examples - do not copy any template text):
{{
  "questions": [
    {{
      "question_number": 1,
      "question": "ACTUAL question about a real concept from the content",
      "marks": 1,
      "model_answer": "Actual answer based on source",
      "key_points": ["real point 1"],
      "marks_breakdown": {{"accuracy": 1}}
    }}
  ],
  "total_marks": {request.num_questions * 5},
  "duration_minutes": {request.duration_minutes}
}}

CONSTRAINTS (IMPORTANT - follow these strictly):
- NEVER use "[topic]" or "[concept]" or placeholder text
- NEVER copy the format examples above - generate REAL new questions
- Questions MUST be about actual concepts from the SOURCE CONTENT section
- If content is insufficient, set questions to empty array
- Use marks distribution: 1-mark, 2-mark, 5-mark, 10-mark questions
- Return ONLY valid JSON, no markdown, no explanations

SOURCE CONTENT (these are REAL topics you MUST use):
{source_excerpt[:1200]}

WEB RESEARCH (additional context):
{research_topics if research_topics else "No additional research - use source content only"}

Return ONLY the JSON object with your generated questions."""

    # Step 6: Call LLM (with debug logging)
    llm_response = None
    try:
        model = llm.get_models_for_task("theory_test")
        logger.info(f"Calling LLM with model: {model} for theory test")
        logger.info(f"Source excerpt (first 200 chars): {source_excerpt[:200]}")
        logger.info(f"Prompt length: {len(prompt)} chars, Research context: {len(research_context)} chars")
        llm_response = llm.generate_response(prompt, model)
        
        # Log first 500 chars of response for debugging
        logger.info(f"LLM raw response (first 300 chars): {llm_response[:300]}")
    except LLMError as e:
        log_studio_error("llm.generate_response", e, {"notebook_id": notebook_id})
        return {"success": False, "error": e.error_code, "message": e.message, "questions": []}
    except Exception as e:
        log_studio_error("llm.generate_response", e, {"notebook_id": notebook_id})
        return {"success": False, "error": "LLM_FAILED", "message": f"LLM generation failed: {str(e)}", "questions": []}
    
    # Step 7: Parse JSON response with multiple fallbacks
    questions = []
    total_marks = request.num_questions * 5
    duration_minutes = request.duration_minutes
    
    try:
        # Clean response - remove common artifacts
        cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', llm_response)
        cleaned = re.sub(r'```json\s*', '', cleaned)
        cleaned = re.sub(r'```\s*', '', cleaned)
        cleaned = re.sub(r'^```$', '', cleaned)
        cleaned = cleaned.strip()
        
        logger.info(f"LLM response after cleaning (first 200 chars): {cleaned[:200]}")
        
        # Try direct parse first
        try:
            result = json.loads(cleaned)
            if isinstance(result, dict):
                questions = result.get('questions', [])
                total_marks = result.get('total_marks', total_marks)
                duration_minutes = result.get('duration_minutes', duration_minutes)
            elif isinstance(result, list):
                questions = result
        except json.JSONDecodeError:
            # Check if LLM returned refusal or error message
            refusal_patterns = ["i'm sorry", "i cannot", "i can't", "unable to", "don't have", "do not have"]
            lower_response = cleaned.lower()
            
            if any(pattern in lower_response for pattern in refusal_patterns):
                logger.error(f"LLM refused to generate: {cleaned[:300]}")
                return {
                    "success": False,
                    "error": "LLM_REFUSED",
                    "message": "AI refused to generate questions. Try a different prompt or sources.",
                    "debug": {"raw_response": cleaned[:500]},
                    "questions": []
                }
            
            # Try regex extraction for {"questions": [...]} pattern
            json_match = re.search(r'\{\s*"questions"\s*:\s*\[.*\]', cleaned, re.DOTALL)
            if json_match:
                try:
                    # Find the closing brace
                    bracket_count = 0
                    end_pos = 0
                    for i, char in enumerate(json_match.group()):
                        if char == '[':
                            bracket_count += 1
                        elif char == ']':
                            bracket_count -= 1
                            if bracket_count == 0:
                                end_pos = i + 1
                                break
                    if end_pos > 0:
                        json_str = json_match.group()[:end_pos]
                        result = json.loads(json_str)
                        questions = result.get('questions', []) if isinstance(result, dict) else result
                except:
                    pass
            
            # Last resort: Extract question objects by finding "question": "text" patterns
            if not questions:
                logger.info("Using fallback - extracting individual questions")
                question_texts = re.findall(r'"question"\s*:\s*"([^"]+)"', cleaned)
                answer_texts = re.findall(r'"(?:model_?answer|ideal_?answer)"\s*:\s*"([^"]+)"', cleaned)
                
                for i, q_text in enumerate(question_texts[:request.num_questions]):
                    if len(q_text.strip()) > 10:
                        ans = answer_texts[i] if i < len(answer_texts) else "See study materials"
                        questions.append({
                            'question': q_text,
                            'model_answer': ans,
                            'marks': 5
                        })
                
                # If still nothing - try to find lines with question marks
                if not questions:
                    for line in cleaned.split('\n'):
                        line = line.strip()
                        if '?' in line and len(line) > 20:
                            # Clean the question
                            q = re.sub(r'^\d+[.\)]\s*', '', line).strip()
                            q = re.sub(r'^Q\d+:\s*', '', q).strip()
                            if len(q) > 15:
                                questions.append({
                                    'question': q,
                                    'model_answer': 'Answer not provided - study source material',
                                    'marks': 5
                                })
                            if len(questions) >= request.num_questions:
                                break
        
        logger.info(f"Parsed {len(questions)} questions from LLM response (method: {'direct' if questions else 'fallback'})")
        
    except Exception as e:
        logger.error(f"JSON parse error: {e}. Raw response: {llm_response[:800]}")
        return {
            "success": False,
            "error": "JSON_PARSE_FAILED",
            "message": "Failed to parse LLM response as JSON. Check browser console for debug info.",
            "debug": {"raw_response": llm_response[:1500], "response_length": len(llm_response)},
            "questions": []
        }
    
    # Step 8: Validate questions
    if not isinstance(questions, list):
        logger.error(f"Questions is not a list: {type(questions)}")
        return {"success": False, "error": "INVALID_FORMAT", "message": "Invalid response format received.", "questions": []}
    
    # Normalize question fields
    processed_questions = []
    for i, q in enumerate(questions):
        if isinstance(q, dict):
            question_text = q.get('question', '')
            # REJECT placeholder/template questions - must have REAL content
            placeholder_patterns = ['[concept]', '[topic]', '[formula]', '[example]', '[define]']
            is_placeholder = any(pattern in question_text.lower() for pattern in placeholder_patterns)
            
            # Accept only questions with REAL content (more than 15 chars, no brackets)
            if question_text and len(question_text.strip()) > 15 and not is_placeholder and '[' not in question_text:
                # Handle multiple possible field names
                answer = (
                    q.get('model_answer') or 
                    q.get('ideal_answer') or 
                    q.get('answer') or 
                    q.get('model answer') or
                    'See study materials for answer.'
                )
                # Ensure we have key_points
                key_points = q.get('key_points', [])
                if isinstance(key_points, str):
                    key_points = [key_points]
                elif not isinstance(key_points, list):
                    key_points = []
                
                # Only accept if answer is also real (not empty placeholder)
                if answer and len(answer) > 10 and '[' not in answer:
                    processed_questions.append({
                        'question': question_text,
                        'model_answer': answer,
                        'key_points': key_points,
                        'marks_breakdown': q.get('marks_breakdown', {}),
                        'marks': q.get('marks', 5),
                        'question_number': q.get('question_number', i + 1)
                    })
    
processed_questions = processed_questions[:request.num_questions]
    
    logger.info(f"Processed {len(processed_questions)} VALID questions (rejected {len(questions) - len(processed_questions)} placeholders)")
    
    if not processed_questions:
        logger.error(f"No valid questions after filtering placeholders. Raw: {llm_response[:800]}")
        return {
            "success": False,
            "error": "PLACEHOLDER_ONLY",
            "message": "AI returned template/placeholder text instead of real questions. Try with more detailed source material.",
            "debug": {"raw_response": llm_response[:1000], "questions_before_filter": len(questions)},
            "questions": []
        }
    
    logger.info(f"Successfully generated {len(processed_questions)} theory test questions")
    
    return {
        "success": True,
        "questions": processed_questions,
        "total_marks": sum(q.get('marks', 5) for q in processed_questions),
        "duration_minutes": duration_minutes
    }


@app.post("/api/notebooks/{notebook_id}/studio/quiz/result")
async def save_quiz_result(notebook_id: str, result: QuizResult):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    weak_topics = [topic for topic, score in result.topic_scores.items() if score < result.total / len(result.topic_scores)]
    
    result_id = quiz_service.save_quiz_result(
        notebook_id=notebook_id,
        quiz_type="revision",
        difficulty="medium",
        score=result.score,
        total=result.total,
        topic_scores=result.topic_scores,
        weak_topics=weak_topics
    )
    return {"id": result_id, "message": "Quiz result saved"}


@app.get("/api/notebooks/{notebook_id}/studio/analytics")
async def get_analytics(notebook_id: str):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    return quiz_service.get_analytics(notebook_id)


@app.get("/api/notebooks/{notebook_id}/studio/quiz/history")
async def get_quiz_history(notebook_id: str):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    return quiz_service.get_quiz_results(notebook_id)


@app.post("/api/notebooks/{notebook_id}/studio/focused-flashcards")
async def generate_focused_flashcards(notebook_id: str):
    notebook = notebook_service.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    
    analytics = quiz_service.get_analytics(notebook_id)
    weak_topics = analytics.get("weak_topics", [])
    
    if not weak_topics:
        return {"flashcards": [], "message": "No weak topics identified yet. Take some quizzes first."}
    
    sources = sources_service.get_sources(notebook_id)
    combined_text = ""
    for source in sources:
        if source.type == "pdf":
            combined_text += pdf_parser.parse_pdf(source.file_path) + "\n"
        elif source.type == "docx":
            combined_text += docx_parser.parse_docx(source.file_path) + "\n"
        elif source.type in ["txt", "text"]:
            combined_text += txt_parser.parse_txt(source.file_path) + "\n"
    
    weak_topics_str = ", ".join(weak_topics[:3])
    prompt = f"""Create 10 flashcards focused on these weak areas: {weak_topics_str}

From the content below, create flashcards that test understanding of these specific topics.
Return JSON array format:
[{{"question": "?", "answer": "?"}}]

Content:
{combined_text[:6000]}

Focus on: {weak_topics_str}"""
    
    response = llm.generate_response(prompt, llm.get_models_for_task("flashcards"))
    
    flashcards = []
    try:
        cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', response)
        cleaned = re.sub(r'```json\s*', '', cleaned)
        cleaned = re.sub(r'```\s*', '', cleaned)
        flashcards = json.loads(cleaned)
    except json.JSONDecodeError:
        json_match = re.search(r'\[[\s\S]*\]', response)
        if json_match:
            flashcards = json.loads(json_match.group())
    
    if not isinstance(flashcards, list):
        flashcards = []
    flashcards = [f for f in flashcards if isinstance(f, dict) and f.get('question') and f.get('answer')]
    flashcards = flashcards[:10]
    
    return {"flashcards": flashcards, "focus_topics": weak_topics}


@app.get("/api/models")
async def list_models():
    models = llm.get_available_models()
    task_models = {
        "chat": settings.model_for_chat,
        "quiz": settings.model_for_quiz,
        "study_guide": settings.model_for_study_guide,
        "flashcards": settings.model_for_flashcards,
        "theory_test": settings.model_for_theory_test,
    }
    return {
        "available": models,
        "task_assignments": task_models
    }


@app.put("/api/models")
async def update_models(data: dict):
    if "chat" in data:
        settings.model_for_chat = data["chat"]
    if "quiz" in data:
        settings.model_for_quiz = data["quiz"]
    if "study_guide" in data:
        settings.model_for_study_guide = data["study_guide"]
    if "flashcards" in data:
        settings.model_for_flashcards = data["flashcards"]
    if "theory_test" in data:
        settings.model_for_theory_test = data["theory_test"]
    
    return {"message": "Model assignments updated", "task_assignments": {
        "chat": settings.model_for_chat,
        "quiz": settings.model_for_quiz,
        "study_guide": settings.model_for_study_guide,
        "flashcards": settings.model_for_flashcards,
        "theory_test": settings.model_for_theory_test,
    }}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)