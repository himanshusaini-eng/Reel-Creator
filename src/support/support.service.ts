import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { join } from "path";
import { DATA } from "../paths";
import { readJson, writeJson } from "../common/json-file";
import { cleanEmail, clip } from "../common/validate";
import { EmailService } from "../email/email.service";

export type Ticket = {
  id: string;
  kind: "contact" | "bug" | "feature" | "newsletter" | "early_access";
  name: string;
  email: string;
  topic: string;
  message: string;
  userId: string | null;
  createdAt: string;
};

@Injectable()
export class SupportService {
  private readonly file = join(DATA, "support.json");
  private tickets: Ticket[] = [];

  constructor(private readonly email: EmailService) {
    this.tickets = readJson<{ tickets: Ticket[] }>(this.file, { tickets: [] }).tickets || [];
  }

  private save() {
    writeJson(this.file, { tickets: this.tickets.slice(-2000) });
  }

  submit(input: {
    kind: Ticket["kind"];
    name?: string;
    email?: string;
    topic?: string;
    message?: string;
    company?: string;
    userId?: string | null;
  }) {
    if (clip(input.company, 80)) return { ok: true };
    const email = cleanEmail(input.email);
    const name = clip(input.name, 80) || "there";
    const topic = clip(input.topic, 80) || input.kind;
    const message = clip(input.message, 5000);
    if (input.kind !== "newsletter" && input.kind !== "early_access" && message.length < 8) {
      throw new Error("Tell us a little more so we can help.");
    }
    const ticket: Ticket = {
      id: randomUUID(),
      kind: input.kind,
      name,
      email,
      topic,
      message,
      userId: input.userId || null,
      createdAt: new Date().toISOString(),
    };
    this.tickets.push(ticket);
    this.save();

    if (input.kind === "newsletter") this.email.send(this.email.templates.newsletter({ to: email }));
    else if (input.kind === "early_access") this.email.send(this.email.templates.earlyAccess({ to: email }));
    else this.email.send(this.email.templates.supportAck({ to: email, name, topic }));

    this.email.notifySupport(`[${ticket.kind}] ${topic}`, `${name} <${email}>\n${message || "(no message)"}`);
    return { ok: true };
  }
}
