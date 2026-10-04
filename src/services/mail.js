import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transporter = config.gmailUser && config.gmailPass
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.gmailUser, pass: config.gmailPass },
    })
  : null;

export async function sendResetEmail(to, name, link) {
  if (!transporter) {
    console.log(`[mail] Gmail not configured. Reset link for ${to}: ${link}`);
    return;
  }
  await transporter.sendMail({
    from: config.mailFrom,
    to,
    subject: 'Reset your APEX FM password',
    text: `Hi ${name || 'manager'}, open this link to reset your password. It works once and expires in 30 minutes: ${link}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#07111F;color:#ffffff;border-radius:12px">
        <h2 style="margin:0 0 12px;color:#E2B657">APEX FM</h2>
        <p>Hi ${name || 'manager'},</p>
        <p>We received a request to reset your password. This link works once and expires in 30 minutes.</p>
        <p style="margin:24px 0"><a href="${link}" style="background:#E2B657;color:#07111F;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Reset password</a></p>
        <p style="font-size:12px;color:#94a3b8">If you did not ask for this, ignore this email. Your password stays the same.</p>
      </div>`,
  });
}