# Theory Test Feature - Implementation Plan

## Overview
Create a dedicated university-level theory test generator using wizard-math that generates 5-mark exam questions from source materials. This is NOT an MCQ quiz - it's actual exam-style questions requiring detailed written answers.

---

## 1. Backend Changes

### 1.1 New Endpoint
**File:** `backend/app.py`
**Endpoint:** `POST /api/notebooks/{notebook_id}/studio/theory-test`

### 1.2 Request/Response Schema
**File:** `backend/schemas/__init__.py`

```python
class TheoryTestRequest(BaseModel):
    num_questions: int = 10
    difficulty: str = "university"

class TheoryTestResponse(BaseModel):
    questions: List[TheoryQuestion]
    total_marks: int
    duration_minutes: int

class TheoryQuestion(BaseModel):
    question: str
    model_answer: str
    key_points: List[str]
    marks_breakdown: dict
```

### 1.3 Model Assignment
**File:** `backend/config.py`
```python
model_for_theory_test: str = "wizard-math:7b"
```

**File:** `backend/.env`
```
MODEL_FOR_THEORY_TEST=wizard-math:7b
```

### 1.4 LLM Service
**File:** `backend/services/llm.py`
Add "theory_test" to `get_models_for_task()` mapping.

### 1.5 Prompt Template
Wizard-math will generate:
- Long-answer exam questions (5 marks each)
- Model answers with key points
- Marks breakdown per question
- Questions derived from actual source content

---

## 2. Frontend Changes

### 2.1 New Types
**File:** `frontend/src/types/index.ts`
```typescript
export interface TheoryQuestion {
  question: string;
  model_answer: string;
  key_points: string[];
  marks_breakdown: Record<string, number>;
}

export interface TheoryTestState {
  questions: TheoryQuestion[];
  currentIndex: number;
  answers: string[];
  showAnswer: boolean[];
  total_marks: number;
}
```

### 2.2 New Views in StudioPanel
- `'theory-test-settings'` - Configuration page
- `'theory-test-take'` - Question display with answer input
- `'theory-test-review'` - Review answers with model answers
- `'theory-test-result'` - Summary screen

### 2.3 UI Flow

1. **Studio Home:** New tile "Theory Test (University Level)"
2. **Settings:** Number of questions slider (5-20)
3. **Test View:**
   - Display question prominently
   - Textarea for student's answer
   - "Show Model Answer" button (reveals after attempt)
   - Key points display
   - Navigation: Previous / Next / Submit
4. **Results:** Score summary, review options

### 2.4 API Integration
**File:** `frontend/src/utils/api.ts`
```typescript
export async function generateTheoryTest(notebookId: string, numQuestions: number) {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/studio/theory-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_questions: numQuestions }),
  });
  return res.json();
}
```

---

## 3. Implementation Order

1. Backend schema (schemas/__init__.py)
2. Backend config (config.py, .env)
3. LLM service update (services/llm.py)
4. New endpoint (app.py)
5. Frontend types (types/index.ts)
6. API function (utils/api.ts)
7. StudioPanel views (components/StudioPanel.tsx)
8. App.tsx integration

---

## 4. Success Criteria

- [ ] Wizard-math generates proper 5-mark exam questions
- [ ] Questions reference actual content from PDFs
- [ ] Model answers display with key points
- [ ] Student can write answers and compare with model
- [ ] Progress through all questions
- [ ] Return to studio after completion