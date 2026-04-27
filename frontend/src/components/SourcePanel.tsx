import { Source } from '../types';

interface SourcePanelProps {
  sources: Source[];
  loading: boolean;
  ocrEnabled: boolean;
  onOcrToggle: (enabled: boolean) => void;
  onUpload: (file: File) => void;
  onDelete: (sourceId: string) => void;
}

export function SourcePanel({ sources, loading, ocrEnabled, onOcrToggle, onUpload, onDelete }: SourcePanelProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = '';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return (
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'docx':
        return (
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h4a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-slate-900 border-r border-slate-700 p-4 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Sources</h2>
      
      <label className="flex items-center justify-center gap-2 w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium cursor-pointer transition mb-3">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Source
        <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} className="hidden" />
      </label>
      
      <label className="flex items-center gap-2 text-sm text-slate-400 mb-3 cursor-pointer hover:text-slate-300">
        <input
          type="checkbox"
          checked={ocrEnabled}
          onChange={(e) => onOcrToggle(e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
        />
        <span>Run OCR (scanned PDFs)</span>
      </label>
      
      {loading && (
        <div className="flex items-center gap-2 text-sm text-blue-400 mb-3">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </div>
      )}
      
      <div className="flex-1 overflow-auto space-y-2">
        {sources.length === 0 && !loading && (
          <div className="text-slate-500 text-sm text-center py-8">
            No sources added yet. Upload PDFs, DOCX, or TXT files.
          </div>
        )}
        {sources.map(source => (
          <div key={source.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <div className="flex items-start gap-2">
              {getTypeIcon(source.type)}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate" title={source.name}>
                  {source.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded uppercase">
                    {source.type}
                  </span>
                  {typeof source.metadata?.pages === 'number' && (
                    <span className="text-xs text-slate-500">
                      {source.metadata.pages} pages
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => onDelete(source.id)}
              className="text-xs text-slate-500 hover:text-red-400 mt-2 transition"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}