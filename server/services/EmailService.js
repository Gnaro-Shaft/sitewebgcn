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

module.exports = { sendContactEmail };
