import { Notebook } from '../types';

interface SidebarProps {
  notebooks: Notebook[];
  selectedNotebook: Notebook | null;
  onSelect: (notebook: Notebook) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ notebooks, selectedNotebook, onSelect, onCreate, onDelete }: SidebarProps) {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">NotebookLLM</h1>
      </div>
      
      <button
        onClick={onCreate}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium mb-4 transition flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Notebook
      </button>
      
      <div className="flex-1 overflow-auto space-y-2">
        {notebooks.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-8">
            No notebooks yet. Create one to get started.
          </div>
        )}
        {notebooks.map(nb => (
          <div
            key={nb.id}
            onClick={() => onSelect(nb)}
            className={`p-3 rounded-lg cursor-pointer transition group ${
              selectedNotebook?.id === nb.id
                ? 'bg-blue-500/20 border border-blue-500/50'
                : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="font-medium text-white truncate flex-1">{nb.name}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(nb.id);
                }}
                className="opacity-60 hover:opacity-100 text-slate-400 hover:text-red-400 transition ml-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date(nb.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          </div>
        ))}
      </div>
      
      <div className="pt-4 border-t border-slate-700 mt-4">
        <div className="text-xs text-slate-500">
          Powered by Ollama
        </div>
      </div>
    </div>
  );
}