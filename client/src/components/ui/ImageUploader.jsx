import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

// Drag-drop / file-picker image uploader.
// - Sends multipart to POST /api/upload/image (auth handled by axios interceptor)
// - On success: calls onChange(cloudinaryUrl)
// - Also accepts a manual external URL as fallback
// - Shows preview of current value (whether uploaded or external)
export default function ImageUploader({ value, onChange, folder = 'projects' }) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const upload = async (file) => {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (folder) formData.append('folder', folder);
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.data.url);
    } catch (err) {
      const code = err.response?.data?.error;
      const map = {
        TOO_LARGE: t('admin.upload.tooLarge'),
        INVALID_TYPE: t('admin.upload.invalidType'),
        NO_FILE: t('admin.upload.error'),
        UPLOAD_NOT_CONFIGURED: t('admin.upload.notConfigured'),
        CLOUDINARY_FAILED: t('admin.upload.error'),
      };
      setError(map[code] || t('admin.upload.error'));
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files) => {
    if (files && files[0]) upload(files[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-gray-300 dark:border-dark-border hover:border-accent-border'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-dark-muted">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {t('admin.upload.uploading')}
          </div>
        ) : value ? (
          <div className="space-y-2">
            <img
              src={value}
              alt={t('admin.upload.preview')}
              className="mx-auto max-h-48 rounded-lg object-contain"
            />
            <p className="text-xs text-gray-500 dark:text-dark-muted">
              {t('admin.upload.dragToReplace')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-gray-700 dark:text-dark-text font-medium">
              {t('admin.upload.dragHere')}
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-muted">
              {t('admin.upload.choose')}
            </p>
            <p className="text-xs text-gray-400 dark:text-dark-muted/70 mt-2">
              PNG, JPG, WebP, GIF · max 5 MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs text-gray-500 dark:text-dark-muted hover:text-red-500 transition-colors"
        >
          {t('admin.upload.remove')}
        </button>
      )}

      <div>
        <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">
          {t('admin.upload.externalUrl')}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… ou /images/…"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-dark-bg2 border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-dark-text focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
