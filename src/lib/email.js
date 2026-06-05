import nodemailer from 'nodemailer';

export async function sendVerificationEmail(toEmail, verificationLink) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: parseInt(port) === 465,
        auth: {
          user,
          pass,
        },
      });

      const dashboardLink = `http://localhost:3000/api/soba/verify-callback?email=${encodeURIComponent(toEmail)}`;

      const info = await transporter.sendMail({
        from: `"${process.env.SMTP_SENDER_NAME || 'SOBA Vault Security'}" <${user}>`,
        to: toEmail,
        subject: "Action Required: Verify your FaceID for SOBA Secure Vault and Access the Dashboard",
        text: `Please verify your FaceID using the following link: ${verificationLink}\n\nDashboard Link: ${dashboardLink}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #8250df; margin-bottom: 20px;">SOBA Secure Vault Verification</h2>
            <p>You have been allocated access to the secure vault.</p>
            <p>To authorize this email, please click the button below to verify your identity with FaceID:</p>
            <a href="${verificationLink}" target="_blank" style="display: inline-block; padding: 12px 24px; color: #fff; background-color: #8250df; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Verify FaceID</a>
            <br/>
            <a href="${dashboardLink}" target="_blank" style="display: inline-block; padding: 12px 24px; color: #fff; background-color: #2da44e; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0;">dashboard link</a>
            <p style="font-size: 12px; color: #8c9ba5;">
              If the link does not work, copy and paste this URL into your browser:<br/>
              <a href="${verificationLink}">${verificationLink}</a>
            </p>
          </div>
        `,
      });
      console.log(`[SMTP] Verification email sent to ${toEmail}. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('[SMTP] Failed to send email via SMTP:', error);
      throw error;
    }
  } else {
    const dashboardLink = `http://localhost:3000/api/soba/verify-callback?email=${encodeURIComponent(toEmail)}`;
    console.log(`[MOCK EMAIL] To: ${toEmail} | Link: ${verificationLink} | Dashboard Link: ${dashboardLink}`);
    return { success: true, mock: true };
  }
}
