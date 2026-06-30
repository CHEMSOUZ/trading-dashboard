const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendResetCode(toEmail, code) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Trading Dashboard" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Réinitialisation de votre mot de passe',
    text: `Votre code de réinitialisation : ${code}\n\nCe code est valable 15 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
    html: `
      <div style="font-family:'JetBrains Mono',monospace;background:#090a10;color:#e8edf8;padding:36px;border-radius:12px;max-width:420px;margin:auto;">
        <div style="color:#00cc77;font-size:16px;font-weight:800;letter-spacing:2px;margin-bottom:6px;">TRADING DASHBOARD</div>
        <div style="color:#5a6a82;font-size:11px;letter-spacing:1.5px;margin-bottom:28px;">RÉINITIALISATION DU MOT DE PASSE</div>
        <div style="color:#9aa5bb;font-size:13px;margin-bottom:20px;">Voici votre code à 6 chiffres :</div>
        <div style="background:rgba(0,204,119,0.08);border:1px solid rgba(0,204,119,0.30);border-radius:10px;padding:24px;text-align:center;font-size:36px;font-weight:800;color:#00cc77;letter-spacing:10px;">${code}</div>
        <div style="color:#5a6a82;font-size:11px;margin-top:20px;line-height:1.6;">Ce code expire dans <strong style="color:#9aa5bb;">15 minutes</strong>.<br>Si vous n'avez pas fait cette demande, ignorez cet email.</div>
      </div>
    `,
  });
}

module.exports = { sendResetCode };
