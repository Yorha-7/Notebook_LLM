export interface Notebook {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  notebook_id: string;
  name: string;
  type: string;
  file_path: string;
  metadata?: Record<string, number | string>;
  created_at: string;
}

export interface Message {
  id: string;
  notebook_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<Record<string, unknown>>;
  created_at: string;
}

export interface ChatResponse {
  message: Message;
  sources?: Array<{
    content: string;
    metadata?: Record<string, unknown>;
    distance?: number;
  }>;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface TheoryQuestion {
  question: string;
  solution: string;
  marks: number;
  question_number: number;
  diagram?: string;  // Mermaid diagram code for visualizations
}

export interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: (number | null)[];
  showResult: boolean;
  score: number;
  total: number;
}

export interface Analytics {
  total_quizzes: number;
  average_score: number;
  weak_topics: string[];
  progress: Array<{
    score: number;
    total: number;
    percentage: number;
    quiz_type: string;
    difficulty: string;
    created_at: string;
  }>;
}