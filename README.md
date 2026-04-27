# NotebookLLM

Local AI Research Assistant - Replica of Google NotebookLM, running entirely offline.

## Prerequisites

- Python 3.10+
- Node.js 18+ (for frontend)
- Ollama installed with a model pulled

## Quick Start

```bash
# 1. Install Ollama and pull a model
ollama pull llama3.1:8b

# 2. Run the startup script
./start.sh
```

## Manual Start

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Usage

1. Open http://localhost:5173
2. Click "+ New Notebook"
3. Add source files (PDF, DOCX, TXT)
4. Start chatting about your sources

## Features

- **Sources**: PDF, DOCX, TXT parsing
- **Chat**: RAG-based Q&A with citations
- **Studio**: Flashcards & Study Guides generation

## Tech Stack

- Backend: FastAPI + ChromaDB + Ollama
- Frontend: React + Vite + TailwindCSS