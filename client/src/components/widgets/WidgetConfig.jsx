import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function WidgetConfig({ widgets, onSave, onClose }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([...widgets]);
  const [dragIdx, setDragIdx] = useState(null);

  const toggle = (id) => {
    setItems(items.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setItems(next);
  };

  const moveDown = (idx) => {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setItems(next);
  };

  const handleDragStart = (idx) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-bg2 rounded-2xl border border-gray-200 dark:border-dark-border shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-dark-text">{t('dashboard.configTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-1 max-h-96 overflow-y-auto">
          {items.map((w, idx) => (
            <div
              key={w.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
                dragIdx === idx
                  ? 'bg-accent/10 border border-accent-border'
                  : 'bg-gray-50 dark:bg-dark-bg3 border border-transparent hover:border-gray-200 dark:hover:border-dark-border'
              }`}
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>

              <span className={`flex-1 text-sm font-medium ${w.enabled ? 'text-gray-900 dark:text-dark-text' : 'text-gray-400 dark:text-dark-muted'}`}>
                {t(`widgets.${w.id}`, w.label)}
              </span>

              <div className="flex gap-1">
                <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-accent disabled:opacity-30 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1} className="p-1 text-gray-400 hover:text-accent disabled:opacity-30 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>

              <button
                onClick={() => toggle(w.id)}
                className={`relative w-10 h-5 rounded-full transition-colors ${w.enabled ? 'bg-accent' : 'bg-gray-300 dark:bg-dark-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${w.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-bg3 transition-colors"
          >
            {t('dashboard.cancel')}
          </button>
          <button
            onClick={() => onSave(items)}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-accent hover:bg-accent-hover text-dark-bg transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
          >
            {t('dashboard.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
