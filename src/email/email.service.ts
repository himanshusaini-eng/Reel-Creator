import { Injectable, OnModuleInit } from "@nestjs/common";
import { join } from "path";
import { DATA } from "../paths";
import { readJson, writeJson } from "../common/json-file";
import { redact } from "../common/redact";
import { emailTemplates, type EmailMessage } from "./email.templates";

type Outbox = { messages: EmailMessage[] };

@Injectable()
export class EmailService implements OnModuleInit {
  readonly templates = emailTemplates;
  private readonly file = join(DATA, "outbox.json");

  onModuleInit() {
    const webhook = process.env.EMAIL_WEBHOOK_URL;
    if (!webhook && process.env.NODE_ENV === "production") {
      console.warn("[email] No EMAIL_WEBHOOK_URL set. Messages are stored locally until a provider is connected.");
    }
  }

  send(message: EmailMessage) {
    try {
      const to = message.to.replace(/(^.).*(@.*$)/, "$1***$2");
      console.log(`[email] ${message.template} → ${to}`);
      if (process.env.EMAIL_OUTBOX !== "0") this.enqueue(message);
      const webhook = process.env.EMAIL_WEBHOOK_URL;
      if (webhook) {
        void fetch(webhook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.EMAIL_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_SECRET}` } : {}),
          },
          body: JSON.stringify(message),
        }).catch((error) => console.error("[email]", redact(error)));
      }
    } catch (error) {
      console.error("[email]", redact(error));
    }
  }

  /** Operator copy of a support request. */
  notifySupport(subject: string, text: string) {
    const to = process.env.SUPPORT_EMAIL || "hello@reelcreator.app";
    this.send({
      template: "support_inbox",
      to,
      subject,
      text,
      html: `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] || c)}</pre>`,
    });
  }

  private enqueue(message: EmailMessage) {
    const outbox = readJson<Outbox>(this.file, { messages: [] });
    outbox.messages = [...outbox.messages, { ...message, html: message.html }].slice(-200);
    writeJson(this.file, outbox);
  }
}
