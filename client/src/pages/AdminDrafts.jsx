import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminDrafts() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchArticles = useCallback(() => {
    setLoading(true);
    api.get('/articles/admin/all')
      .then((res) => setArticles(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const handlePublishToggle = async (id) => {
    setSaving(true);
    try {
      await api.patch(`/articles/${id}/publish`);
      fetchArticles();
      if (selected?._id === id) {
        const updated = await api.get(`/articles/${selected.slug}`).catch(() => null);
        if (updated) setSelected(updated.data.data);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('drafts.deleteConfirm'))) return;
    setSaving(true);
    try {
      await api.delete(`/articles/${id}`);
      fetchArticles();
      if (selected?._id === id) setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/articles/${editing._id}`, {
        title: editing.title,
        excerpt: editing.excerpt,
        content: editing.content,
        tags: editing.tags,
      });
      fetchArticles();
      setSelected(editing);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const drafts = articles.filter((a) => !a.published);
  const published = articles.filter((a) => a.published);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg2/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-xl font-bold tracking-tight text-gray-900 dark:text-dark-text">
              G<span className="text-accent">.</span>
            </Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <Link to="/dashboard" className="text-sm text-gray-400 dark:text-dark-muted hover:text-accent">Dashboard</Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">{t('drafts.title')}</span>
          </div>

          <button
            onClick={() => { navigate('/'); setTimeout(() => logout(), 10); }}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-red-500 transition-colors"
          >
            {t('dashboard.logout')}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Sidebar: article list */}
          <aside className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">
                {t('drafts.drafts')} ({drafts.length})
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-dark-bg3 animate-pulse" />)}
                </div>
              ) : drafts.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-dark-muted italic">{t('drafts.noDrafts')}</p>
              ) : (
                <div className="space-y-2">
                  {drafts.map((a) => (
                    <ArticleItem key={a._id} article={a} selected={selected?._id === a._id} onClick={() => { setSelected(a); setEditing(null); }} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
                {t('drafts.published')} ({published.length})
              </h2>
              {published.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-dark-muted italic">{t('drafts.noPublished')}</p>
              ) : (
                <div className="space-y-2">
                  {published.map((a) => (
                    <ArticleItem key={a._id} article={a} selected={selected?._id === a._id} onClick={() => { setSelected(a); setEditing(null); }} />
                  ))}
                </div>
              )}
            </section>
          </aside>

          {/* Main: preview / edit */}
          <section className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 min-h-[600px]">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-dark-muted text-sm">
                {t('drafts.selectToPreview')}
              </div>
            ) : editing ? (
              <EditMode
                article={editing}
                onChange={setEditing}
                onCancel={() => setEditing(null)}
                onSave={handleSaveEdit}
                saving={saving}
                t={t}
              />
            ) : (
              <PreviewMode
                article={selected}
                onEdit={() => setEditing({ ...selected })}
                onPublishToggle={() => handlePublishToggle(selected._id)}
                onDelete={() => handleDelete(selected._id)}
                saving={saving}
                t={t}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ArticleItem({ article, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? 'border-accent bg-accent/5'
          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-muted'
      }`}
    >
      <div className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{article.title}</div>
      <div className="text-xs text-gray-400 dark:text-dark-muted mt-1">
        {new Date(article.createdAt).toLocaleDateString()}
        {article.views ? ` — ${article.views} vues` : ''}
      </div>
    </button>
  );
}

function PreviewMode({ article, onEdit, onPublishToggle, onDelete, saving, t }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200 dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              article.published
                ? 'bg-accent/10 text-accent'
                : 'bg-gray-100 dark:bg-dark-bg3 text-gray-500 dark:text-dark-muted'
            }`}>
              {article.published ? t('drafts.live') : t('drafts.draft')}
            </span>
            {article.tags?.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-bg3 text-gray-500 dark:text-dark-muted">{tag}</span>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{article.title}</h1>
          {article.excerpt && <p className="mt-2 text-sm text-gray-600 dark:text-dark-muted">{article.excerpt}</p>}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEdit}
            disabled={saving}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-dark-border hover:border-accent rounded-lg font-medium text-gray-700 dark:text-dark-text hover:text-accent transition-all disabled:opacity-40"
          >
            {t('drafts.edit')}
          </button>
          <button
            onClick={onPublishToggle}
            disabled={saving}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all disabled:opacity-40 ${
              article.published
                ? 'border border-orange-500 text-orange-500 hover:bg-orange-500/10'
                : 'bg-accent hover:bg-accent-hover text-dark-bg'
            }`}
          >
            {article.published ? t('drafts.unpublish') : t('drafts.publish')}
          </button>
          <button
            onClick={onDelete}
            disabled={saving}
            className="px-3 py-1.5 text-sm border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg font-medium transition-all disabled:opacity-40"
          >
            {t('drafts.delete')}
          </button>
        </div>
      </div>

      <div className="prose-custom max-w-none">
        <Markdown>{article.content}</Markdown>
      </div>
    </div>
  );
}

function EditMode({ article, onChange, onCancel, onSave, saving, t }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-dark-text">{t('drafts.editing')}</h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-dark-border hover:border-gray-400 rounded-lg font-medium text-gray-700 dark:text-dark-text transition-all disabled:opacity-40"
          >
            {t('dashboard.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all disabled:opacity-40"
          >
            {saving ? '...' : t('dashboard.save')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted mb-1">Title</label>
          <input
            type="text"
            value={article.title}
            onChange={(e) => onChange({ ...article, title: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted mb-1">Excerpt</label>
          <input
            type="text"
            value={article.excerpt || ''}
            onChange={(e) => onChange({ ...article, excerpt: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted mb-1">Tags (comma separated)</label>
          <input
            type="text"
            value={(article.tags || []).join(', ')}
            onChange={(e) => onChange({ ...article, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted mb-1">Content (Markdown)</label>
          <textarea
            rows={20}
            value={article.content}
            onChange={(e) => onChange({ ...article, content: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>
      </div>
    </div>
  );
}
