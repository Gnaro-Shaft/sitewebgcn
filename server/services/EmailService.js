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

  const info = await transport.sendMail({
    from: `"${safeName}" <${safeEmail}>`,
    to: process.env.CONTACT_EMAIL || 'admin@gcn.dev',
    subject: `[Contact] ${safeSubject || 'Message from portfolio'}`,
    text: `From: ${name} (${email})\n\n${message}`,
    html: `
      <h3>New contact message</h3>
      <p><strong>From:</strong> ${safeName} (${safeEmail})</p>
      <p><strong>Subject:</strong> ${safeSubject || 'N/A'}</p>
      <hr>
      <p>${safeMessage}</p>
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
