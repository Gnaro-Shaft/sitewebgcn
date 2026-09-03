import { useState } from 'react';

// Composeur du post LinkedIn. Le texte est écrit ici, à la main : il n'est
// plus dérivé de l'article. Le champ commentaire est optionnel — laissé
// vide, le serveur y met l'URL canonique nue.
//
// Bornes alignées sur server/services/linkedinPost.js. Si elles changent
// là-bas, elles doivent changer ici : le serveur reste l'autorité, le
// compteur n'est qu'un confort de saisie.
const MAX_POST_CHARS = 2600;
const MIN_POST_CHARS = 50;
const MAX_COMMENT_CHARS = 1250;

export default function LinkedInComposer({ article, onCancel, onSubmit, saving, t }) {
  const [text, setText] = useState(article.socialPosted?.linkedin?.text || '');
  const [firstComment, setFirstComment] = useState(
    article.socialPosted?.linkedin?.firstComment || ''
  );

  const length = text.trim().length;
  const tooShort = length < MIN_POST_CHARS;
  const tooLong = length > MAX_POST_CHARS;
  const canSend = !saving && !tooShort && !tooLong;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-dark-text">
            {t('drafts.linkedin.title')}
          </h2>
          <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">{article.title}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-dark-border hover:border-gray-400 rounded-lg font-medium text-gray-700 dark:text-dark-text transition-all disabled:opacity-40"
          >
            {t('dashboard.cancel')}
          </button>
          <button
            onClick={() => onSubmit({ text: text.trim(), firstComment: firstComment.trim() })}
            disabled={!canSend}
            className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-40"
          >
            {saving ? '...' : t('drafts.linkedin.send')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label
              htmlFor="linkedin-text"
              className="block text-xs font-medium text-gray-500 dark:text-dark-muted"
            >
              {t('drafts.linkedin.textLabel')}
            </label>
            <span
              className={`text-xs tabular-nums ${
                tooLong
                  ? 'text-red-500 font-medium'
                  : tooShort
                    ? 'text-gray-400 dark:text-dark-muted'
                    : 'text-gray-500 dark:text-dark-muted'
              }`}
            >
              {length} / {MAX_POST_CHARS}
            </span>
          </div>
          <textarea
            id="linkedin-text"
            rows={16}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('drafts.linkedin.textPlaceholder')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          {tooShort && (
            <p className="mt-1 text-xs text-gray-400 dark:text-dark-muted">
              {t('drafts.linkedin.tooShort', { min: MIN_POST_CHARS })}
            </p>
          )}
          {tooLong && (
            <p className="mt-1 text-xs text-red-500">
              {t('drafts.linkedin.tooLong', { max: MAX_POST_CHARS })}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="linkedin-comment"
            className="block text-xs font-medium text-gray-500 dark:text-dark-muted mb-1"
          >
            {t('drafts.linkedin.commentLabel')}
          </label>
          <input
            id="linkedin-comment"
            type="text"
            maxLength={MAX_COMMENT_CHARS}
            value={firstComment}
            onChange={(e) => setFirstComment(e.target.value)}
            placeholder={t('drafts.linkedin.commentPlaceholder')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-dark-muted">
            {t('drafts.linkedin.commentHelp')}
          </p>
        </div>
      </div>
    </div>
  );
}
