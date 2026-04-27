import { useState, useEffect } from 'react';
import { Flashcard, QuizQuestion, QuizState, Analytics, TheoryQuestion } from '../types';
import { parseMarkdown } from '../utils/markdown';
import * as api from '../utils/api';

type StudioView = 'home' | 'flashcards-view' | 'study-guide' | 'quiz-settings' | 'quiz-take' | 'quiz-result' | 'analytics' | 'theory-test-settings' | 'theory-test-paper' | 'theory-test-take' | 'theory-test-result';

interface StudioPanelProps {
  flashcards: Flashcard[];
  studyGuide: string;
  loading: boolean;
  error: string | null;
  notebookId: string;
  quizQuestions: QuizQuestion[];
  onGenerateFlashcards: () => void;
  onGenerateStudyGuide: () => void;
  onGenerateQuiz: (difficulty: string, numQuestions: number, maxMarks: number, quizType: string) => void;
  onGenerateFocusedFlashcards: () => void;
  onClearError: () => void;
}

export function StudioPanel({
  flashcards,
  studyGuide,
  loading,
  error,
  notebookId,
  quizQuestions,
  onGenerateFlashcards,
  onGenerateStudyGuide,
  onGenerateQuiz,
  onGenerateFocusedFlashcards,
  onClearError,
}: StudioPanelProps) {
  const [view, setView] = useState<StudioView>('home');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [shuffled, setShuffled] = useState<Flashcard[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  
  const [quizSettings, setQuizSettings] = useState({ difficulty: 'medium', numQuestions: 10, maxMarks: 100, quizCategory: 'theory' });
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  
  const [theoryTestState, setTheoryTestState] = useState<{ questions: TheoryQuestion[]; currentIndex: number; answers: string[]; showAnswer: boolean[]; total_marks: number; timeRemaining?: number } | null>(null);
  const [theoryNumQuestions, setTheoryNumQuestions] = useState(10);
  const [theoryDuration, setTheoryDuration] = useState(60);

  const handleFlip = () => setFlipped(!flipped);

  const nextCard = () => {
    if (currentIndex < shuffled.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    } else {
      resetToHome();
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFlipped(false);
    }
  };

  const resetToHome = () => {
    if (view === 'theory-test-take' || view === 'theory-test-paper') {
      if (!confirm('Are you sure you want to exit? Your answers will be lost.')) {
        return;
      }
    }
    setView('home');
    setFlipped(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
    onClearError();
  };

  const handleQuizGenerate = async () => {
    setLocalLoading(true);
    try {
      await onGenerateQuiz(quizSettings.difficulty, quizSettings.numQuestions, quizSettings.maxMarks, quizSettings.quizCategory);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleGenerateTheoryTest = async () => {
    setLocalLoading(true);
    try {
      const response = await api.generateTheoryTest(notebookId, theoryNumQuestions, theoryDuration);
      
      // Debug logging
      console.log('=== THEORY TEST DEBUG ===');
      console.log('Full response:', response);
      console.log('Questions count:', response.questions?.length);
      console.log('First question:', response.questions?.[0]);
      
      if (response.error) {
        console.error('=== THEORY TEST ERROR ===');
        console.error('Error code:', response.error);
        console.error('Full response:', response);
        
        let debugMsg = '';
        if (response.debug?.raw_response) {
          debugMsg = '\n\nRaw response:\n' + response.debug.raw_response.slice(0, 500);
        }
        
        alert(`${response.message || 'Failed to generate test'}\n\nError: ${response.error}${debugMsg}`);
        setLocalLoading(false);
        return;
      }
      if (!response.questions || response.questions.length === 0) {
        alert('No questions generated. Please check if you have sources with content, or try again.');
        console.log('Empty questions - response:', response);
        setLocalLoading(false);
        return;
      }
      const questions = response.questions;
      const durationMinutes = response.duration_minutes || theoryDuration;
      setTheoryTestState({
        questions,
        currentIndex: 0,
        answers: new Array(questions.length).fill(''),
        showAnswer: new Array(questions.length).fill(false),
        total_marks: response.total_marks || questions.reduce((sum: number, q: any) => sum + (q.marks || 5), 0),
        timeRemaining: durationMinutes * 60,
      });
      setView('theory-test-paper');
    } catch (err: any) {
      console.error('Theory test generation exception:', err);
      alert(err.message || 'Failed to generate test. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  // Timer effect
  useEffect(() => {
    if (theoryTestState?.timeRemaining && theoryTestState.timeRemaining > 0 && view === 'theory-test-take') {
      const timer = setInterval(() => {
        setTheoryTestState(prev => {
          if (!prev || prev.timeRemaining === undefined) return prev;
          if (prev.timeRemaining <= 1) {
            setView('theory-test-result');
            return { ...prev, timeRemaining: 0 };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [theoryTestState?.timeRemaining, view]);

  const handleShuffle = () => {
    const shuffledCards = [...flashcards].sort(() => Math.random() - 0.5);
    setShuffled(shuffledCards);
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
  };

  const startFlashcards = () => {
    setShuffled(flashcards);
    setCurrentIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setView('flashcards-view');
  };

  const startQuiz = (questions: QuizQuestion[]) => {
    setQuizState({
      questions,
      currentIndex: 0,
      answers: [],
      showResult: false,
      score: 0,
      total: questions.length
    });
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setView('quiz-take');
  };

  const submitAnswer = () => {
    if (!quizState || selectedAnswer === null) return;
    setShowExplanation(true);
  };

  const nextQuestion = async () => {
    if (!quizState) return;
    
    const isCorrect = selectedAnswer === quizState.questions[quizState.currentIndex].correct_index;
    const newAnswers = [...quizState.answers, selectedAnswer];
    const newScore = quizState.score + (isCorrect ? 1 : 0);
    const newIndex = quizState.currentIndex + 1;
    
    if (newIndex >= quizState.questions.length) {
      const topicScores: Record<string, number> = { 'general': newScore };
      await api.saveQuizResult(notebookId, newScore, quizState.total, topicScores);
      setQuizState({
        ...quizState,
        answers: newAnswers,
        score: newScore,
        showResult: true
      });
      setView('quiz-result');
      loadAnalytics();
    } else {
      setQuizState({
        ...quizState,
        answers: newAnswers,
        currentIndex: newIndex,
        score: newScore
      });
      setCurrentIndex(newIndex);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const loadAnalytics = async () => {
    const data = await api.getAnalytics(notebookId);
    setAnalytics(data);
  };

  useEffect(() => {
    if (view === 'analytics') {
      loadAnalytics();
    }
  }, [view]);

  const generateFromWeakAreas = () => {
    onGenerateFocusedFlashcards();
    setView('flashcards-view');
  };

  if (localLoading || loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <svg className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="text-slate-400">Generating...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Studio
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 w-full max-w-md text-center">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-red-400 text-lg mb-2">Generation Failed</div>
            <div className="text-slate-400 text-sm">{error}</div>
            <button 
              onClick={resetToHome} 
              className="mt-6 px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'flashcards-view' && flashcards.length > 0) {
    const currentCard = shuffled[currentIndex];
    const progress = known.size;
    const total = shuffled.length;

    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="text-right">
            <div className="text-xl font-bold text-blue-400">{progress}/{total}</div>
            <div className="text-xs text-slate-500">mastered</div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          <div className={`flip-scale w-full max-w-lg${flipped ? ' flipped' : ''}`} onClick={handleFlip}>
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 flex flex-col items-center justify-center text-center min-h-[280px] flip-front">
              <div className="text-xs text-blue-400 uppercase tracking-wider mb-4">Question</div>
              <div className="text-lg text-white font-medium">{currentCard?.question}</div>
              <div className="text-slate-500 text-sm mt-6">Tap to reveal answer</div>
            </div>
            <div className="bg-blue-600/20 rounded-2xl border border-blue-500/50 p-8 flex flex-col items-center justify-center text-center min-h-[280px] flip-back">
              <div className="text-xs text-blue-400 uppercase tracking-wider mb-4">Answer</div>
              <div className="text-lg text-white font-medium">{currentCard?.answer}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <button
            onClick={prevCard}
            disabled={currentIndex === 0}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex gap-2">
            <button onClick={handleShuffle} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">
              Shuffle
            </button>
            <button
              onClick={() => { setKnown(new Set()); setCurrentIndex(0); setFlipped(false); }}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"
            >
              Restart
            </button>
          </div>
          
          {flipped ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setKnown(prev => new Set([...prev, currentIndex])); nextCard(); }}
                className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
              >
                Got it
              </button>
              <button
                onClick={nextCard}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Missed
              </button>
            </div>
          ) : (
            <button onClick={handleFlip} className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600">
              Show Answer
            </button>
          )}
        </div>

        <div className="flex justify-center gap-1 pb-4">
          {shuffled.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${
              i === currentIndex ? 'bg-blue-400' : known.has(i) ? 'bg-green-400' : 'bg-slate-600'
            }`} />
          ))}
        </div>
      </div>
    );
  }

  if (view === 'study-guide' && studyGuide) {
    const parsed = parseMarkdown(studyGuide);
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Studio
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <article className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-sm" dangerouslySetInnerHTML={parsed} />
        </div>
      </div>
    );
  }

  if (view === 'quiz-settings') {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Quiz Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Difficulty</label>
              <select
                value={quizSettings.difficulty}
                onChange={(e) => setQuizSettings({ ...quizSettings, difficulty: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">Number of Questions</label>
              <input
                type="number"
                min={5}
                max={20}
                value={quizSettings.numQuestions}
                onChange={(e) => setQuizSettings({ ...quizSettings, numQuestions: parseInt(e.target.value) || 10 })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">Category</label>
              <select
                value={quizSettings.quizCategory}
                onChange={(e) => setQuizSettings({ ...quizSettings, quizCategory: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white"
              >
                <option value="theory">Theory - Concepts & Definitions</option>
                <option value="numerical">Numerical - Formulas & Calculations</option>
                <option value="exam">Exam - University Level</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                {quizSettings.quizCategory === 'theory' && 'Test your understanding of concepts and definitions'}
                {quizSettings.quizCategory === 'numerical' && 'Practice problems with formulas and calculations'}
                {quizSettings.quizCategory === 'exam' && 'University-level application questions'}
              </p>
            </div>
            
            <button
              onClick={handleQuizGenerate}
              className="w-full py-4 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium text-white mt-6"
            >
              Generate Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'quiz-take' && quizState) {
    const q = quizState.questions[quizState.currentIndex];
    
    if (!q || !q.options || q.options.length === 0) {
      return (
        <div className="h-full flex flex-col bg-slate-900 items-center justify-center">
          <div className="text-red-400 mb-4">Invalid quiz data</div>
          <button onClick={resetToHome} className="px-4 py-2 bg-blue-500 rounded-lg text-white">
            Back to Studio
          </button>
        </div>
      );
    }
    
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit
            </button>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-400">{quizState.currentIndex + 1}/{quizState.questions.length}</div>
            </div>
          </div>
          <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${((quizState.currentIndex + 1) / quizState.questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg text-white font-medium mb-6">{q?.question}</h3>

          <div className="space-y-3">
            {q?.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => !showExplanation && setSelectedAnswer(i)}
                disabled={showExplanation}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  showExplanation
                    ? i === q.correct_index
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : selectedAnswer === i
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'border-slate-700 text-slate-400'
                    : selectedAnswer === i
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-slate-700 hover:border-slate-500 text-slate-300'
                }`}
              >
                <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
              </button>
            ))}
          </div>

          {showExplanation && q?.explanation && (
            <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="text-xs text-blue-400 uppercase tracking-wider mb-2">Explanation</div>
              <div className="text-sm text-slate-300">{q.explanation}</div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700">
          {!showExplanation ? (
            <button
              onClick={submitAnswer}
              disabled={selectedAnswer === null}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium"
            >
              Submit
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium"
            >
              {quizState.currentIndex + 1 >= quizState.questions.length ? 'See Results' : 'Next'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view === 'quiz-result' && quizState) {
    const percentage = Math.round((quizState.score / quizState.total) * 100);
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className={`text-6xl font-bold mb-4 ${percentage >= 70 ? 'text-green-400' : percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {percentage}%
          </div>
          <div className="text-2xl text-white font-medium mb-2">
            {quizState.score} / {quizState.total} correct
          </div>
          <div className="text-slate-400 mb-8">
            {percentage >= 70 ? 'Great job!' : percentage >= 50 ? 'Good effort!' : 'Keep practicing!'}
          </div>
          
          <button
            onClick={() => startQuiz(quizState.questions)}
            className="w-full max-w-xs py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium mb-3"
          >
            Retry Quiz
          </button>
          <button
            onClick={resetToHome}
            className="w-full max-w-xs py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium"
          >
            Back to Studio
          </button>
        </div>
      </div>
    );
  }

  if (view === 'analytics' && analytics) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Analytics</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className="text-3xl font-bold text-blue-400">{analytics.total_quizzes}</div>
              <div className="text-sm text-slate-400">Quizzes Taken</div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className="text-3xl font-bold text-green-400">{analytics.average_score}%</div>
              <div className="text-sm text-slate-400">Average Score</div>
            </div>
          </div>

          {analytics.weak_topics.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Areas Need Work</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {analytics.weak_topics.map((topic, i) => (
                  <span key={i} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
                    {topic}
                  </span>
                ))}
              </div>
              <button onClick={generateFromWeakAreas} className="text-sm text-blue-400 hover:text-blue-300">
                Generate focused flashcards →
              </button>
            </div>
          )}

          {analytics.progress.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Recent Progress</h3>
              <div className="space-y-2">
                {analytics.progress.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                    <span className="text-sm text-slate-300">{p.quiz_type} ({p.difficulty})</span>
                    <span className={`font-medium ${p.percentage >= 70 ? 'text-green-400' : p.percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {p.score}/{p.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'theory-test-settings') {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-semibold text-white mb-2">Theory Test</h2>
          <p className="text-slate-400 mb-6">University exam paper with timer</p>
          
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Number of Questions</label>
              <input
                type="range"
                min={5}
                max={20}
                value={theoryNumQuestions}
                onChange={(e) => setTheoryNumQuestions(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-center text-white text-2xl font-bold mt-2">{theoryNumQuestions} Questions</div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Duration (minutes)</label>
              <input
                type="range"
                min={30}
                max={180}
                step={15}
                value={theoryDuration}
                onChange={(e) => setTheoryDuration(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-center text-white text-2xl font-bold mt-2">{theoryDuration} min</div>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="text-red-400 font-medium mb-2">About This Feature</div>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Generates university exam-style questions (1, 2, 5, 10 marks)</li>
                <li>• Timer starts when you begin the test</li>
                <li>• Write your answers, then check model solutions</li>
                <li>• Mix of short answers and detailed explanations</li>
                <li>• AI enhances questions using online resources</li>
              </ul>
            </div>
            
            <button
              onClick={handleGenerateTheoryTest}
              disabled={localLoading}
              className="w-full py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg font-medium text-white"
            >
              {localLoading ? 'Generating Exam...' : `Start ${theoryDuration}min Exam`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'theory-test-paper' && theoryTestState) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <button onClick={resetToHome} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit
            </button>
            <div className="text-right">
              <div className="text-lg font-bold text-red-400">{theoryTestState.total_marks} marks</div>
              <div className="text-xs text-slate-500">Duration: {theoryDuration} min</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="text-red-400 font-medium mb-2">Instructions</div>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Answer all questions within the time limit</li>
              <li>• Click "Start Test" to begin with the timer</li>
              <li>• You can view model answers after attempting</li>
            </ul>
          </div>

          <h2 className="text-xl font-semibold text-white mb-4">Exam Paper Preview</h2>
          
          <div className="space-y-4">
            {theoryTestState.questions.map((q: any, i: number) => (
              <div key={i} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Q{q.question_number || i + 1}</span>
                  <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold">
                    {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                  </span>
                </div>
                <div className="text-white">{q.question}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={() => {
              setTheoryTestState(prev => prev ? { ...prev, timeRemaining: theoryDuration * 60 } : null);
              setView('theory-test-take');
            }}
            className="w-full py-4 bg-red-500 hover:bg-red-600 rounded-lg font-medium text-white"
          >
            Start Test ({theoryDuration} min timer)
          </button>
        </div>
      </div>
    );
  }

  if (view === 'theory-test-take' && theoryTestState) {
    const currentQ = theoryTestState.questions[theoryTestState.currentIndex];
    const currentAnswer = theoryTestState.answers[theoryTestState.currentIndex];
    const showAnswer = theoryTestState.showAnswer[theoryTestState.currentIndex];
    const minutes = Math.floor((theoryTestState.timeRemaining || 0) / 60);
    const seconds = (theoryTestState.timeRemaining || 0) % 60;
    const isLowTime = (theoryTestState.timeRemaining || 0) < 300;
    
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <button onClick={resetToHome} className="text-red-400 hover:text-red-300 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit
            </button>
            <div className={`text-lg font-bold ${isLowTime ? 'text-red-400 animate-pulse' : 'text-red-400'}`}>
              ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-red-400">Q{theoryTestState.currentIndex + 1}/{theoryTestState.questions.length}</div>
              <div className="text-xs text-slate-500">{theoryTestState.total_marks} marks</div>
            </div>
          </div>
          <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all"
              style={{ width: `${((theoryTestState.currentIndex + 1) / theoryTestState.questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-slate-800 rounded-xl border border-red-500/30 p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-red-400 uppercase tracking-wider">Question {currentQ.question_number}</div>
              <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-bold">
                {currentQ.marks} {currentQ.marks === 1 ? 'mark' : 'marks'}
              </div>
            </div>
            <h3 className="text-lg text-white font-medium">{currentQ.question}</h3>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-2">Your Answer</label>
            <textarea
              value={currentAnswer}
              onChange={(e) => {
                const newAnswers = [...theoryTestState.answers];
                newAnswers[theoryTestState.currentIndex] = e.target.value;
                setTheoryTestState({ ...theoryTestState, answers: newAnswers });
              }}
              placeholder="Write your answer here..."
              className="w-full h-48 bg-slate-800 border border-slate-600 rounded-lg p-4 text-white resize-none"
            />
          </div>
          
          <button
            onClick={() => {
              const newShow = [...theoryTestState.showAnswer];
              newShow[theoryTestState.currentIndex] = !newShow[theoryTestState.currentIndex];
              setTheoryTestState({ ...theoryTestState, showAnswer: newShow });
            }}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium text-white mb-6"
          >
            {showAnswer ? 'Hide Model Answer' : 'Show Model Answer'}
          </button>
          
{showAnswer && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-green-400 uppercase tracking-wider">Solution</div>
                <div className="text-xs text-green-400">({currentQ.marks} marks)</div>
              </div>
              
              {/* Solution text - simplified */}
              <div className="text-white mb-4 whitespace-pre-wrap">{currentQ.solution}</div>
              
              {/* Mermaid Diagram if present */}
              {currentQ.diagram && (
                <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                  <div className="text-xs text-green-400 uppercase tracking-wider mb-2">Diagram</div>
                  <pre className="text-xs text-green-300 overflow-x-auto bg-slate-800 p-2 rounded">
                    {currentQ.diagram}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={() => {
              if (theoryTestState.currentIndex > 0) {
                setTheoryTestState({ ...theoryTestState, currentIndex: theoryTestState.currentIndex - 1 });
              }
            }}
            disabled={theoryTestState.currentIndex === 0}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg font-medium"
          >
            Previous
          </button>
          <button
            onClick={() => {
              if (theoryTestState.currentIndex < theoryTestState.questions.length - 1) {
                setTheoryTestState({ ...theoryTestState, currentIndex: theoryTestState.currentIndex + 1 });
              } else {
                setView('theory-test-result');
              }
            }}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-medium"
          >
            {theoryTestState.currentIndex < theoryTestState.questions.length - 1 ? 'Next' : 'Finish Test'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'theory-test-result' && theoryTestState) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-6xl font-bold text-red-400 mb-4">{theoryTestState.total_marks}</div>
          <div className="text-2xl text-white font-medium mb-2">Theory Test Complete</div>
          <div className="text-slate-400 mb-8">{theoryTestState.questions.length} questions answered</div>
          
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <div className="text-center text-slate-300 mb-4">
              Review your answers or go back to study more
            </div>
            <button
              onClick={() => setView('theory-test-take')}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium mb-3"
            >
              Review Answers
            </button>
            <button
              onClick={resetToHome}
              className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-lg font-medium"
            >
              Back to Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">Studio</h2>
        <p className="text-sm text-slate-400">Generate study materials from your sources</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onGenerateFlashcards}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500/50 text-left group"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="text-white font-medium mb-1">Flashcards</div>
            <div className="text-slate-500 text-sm">Create Q&A cards</div>
          </button>

          <button
            onClick={onGenerateStudyGuide}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-green-500/50 text-left group"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="text-white font-medium mb-1">Study Guide</div>
            <div className="text-slate-500 text-sm">Structured notes</div>
          </button>

          <button
            onClick={() => setView('quiz-settings')}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-purple-500/50 text-left group"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="text-white font-medium mb-1">Quiz</div>
            <div className="text-slate-500 text-sm">Test knowledge</div>
          </button>

          <button
            onClick={() => setView('analytics')}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-orange-500/50 text-left group"
          >
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-white font-medium mb-1">Analytics</div>
            <div className="text-slate-500 text-sm">Track progress</div>
          </button>

          <button
            onClick={() => setView('theory-test-settings')}
            className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-red-500/50 text-left group"
          >
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-white font-medium mb-1">Theory Test</div>
            <div className="text-slate-500 text-sm">University exam prep</div>
          </button>
        </div>

        {flashcards.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">Your Flashcards</h3>
              <span className="text-sm text-slate-500">{flashcards.length} cards</span>
            </div>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {flashcards.slice(0, 5).map((card, i) => (
                <div key={i} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                  <div className="text-sm text-slate-400 mb-1">Q: {card.question.slice(0, 50)}{card.question.length > 50 ? '...' : ''}</div>
                  <div className="text-sm text-white">A: {card.answer.slice(0, 50)}{card.answer.length > 50 ? '...' : ''}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={startFlashcards}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium text-sm"
              >
                Practice {flashcards.length} Cards
              </button>
              <button
                onClick={onGenerateStudyGuide}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
              >
                Study Guide
              </button>
            </div>
</div>
          )}
          
        {studyGuide && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">Study Guide</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('study-guide')}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium text-sm"
              >
                View Study Guide
              </button>
            </div>
          </div>
        )}

        {quizQuestions.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">Quiz Ready</h3>
              <span className="text-sm text-slate-500">{quizQuestions.length} questions</span>
            </div>
            <button
              onClick={() => startQuiz(quizQuestions)}
              className="w-full py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium"
            >
              Start Quiz ({quizQuestions.length} questions)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}