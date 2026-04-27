# NotebookLLM — Local AI Research Assistant

## Project Specification Document

**Version:** 1.0  
**Date:** 2026-04-26  
**Status:** Planning

---

## 1. Overview

NotebookLLM is a local-first, privacy-focused AI research assistant replicating core functionality of Google NotebookLM — without any Google dependencies, accounts, or cloud services. All AI inference runs on local hardware using Ollama.

**Core Philosophy:** Your data stays on your machine. No cloud, no account required.

---

## 2. Hardware Profile (Target System)

| Component | Specification |
|-----------|---------------|
| CPU | Intel i7-13700HX (16C/24T) |
| RAM | ~16GB (11GB available) |
| GPU | NVIDIA RTX 4060 Laptop (8GB VRAM) |
| Storage | 183GB NVMe (26GB free) |
| OS | Linux x86_64 |

**Recommended Local Models (RTX 4060 8GB):**
- Primary: Llama 3.1 8B Q4 (~5GB VRAM, 15-25 tok/s)
- Fallback: Qwen2.5 7B Q4, Mistral 7B Q4

---

## 3. Feature Set (NotebookLM LTS Parity)

### 3.1 Sources Module

| Feature | Description | Priority |
|---------|-------------|----------|
| PDF Upload | Parse and extract text from PDF documents | P0 |
| DOCX Upload | Read Microsoft Word documents | P0 |
| TXT Upload | Plain text file ingestion | P0 |
| EPUB Upload | E-book format support | P1 |
| URL Scraping | Fetch and parse web page content | P1 |
| Image Upload | OCR for scanned notes, diagrams | P2 |

**Excluded from Google NotebookLM:**
- YouTube URLs
- Audio file upload
- Google Drive integration

**Source Processing Pipeline:**
```
Upload → Parse → Chunk (512-1024 tokens) → Embed → Store in Vector DB
```

### 3.2 Chat Module

| Feature | Description | Priority |
|---------|-------------|----------|
| RAG Chat | Question answering grounded in sources | P0 |
| Inline Citations | Source references in responses | P0 |
| Large Context | Support for large document collections | P1 |
| Conversation History | Persistent chat sessions | P1 |

**RAG Configuration:**
- Chunk size: 512-1024 tokens with overlap
- Embedding model: All-MiniLM-L6-v2 (or local alternative)
- Retrieval: Top-k similarity search

### 3.3 Studio Module (Output Generation)

| Feature | Description | Priority |
|---------|-------------|----------|
| Study Guides | Structured learning materials | P1 |
| Flashcards | Q&A cards from sources | P1 |
| Quizzes | Multiple choice from content | P2 |
| Mind Maps | Visual concept diagrams | P2 |
| Reports | Synthesized written summaries | P1 |
| Data Tables | Structured data extraction | P2 |

### 3.4 Notebook Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Create/Edit/Delete Notebooks | Basic CRUD operations | P0 |
| Notebook Sidebar | Source and chat navigation | P0 |
| Multi-source Support | Multiple sources per notebook | P0 |

---

## 4. Technical Architecture

### 4.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Backend API | FastAPI (Python 3.10+) |
| Local LLM | Ollama (llama3.1:8b) |
| Embeddings | Sentence Transformers (all-MiniLM-L6-v2) |
| Vector Store | ChromaDB |
| Database | SQLite |
| File Storage | Local filesystem |
| Frontend | React + TypeScript + Vite |
| UI Library | Tailwind CSS |

### 4.2 Project Structure

```
notebook/
├── backend/
│   ├── app.py                 # FastAPI entry point
│   ├── config.py              # Configuration
│   ├── requirements.txt       # Python dependencies
│   ├── models/
│   │   ├── __init__.py
│   │   ├── notebook.py         # Notebook DB model
│   │   ├── source.py          # Source DB model
│   │   └── message.py         # Chat message model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── notebook.py         # Pydantic schemas
│   │   └── chat.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── notebook.py        # Notebook CRUD
│   │   ├── sources.py         # Source upload/parsing
│   │   ├── embeddings.py      # Chunking + embeddings
│   │   ├── retrieval.py       # Vector search
│   │   ├── chat.py            # RAG pipeline
│   │   └── studio.py          # Output generation
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── pdf.py
│   │   ├── docx.py
│   │   ├── txt.py
│   │   ├── epub.py
│   │   └── url.py
│   └── db/
│       ├── __init__.py
│       ├── database.py        # SQLite connection
│       └── vector.py           # ChromaDB client
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SourcePanel.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   └── StudioPanel.tsx
│   │   ├── pages/
│   │   │   └── Notebook.tsx
│   │   ├── hooks/
│   │   │   └── useApi.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   │       └── api.ts
│   └── index.html
├── data/
│   ├── notebooks.db           # SQLite database
│   └── chroma/                # Vector store
├── .env.example
└── README.md
```

### 4.3 Data Models

**Notebook:**
- id: UUID
- name: string
- created_at: datetime
- updated_at: datetime

**Source:**
- id: UUID
- notebook_id: UUID (FK)
- name: string
- type: enum (pdf, docx, txt, epub, url, image)
- file_path: string
- metadata: JSON
- created_at: datetime

**Message:**
- id: UUID
- notebook_id: UUID (FK)
- role: enum (user, assistant)
- content: string
- citations: JSON (optional)
- created_at: datetime

### 4.4 API Endpoints

```
# Notebooks
GET    /api/notebooks              # List all notebooks
POST   /api/notebooks              # Create notebook
GET    /api/notebooks/{id}         # Get notebook
PUT    /api/notebooks/{id}         # Update notebook
DELETE /api/notebooks/{id}         # Delete notebook

# Sources
GET    /api/notebooks/{id}/sources              # List sources
POST   /api/notebooks/{id}/sources              # Upload source
DELETE /api/notebooks/{id}/sources/{source_id}  # Delete source

# Chat
POST   /api/notebooks/{id}/chat    # Send message, get RAG response
GET    /api/notebooks/{id}/history # Get chat history

# Studio
POST   /api/notebooks/{id}/studio/flashcards
POST   /api/notebooks/{id}/studio/study-guide
POST   /api/notebooks/{id}/studio/report
POST   /api/notebooks/{id}/studio/mind-map
```

---

## 5. Implementation Phases

### Phase 1: Foundation (P0)
- [ ] Project scaffolding
- [ ] Database setup (SQLite)
- [ ] Ollama integration
- [ ] Basic notebook CRUD

### Phase 2: Sources (P0)
- [ ] PDF parser
- [ ] DOCX parser
- [ ] TXT parser
- [ ] Source management UI

### Phase 3: RAG Chat (P0)
- [ ] Chunking + embeddings
- [ ] ChromaDB integration
- [ ] Chat API with citations
- [ ] Chat UI

### Phase 4: Studio (P1-P2)
- [ ] Flashcards generation
- [ ] Study guides
- [ ] Reports
- [ ] Mind maps

### Phase 5: Polish
- [ ] EPUB support
- [ ] URL scraping
- [ ] Image OCR
- [ ] UI refinements

---

## 6. Dependencies

### Backend (Python 3.10+)

```
fastapi==0.109.0
uvicorn==0.27.0
sqlalchemy==2.0.25
chromadb==0.4.22
sentence-transformers==2.3.1
ollama==0.1.39
pypdf==4.0.1
python-docx==1.1.0
epub-parser==0.1.5
beautifulsoup4==4.12.3
python-multipart==0.0.6
pydantic==2.5.3
```

### Frontend

```
react==18.2.0
typescript==5.3.3
vite==5.0.11
tailwindcss==3.4.1
@tanstack/react-query==5.17.9
```

---

## 7. Configuration (.env)

```env
# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Storage
DATA_DIR=./data
CHROMA_DIR=./data/chroma

# Server
HOST=0.0.0.0
PORT=8000
```

---

## 8. Performance Considerations

| Aspect | Target |
|--------|--------|
| Model inference (RTX 4060) | 15-25 tok/s |
| Embedding batch | 512 chunks/batch |
| Context window | ~8K tokens (safe for 8GB VRAM) |
| Cold start | <5s for chat response |
| Source processing | <30s for 50-page PDF |

---

## 9. Future Enhancements (Out of Scope for V1)

- Multi-modal models for image understanding
- TTS for audio overviews
- Collaborative features (multi-user)
- Plugin system
- Cloud sync option (optional)

---

## 10. License

MIT License — Free for personal and commercial use.