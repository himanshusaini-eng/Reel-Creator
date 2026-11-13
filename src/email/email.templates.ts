export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  template: string;
};

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#000;color:#f5f6f8;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 18px;font-weight:700">reelcreator</p>
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.03em">${title}</h1>
    <div style="color:#c8c8d0;font-size:15px;line-height:1.6">${body}</div>
    <p style="color:#6e6e78;font-size:12px;margin-top:28px">Reel Creator · <a href="mailto:hello@reelcreator.app" style="color:#c4baff">hello@reelcreator.app</a></p>
  </div></body></html>`;
}

function message(template: string, to: string, subject: string, text: string, htmlBody: string): EmailMessage {
  return { template, to, subject, text, html: layout(esc(subject), htmlBody) };
}

function button(href: string, label: string) {
  const safe = esc(href);
  return `<p><a href="${safe}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:999px">${esc(label)}</a></p>`;
}

export const emailTemplates = {
  welcome(input: { to: string; name: string; verifyUrl: string }) {
    const name = esc(input.name);
    return message(
      "welcome",
      input.to,
      "Welcome to Reel Creator",
      `Hi ${input.name},\n\nYour studio is ready. Confirm your email: ${input.verifyUrl}\n`,
      `<p>Hi ${name},</p><p>Your studio is ready. Projects stay private to your account.</p>${button(input.verifyUrl, "Confirm email")}`,
    );
  },
  verifyEmail(input: { to: string; name: string; verifyUrl: string }) {
    return message(
      "verify_email",
      input.to,
      "Confirm your email",
      `Confirm your email: ${input.verifyUrl}\n`,
      `<p>Hi ${esc(input.name)},</p><p>Confirm this address so we can reach you about your account.</p>${button(input.verifyUrl, "Confirm email")}`,
    );
  },
  resetPassword(input: { to: string; name: string; resetUrl: string }) {
    return message(
      "reset_password",
      input.to,
      "Reset your Reel Creator password",
      `Reset your password (expires in 1 hour): ${input.resetUrl}\nIf you didn’t ask for this, you can ignore the email.\n`,
      `<p>Hi ${esc(input.name)},</p><p>This link expires in one hour. If you didn’t ask for a reset, ignore this email.</p>${button(input.resetUrl, "Reset password")}`,
    );
  },
  subscriptionConfirmed(input: { to: string; name: string; plan: string; interval: string }) {
    return message(
      "subscription_confirmed",
      input.to,
      `You’re on ${input.plan}`,
      `Hi ${input.name},\nYour ${input.plan} plan (${input.interval}) is active.\n`,
      `<p>Hi ${esc(input.name)},</p><p>Your <strong>${esc(input.plan)}</strong> plan is active, billed ${esc(input.interval)}.</p>`,
    );
  },
  subscriptionCanceled(input: { to: string; name: string; plan: string; until: string }) {
    const until = new Date(input.until).toUTCString();
    return message(
      "subscription_canceled",
      input.to,
      "Your subscription will end",
      `Hi ${input.name},\n${input.plan} stays active until ${until}. You can resume before then.\n`,
      `<p>Hi ${esc(input.name)},</p><p>${esc(input.plan)} stays active until ${esc(until)}. You can resume it from billing before then.</p>`,
    );
  },
  invoice(input: { to: string; name: string; number: string; amountCents: number; description: string }) {
    const amount = `$${(input.amountCents / 100).toFixed(2)}`;
    return message(
      "invoice",
      input.to,
      `Invoice ${input.number}`,
      `Invoice ${input.number} for ${amount}. ${input.description}\n`,
      `<p>Hi ${esc(input.name)},</p><p>Invoice <strong>${esc(input.number)}</strong> · ${esc(amount)}</p><p>${esc(input.description)}</p>`,
    );
  },
  exportComplete(input: { to: string; name: string; project: string; url: string }) {
    const link = input.url.startsWith("http") ? button(input.url, "Download MP4") : "<p>Open the studio and download it from the project.</p>";
    return message(
      "export_complete",
      input.to,
      "Your reel is ready",
      `Hi ${input.name},\n“${input.project}” has finished exporting.\n${input.url}\n`,
      `<p>Hi ${esc(input.name)},</p><p>“${esc(input.project)}” has finished exporting.</p>${link}`,
    );
  },
  teamInvite(input: { to: string; name: string; studio: string; inviteUrl: string }) {
    return message(
      "team_invite",
      input.to,
      `${input.studio} invited you to Reel Creator`,
      `${input.name} invited you to ${input.studio}: ${input.inviteUrl}\n`,
      `<p>${esc(input.name)} invited you to <strong>${esc(input.studio)}</strong>.</p>${button(input.inviteUrl, "View invite")}`,
    );
  },
  earlyAccess(input: { to: string }) {
    return message(
      "early_access",
      input.to,
      "You’re on the Reel Creator list",
      "Thanks for raising your hand. We’ll write when there’s something worth your time.\n",
      `<p>Thanks for raising your hand. We’ll write when there’s something worth your time.</p>`,
    );
  },
  newsletter(input: { to: string }) {
    return message(
      "newsletter",
      input.to,
      "Reel Creator notes",
      "You’re subscribed to occasional product notes. Reply to this email if you want off the list.\n",
      `<p>You’re subscribed to occasional product notes. Reply if you want off the list.</p>`,
    );
  },
  supportAck(input: { to: string; name: string; topic: string }) {
    return message(
      "support_ack",
      input.to,
      "We got your message",
      `Hi ${input.name},\nThanks for writing about ${input.topic}. We’ll reply at this address.\n`,
      `<p>Hi ${esc(input.name)},</p><p>Thanks for writing about ${esc(input.topic)}. We’ll reply at this address.</p>`,
    );
  },
};
