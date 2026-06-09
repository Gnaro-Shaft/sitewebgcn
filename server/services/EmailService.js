const nodemailer = require('nodemailer');

let transporter = null;

// Escape HTML to prevent XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('Email: using Ethereal test account:', testAccount.user);
    }
  }

  return transporter;
}

async function sendContactEmail({ name, email, subject, message }) {
  const transport = await getTransporter();

  // Sanitize all user inputs
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

  // From: must be the authenticated SMTP account (Gmail rejects spoofing).
  // We put the visitor's email in Reply-To so "Reply" goes back to them.
  const fromName = process.env.SMTP_FROM_NAME || 'Portfolio Contact';
  const fromAddress = process.env.SMTP_USER || process.env.CONTACT_EMAIL || 'no-reply@gcn-data.fr';

  const info = await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: process.env.CONTACT_EMAIL || fromAddress,
    replyTo: `"${safeName}" <${email}>`,
    subject: `[Contact] ${safeSubject || `Message de ${name}`}`,
    text: `De : ${name} (${email})\n\n${message}\n\n---\nRepondre a : ${email}`,
    html: `
      <h3>Nouveau message du formulaire de contact</h3>
      <p><strong>De :</strong> ${safeName} &lt;${safeEmail}&gt;</p>
      <p><strong>Sujet :</strong> ${safeSubject || 'N/A'}</p>
      <hr>
      <p>${safeMessage}</p>
      <hr>
      <p style="color:#888;font-size:12px;">Repondez directement a cet email — la reponse partira vers ${safeEmail}.</p>
    `,
  });

  // Preview URL only in dev
  let previewUrl = null;
  if (process.env.NODE_ENV !== 'production') {
    previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('Email preview:', previewUrl);
    }
  }

  return { messageId: info.messageId, previewUrl };
}

// Notify admin that a weekly auto-draft has been generated and is waiting
// for review. Same SMTP transport, but sender = admin to themselves.
async function sendDraftNotification({ article, activitySummary }) {
  const transport = await getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'Portfolio Bot';
  const fromAddress = process.env.SMTP_USER || 'no-reply@gcn-data.fr';
  const adminEmail = process.env.CONTACT_EMAIL || fromAddress;
  const siteUrl = process.env.SITE_URL || 'https://gcn-data.fr';

  const draftUrl = `${siteUrl}/admin/drafts`;
  const safeTitle = escapeHtml(article.title || 'Brouillon');
  const safeExcerpt = escapeHtml(article.excerpt || '');
  const tagsLine = (article.tags || []).map((t) => `<span style="background:#00ff8820;color:#00ff88;padding:2px 6px;border-radius:4px;margin-right:4px;font-size:12px;">${escapeHtml(t)}</span>`).join('');
  const commits = activitySummary?.commitsAnalyzed ?? 0;
  const repos = activitySummary?.reposTouched?.join(', ') || '';

  const info = await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: adminEmail,
    subject: `[Blog AI] Nouveau brouillon : ${article.title}`,
    text: `Un brouillon hebdomadaire a ete genere :\n\n${article.title}\n\n${article.excerpt || ''}\n\nValide / edite / publie ici : ${draftUrl}\n\n(Genere a partir de ${commits} commits sur les repos : ${repos})`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:600px;">
        <h2 style="color:#0a0a0a;">Nouveau brouillon hebdomadaire</h2>
        <p style="color:#666;">Claude a analyse ton activite des 7 derniers jours et propose ce sujet :</p>
        <div style="background:#f5f5f5;border-left:3px solid #00ff88;padding:16px;margin:16px 0;">
          <h3 style="margin:0 0 8px;color:#0a0a0a;">${safeTitle}</h3>
          ${safeExcerpt ? `<p style="margin:0 0 12px;color:#555;">${safeExcerpt}</p>` : ''}
          <div>${tagsLine}</div>
        </div>
        <p style="color:#888;font-size:13px;">Genere a partir de <strong>${commits} commits</strong> sur les repos : ${escapeHtml(repos)}.</p>
        <p style="margin-top:24px;">
          <a href="${draftUrl}" style="display:inline-block;background:#00ff88;color:#0a0a0a;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Reviser le brouillon →
          </a>
        </p>
        <p style="color:#aaa;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
          Si tu ne veux pas le publier, ignore simplement cet email. Le brouillon reste en attente jusqu'a ce que tu agisses.
        </p>
      </div>
    `,
  });

  return { messageId: info.messageId };
}

module.exports = { sendContactEmail, sendDraftNotification };
