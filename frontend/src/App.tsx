import { useState, useEffect } from 'react';
import * as api from './utils/api';
import { Notebook, Source, Message, ChatResponse, Flashcard, QuizQuestion } from './types';
import { Sidebar, SourcePanel, ChatPanel, StudioPanel, SettingsPanel } from './components';

export function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [studyGuide, setStudyGuide] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'chat' | 'studio'>('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadNotebooks();
  }, []);

  useEffect(() => {
    if (selectedNotebook) {
      loadSources();
      loadHistory();
    }
  }, [selectedNotebook]);

  async function loadNotebooks() {
    const data = await api.fetchNotebooks();
    setNotebooks(data);
  }

  async function loadSources() {
    if (!selectedNotebook) return;
    const data = await api.fetchSources(selectedNotebook.id);
    setSources(data);
  }

  async function loadHistory() {
    if (!selectedNotebook) return;
    const data = await api.fetchChatHistory(selectedNotebook.id);
    setMessages(data);
  }

  async function handleCreateNotebook() {
    const name = prompt('Notebook name:');
    if (!name) return;
    await api.createNotebook(name);
    loadNotebooks();
  }

  async function handleDeleteNotebook(id: string) {
    if (!confirm('Delete this notebook?')) return;
    await api.deleteNotebook(id);
    if (selectedNotebook?.id === id) setSelectedNotebook(null);
    loadNotebooks();
  }

  async function handleUploadSource(file: File) {
    if (!selectedNotebook || !file) return;
    setLoading(true);
    setOcrEnabled(false);
    try {
      await api.uploadSource(selectedNotebook.id, file, ocrEnabled);
      loadSources();
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    if (!selectedNotebook) return;
    await api.deleteSource(selectedNotebook.id, sourceId);
    loadSources();
  }

  async function handleSendMessage() {
    if (!selectedNotebook || !input.trim()) return;
    setLoading(true);
    const userMsg: Message = {
      id: Date.now().toString(),
      notebook_id: selectedNotebook.id,
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    const query = input;
    setInput('');
    try {
      const response: ChatResponse = await api.sendChatMessage(selectedNotebook.id, query);
      setMessages(prev => [...prev, response.message]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFlashcards() {
    if (!selectedNotebook) return;
    setLoading(true);
    setStudioError(null);
    try {
      const response = await api.generateFlashcards(selectedNotebook.id);
      if (response.error || !response.success) {
        setStudioError(response.message || response.error || 'Failed to generate flashcards');
      } else {
        setFlashcards(response.flashcards || []);
      }
      setActivePanel('studio');
    } catch (e: any) {
      setStudioError(e.message || 'Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateStudyGuide() {
    if (!selectedNotebook) return;
    setLoading(true);
    setStudioError(null);
    try {
      const response = await api.generateStudyGuide(selectedNotebook.id);
      if (response.error || !response.success) {
        setStudioError(response.message || response.error || 'Failed to generate study guide');
      } else {
        setStudyGuide(response.study_guide || '');
      }
      setActivePanel('studio');
    } catch (e: any) {
      setStudioError(e.message || 'Failed to generate study guide');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateQuiz(difficulty: string, numQuestions: number, maxMarks: number, quizCategory: string) {
    if (!selectedNotebook) return;
    setLoading(true);
    setStudioError(null);
    try {
      const response = await api.generateQuiz(selectedNotebook.id, difficulty, numQuestions, maxMarks, quizCategory);
      if (response.error) {
        setStudioError(response.error);
      } else {
        setQuizQuestions(response.questions || []);
        setActivePanel('studio');
      }
    } catch (e) {
      setStudioError('Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFocusedFlashcards() {
    if (!selectedNotebook) return;
    setLoading(true);
    setStudioError(null);
    try {
      const response = await api.generateFocusedFlashcards(selectedNotebook.id);
      if (!response.error) {
        setFlashcards(response.flashcards || []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClearStudioError() {
    setStudioError(null);
  }

  return (
    <>
      <div className="flex h-screen bg-slate-900">
        <Sidebar
          notebooks={notebooks}
          selectedNotebook={selectedNotebook}
          onSelect={setSelectedNotebook}
          onCreate={handleCreateNotebook}
          onDelete={handleDeleteNotebook}
        />

        {selectedNotebook ? (
        <div className="flex-1 flex">
          <SourcePanel
            sources={sources}
            loading={loading}
            ocrEnabled={ocrEnabled}
            onOcrToggle={setOcrEnabled}
            onUpload={handleUploadSource}
            onDelete={handleDeleteSource}
          />

          <div className="flex-1 flex flex-col">
            <div className="bg-slate-800 border-b border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedNotebook.name}</h2>
                  <p className="text-xs text-slate-500">{sources.length} source{sources.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-1 bg-slate-700 rounded-lg p-1">
                  <button
                    onClick={() => setActivePanel('chat')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      activePanel === 'chat'
                        ? 'bg-slate-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setActivePanel('studio')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                      activePanel === 'studio'
                        ? 'bg-slate-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Studio
                  </button>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="px-3 py-2 rounded-md text-slate-400 hover:text-white"
                    title="Settings"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {activePanel === 'chat' ? (
                <ChatPanel
                  messages={messages}
                  input={input}
                  loading={loading}
                  onInputChange={setInput}
                  onSend={handleSendMessage}
                />
              ) : (
                <StudioPanel
                  flashcards={flashcards}
                  studyGuide={studyGuide}
                  loading={loading}
                  error={studioError}
                  notebookId={selectedNotebook.id}
                  quizQuestions={quizQuestions}
                  onGenerateFlashcards={handleGenerateFlashcards}
                  onGenerateStudyGuide={handleGenerateStudyGuide}
                  onGenerateQuiz={handleGenerateQuiz}
                  onGenerateFocusedFlashcards={handleGenerateFocusedFlashcards}
                  onClearError={handleClearStudioError}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-slate-400 text-lg mb-2">Select a notebook</div>
            <div className="text-slate-500 text-sm">
              Choose a notebook from the sidebar or create a new one
            </div>
          </div>
        </div>
      )}
      </div>
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}