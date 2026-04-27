#!/bin/bash

# NotebookLLM Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== NotebookLLM Starting ==="

# Install OCR dependencies if needed
if ! command -v tesseract &> /dev/null; then
    echo "Installing OCR dependencies..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y tesseract-ocr poppler-utils
    else
        echo "Warning: tesseract not found. Please install tesseract-ocr and poppler-utils manually."
    fi
fi

# Install/update Python dependencies
echo "Installing Python dependencies..."
cd "$SCRIPT_DIR/backend"
pip install -q -r requirements.txt 2>/dev/null || pip3 install -q -r requirements.txt 2>/dev/null || true

# Check Ollama
if ! curl -s http://localhost:11434 > /dev/null 2>&1; then
    echo "Starting Ollama..."
    ollama serve &
    sleep 3
else
    echo "Ollama already running"
fi

# Start backend
echo "Starting backend..."
cd "$SCRIPT_DIR/backend"
setsid python3 app.py >/tmp/backend.log 2>&1 &
BACKEND_PID=$!

sleep 3

# Start frontend (requires Node 18+)
if command -v npm &> /dev/null; then
    echo "Installing frontend dependencies..."
    cd "$SCRIPT_DIR/frontend"
    npm install 2>/dev/null || true
    echo "Starting frontend..."
    npm run dev &
    FRONTEND_PID=$!
else
    echo "npm not found, skipping frontend"
fi

echo ""
echo "=== NotebookLLM Running ==="
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait