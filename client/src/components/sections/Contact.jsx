import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import useInView from '../../hooks/useInView';

export default function Contact() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ref, inView] = useInView();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      await api.post('/contact', form);
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg2 text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-accent transition-colors";

  return (
    <div ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-text mb-8 text-center">
        {t('contact.title')}
      </h2>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input type="text" name="name" value={form.name} onChange={handleChange} placeholder={t('contact.name')} required className={inputClass} />
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('contact.email')} required className={inputClass} />
        </div>
        <input type="text" name="subject" value={form.subject} onChange={handleChange} placeholder={t('contact.subject')} className={inputClass} />
        <textarea name="message" value={form.message} onChange={handleChange} placeholder={t('contact.message')} required rows={5} className={`${inputClass} resize-none`} />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-bg rounded-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
        >
          {loading ? t('contact.sending') : t('contact.send')}
        </button>

        {status === 'success' && (
          <p className="text-accent text-sm text-center">{t('contact.success')}</p>
        )}
        {status === 'error' && (
          <p className="text-red-500 text-sm text-center">{t('contact.error')}</p>
        )}
      </form>
    </div>
  );
}
