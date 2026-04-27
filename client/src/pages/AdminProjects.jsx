import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminProjects() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const fetchProjects = useCallback(() => {
    setLoading(true);
    api.get('/projects/admin/all')
      .then((res) => setProjects(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { _id, createdAt, updatedAt, __v, ...payload } = editing;
      await api.patch(`/projects/${_id}`, payload);
      fetchProjects();
      setSelected(editing);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('adminProjects.deleteConfirm'))) return;
    setSaving(true);
    try {
      await api.delete(`/projects/${id}`);
      fetchProjects();
      if (selected?._id === id) setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async (project) => {
    setSaving(true);
    try {
      await api.patch(`/projects/${project._id}`, { isPublic: !project.isPublic });
      fetchProjects();
      if (selected?._id === project._id) {
        setSelected({ ...project, isPublic: !project.isPublic });
      }
    } finally {
      setSaving(false);
    }
  };

  const publicProjects = projects.filter((p) => p.isPublic);
  const hiddenProjects = projects.filter((p) => !p.isPublic);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg2/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-xl font-bold tracking-tight text-gray-900 dark:text-dark-text">
              G<span className="text-accent">.</span>
            </Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <Link to="/dashboard" className="text-sm text-gray-400 dark:text-dark-muted hover:text-accent">Dashboard</Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">{t('adminProjects.title')}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.7.4-1.3.7-1.6-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.2 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z" />
              </svg>
              {t('adminProjects.importGithub')}
            </button>
            <button
              onClick={() => { navigate('/'); setTimeout(() => logout(), 10); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-red-500 transition-colors"
            >
              {t('dashboard.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
                {t('adminProjects.public')} ({publicProjects.length})
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-dark-bg3 animate-pulse" />)}
                </div>
              ) : publicProjects.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-dark-muted italic">{t('adminProjects.noPublic')}</p>
              ) : (
                <div className="space-y-2">
                  {publicProjects.map((p) => (
                    <ProjectItem key={p._id} project={p} selected={selected?._id === p._id} onClick={() => { setSelected(p); setEditing(null); }} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
                {t('adminProjects.hidden')} ({hiddenProjects.length})
              </h2>
              {hiddenProjects.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-dark-muted italic">{t('adminProjects.noHidden')}</p>
              ) : (
                <div className="space-y-2">
                  {hiddenProjects.map((p) => (
                    <ProjectItem key={p._id} project={p} selected={selected?._id === p._id} onClick={() => { setSelected(p); setEditing(null); }} />
                  ))}
                </div>
              )}
            </section>
          </aside>

          <section className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 min-h-[600px]">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-dark-muted text-sm">
                {t('adminProjects.selectToPreview')}
              </div>
            ) : editing ? (
              <EditMode
                project={editing}
                onChange={setEditing}
                onCancel={() => setEditing(null)}
                onSave={handleSaveEdit}
                saving={saving}
                t={t}
              />
            ) : (
              <PreviewMode
                project={selected}
                onEdit={() => setEditing({ ...selected })}
                onTogglePublic={() => handleTogglePublic(selected)}
                onDelete={() => handleDelete(selected._id)}
                saving={saving}
                t={t}
              />
            )}
          </section>
        </div>
      </main>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchProjects(); }}
        />
      )}
    </div>
  );
}

function ProjectItem({ project, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? 'border-accent bg-accent/5'
          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-muted'
      }`}
    >
      <div className="flex items-center gap-2">
        {project.featured && (
          <svg className="w-3 h-3 text-accent shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
          </svg>
        )}
        <span className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{project.title}</span>
      </div>
      <div className="text-xs text-gray-400 dark:text-dark-muted mt-1 truncate">
        {project.stack?.slice(0, 3).join(' · ') || 'No stack'}
      </div>
    </button>
  );
}

function PreviewMode({ project, onEdit, onTogglePublic, onDelete, saving, t }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200 dark:border-dark-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              project.isPublic
                ? 'bg-accent/10 text-accent'
                : 'bg-gray-100 dark:bg-dark-bg3 text-gray-500 dark:text-dark-muted'
            }`}>
              {project.isPublic ? t('adminProjects.live') : t('adminProjects.hiddenStatus')}
            </span>
            {project.featured && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-accent/10 text-accent">
                ★ {t('projects.featured')}
              </span>
            )}
            {project.stack?.map((tech) => (
              <span key={tech} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-bg3 text-gray-500 dark:text-dark-muted">{tech}</span>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{project.title}</h1>
          {project.description && <p className="mt-2 text-sm text-gray-600 dark:text-dark-muted">{project.description}</p>}
        </div>

        <div className="flex gap-2 shrink-0 ml-4">
          <button onClick={onEdit} disabled={saving} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-dark-border hover:border-accent rounded-lg font-medium text-gray-700 dark:text-dark-text hover:text-accent transition-all disabled:opacity-40">
            {t('drafts.edit')}
          </button>
          <button onClick={onTogglePublic} disabled={saving} className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all disabled:opacity-40 ${
            project.isPublic
              ? 'border border-orange-500 text-orange-500 hover:bg-orange-500/10'
              : 'bg-accent hover:bg-accent-hover text-dark-bg'
          }`}>
            {project.isPublic ? t('adminProjects.hide') : t('adminProjects.publish')}
          </button>
          <button onClick={onDelete} disabled={saving} className="px-3 py-1.5 text-sm border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg font-medium transition-all disabled:opacity-40">
            {t('drafts.delete')}
          </button>
        </div>
      </div>

      {project.imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-bg3">
          <img src={project.imageUrl} alt={project.title} className="w-full max-h-80 object-cover" />
        </div>
      )}

      {project.longDescription && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-dark-muted mb-2">{t('adminProjects.longDescription')}</h2>
          <p className="text-sm text-gray-700 dark:text-dark-text leading-relaxed">{project.longDescription}</p>
        </div>
      )}

      {project.highlights?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-dark-muted mb-2">{t('adminProjects.highlights')}</h2>
          <ul className="space-y-1.5">
            {project.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-dark-text">
                <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        {project.githubUrl && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-dark-muted mb-1">GitHub</h3>
            <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block">{project.githubUrl}</a>
          </div>
        )}
        {project.liveUrl && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-dark-muted mb-1">Live</h3>
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block">{project.liveUrl}</a>
          </div>
        )}
      </div>
    </div>
  );
}

function EditMode({ project, onChange, onCancel, onSave, saving, t }) {
  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-dark-text">{t('drafts.editing')}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-dark-border hover:border-gray-400 rounded-lg font-medium text-gray-700 dark:text-dark-text transition-all disabled:opacity-40">
            {t('dashboard.cancel')}
          </button>
          <button onClick={onSave} disabled={saving} className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all disabled:opacity-40">
            {saving ? '...' : t('dashboard.save')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Title">
          <input type="text" value={project.title} onChange={(e) => onChange({ ...project, title: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Description (court — affichee sur la card)">
          <input type="text" value={project.description || ''} onChange={(e) => onChange({ ...project, description: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Long description (visible sur la grande carte signature)">
          <textarea rows={3} value={project.longDescription || ''} onChange={(e) => onChange({ ...project, longDescription: e.target.value })} className={`${inputClass} resize-none`} />
        </Field>
        <Field label="Highlights (un par ligne, max 4-5)">
          <textarea rows={4} value={(project.highlights || []).join('\n')} onChange={(e) => onChange({ ...project, highlights: e.target.value.split('\n').map((h) => h.trim()).filter(Boolean) })} className={`${inputClass} resize-none`} />
        </Field>
        <Field label="Stack (separe par des virgules)">
          <input type="text" value={(project.stack || []).join(', ')} onChange={(e) => onChange({ ...project, stack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="GitHub URL">
            <input type="url" value={project.githubUrl || ''} onChange={(e) => onChange({ ...project, githubUrl: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Live URL">
            <input type="url" value={project.liveUrl || ''} onChange={(e) => onChange({ ...project, liveUrl: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <Field label="Image URL (ex: /images/mon-projet.png)">
          <input type="text" value={project.imageUrl || ''} onChange={(e) => onChange({ ...project, imageUrl: e.target.value })} className={inputClass} />
        </Field>

        <div className="flex gap-4 pt-2">
          <Toggle
            label={t('adminProjects.isPublic')}
            checked={project.isPublic}
            onChange={(v) => onChange({ ...project, isPublic: v })}
          />
          <Toggle
            label={t('adminProjects.featured')}
            checked={project.featured}
            onChange={(v) => onChange({ ...project, featured: v })}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-gray-300 dark:bg-dark-border'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-sm text-gray-700 dark:text-dark-text">{label}</span>
    </label>
  );
}

function ImportModal({ onClose, onImported }) {
  const { t } = useTranslation();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/projects/github-import')
      .then((res) => setRepos(res.data.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (name) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      await api.post('/projects/github-import', { repoNames: Array.from(selected) });
      onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-dark-bg2 rounded-2xl border border-gray-200 dark:border-dark-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-dark-text">{t('adminProjects.importGithub')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-dark-bg3 animate-pulse" />)}
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : repos.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-dark-muted text-center py-8">
              {t('adminProjects.noNewRepos')}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-dark-muted mb-3">
                {t('adminProjects.selectReposHelp')}
              </p>
              {repos.map((r) => (
                <label
                  key={r.name}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selected.has(r.name)
                      ? 'border-accent bg-accent/5'
                      : 'border-gray-200 dark:border-dark-border hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.name)}
                    onChange={() => toggle(r.name)}
                    className="mt-1 accent-accent"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-dark-text">{r.name}</span>
                      {r.language && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-bg3 text-gray-500 dark:text-dark-muted">{r.language}</span>}
                      {r.stars > 0 && <span className="text-xs text-gray-400">★ {r.stars}</span>}
                    </div>
                    {r.description && <p className="text-xs text-gray-500 dark:text-dark-muted mt-1">{r.description}</p>}
                    {r.topics?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {r.topics.slice(0, 5).map((t) => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-bg3 text-gray-500">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-border flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-dark-muted">
            {selected.size} {t('adminProjects.selected')}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-dark-border hover:border-gray-400 rounded-lg font-medium text-gray-700 dark:text-dark-text transition-all">
              {t('dashboard.cancel')}
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover disabled:opacity-40 text-dark-bg rounded-lg font-medium transition-all"
            >
              {importing ? '...' : `${t('adminProjects.importSelected')} (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
