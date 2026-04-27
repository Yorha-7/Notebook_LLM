import { useState, useEffect } from 'react';
import * as api from '../utils/api';

interface ModelAssignment {
  name: string;
  size: number;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsProps) {
  const [models, setModels] = useState<ModelAssignment[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.fetchAvailableModels();
      setModels(data.available || []);
      setAssignments(data.task_assignments || {});
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateModelAssignments(assignments);
      onClose();
    } catch (e) {
      console.error('Failed to save settings', e);
    } finally {
      setSaving(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1000000000) return `${(bytes / 1000000).toFixed(0)} MB`;
    return `${(bytes / 1000000000).toFixed(1)} GB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl w-full max-w-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Model Assignment
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select which AI model to use for each task
            </p>

            {loading ? (
              <div className="text-center text-slate-400 py-4">Loading...</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(assignments).map(([task, model]) => (
                  <div key={task}>
                    <label className="block text-sm text-slate-300 mb-2 capitalize">
                      {task.replace('_', ' ')}
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setAssignments({ ...assignments, [task]: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    >
                      {models.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({formatSize(m.size)})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Available Models
            </h3>
            <div className="space-y-2">
              {models.map((m) => (
                <div key={m.name} className="flex items-center justify-between bg-slate-700/50 p-2 rounded">
                  <span className="text-sm text-white">{m.name}</span>
                  <span className="text-xs text-slate-500">{formatSize(m.size)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}