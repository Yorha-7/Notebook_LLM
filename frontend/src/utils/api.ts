const API_BASE = '/api';

export async function fetchNotebooks() {
  const res = await fetch(`${API_BASE}/notebooks`);
  return res.json();
}

export async function createNotebook(name: string) {
  const res = await fetch(`${API_BASE}/notebooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteNotebook(id: string) {
  await fetch(`${API_BASE}/notebooks/${id}`, { method: 'DELETE' });
}

export async function fetchSources(notebookId: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/sources`);
  return res.json();
}

export async function uploadSource(notebookId: string, file: File, ocr: boolean = false) {
  const formData = new FormData();
  formData.append('file', file);
  const url = ocr 
    ? `${API_BASE}/notebooks/${notebookId}/sources?ocr=true`
    : `${API_BASE}/notebooks/${notebookId}/sources`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function deleteSource(notebookId: string, sourceId: string) {
  await fetch(`${API_BASE}/notebooks/${notebookId}/sources/${sourceId}`, {
    method: 'DELETE',
  });
}

export async function sendChatMessage(notebookId: string, message: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function fetchChatHistory(notebookId: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/history`);
  return res.json();
}

export async function generateFlashcards(notebookId: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/flashcards`, {
    method: 'POST',
  });
  return res.json();
}

export async function generateStudyGuide(notebookId: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/study-guide`, {
    method: 'POST',
  });
  return res.json();
}

export async function generateQuiz(notebookId: string, difficulty: string, numQuestions: number, maxMarks: number, quizCategory: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ difficulty, num_questions: numQuestions, max_marks: maxMarks, quiz_category: quizCategory }),
  });
  return res.json();
}

export async function saveQuizResult(notebookId: string, score: number, total: number, topicScores: Record<string, number>) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/quiz/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notebook_id: notebookId, score, total, topic_scores: topicScores }),
  });
  return res.json();
}

export async function getAnalytics(notebookId: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/analytics`);
  return res.json();
}

export async function getQuizHistory(notebookId: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/quiz/history`);
  return res.json();
}

export async function generateFocusedFlashcards(notebookId: string) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/focused-flashcards`, {
    method: 'POST',
  });
  return res.json();
}

export async function generateTheoryTest(notebookId: string, numQuestions: number = 10, durationMinutes: number = 60) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/theory-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_questions: numQuestions, duration_minutes: durationMinutes }),
  });
  
  const data = await res.json();
  
  // Even if success is false, we still return the data to let the caller handle it
  return data;
}

export async function fetchAvailableModels() {
  const res = await fetch(`${API_BASE}/models`);
  return res.json();
}

export async function updateModelAssignments(assignments: Record<string, string>) {
  const res = await fetch(`${API_BASE}/models`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignments),
  });
  return res.json();
}