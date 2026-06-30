import nodemailer from "nodemailer";

/**
 * Send the report over SMTP. Two modes, same code:
 *   - DEFAULT: self-hosted Mailpit in-cluster (no auth) — captures the mail in its web inbox,
 *     does NOT deliver to real addresses (it's a sink, no third party).
 *   - REAL DELIVERY (e.g. to a Gmail inbox): point MAIL_HOST/PORT at an SMTP relay you
 *     authenticate to (a provider, or your own mail account) and set MAIL_USER/MAIL_PASS.
 *     There is no way to reach an external inbox like Gmail without such a relay.
 *
 * Env: MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS (optional → relay), MAIL_SECURE, MAIL_FROM, REPORT_TO.
 */
export interface MailInput {
  subject: string;
  html: string;
}

export async function sendReport({ subject, html }: MailInput): Promise<string> {
  const host = process.env.MAIL_HOST ?? "mailpit.research-desk.svc.cluster.local";
  const port = Number(process.env.MAIL_PORT ?? 1025);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const from = process.env.MAIL_FROM ?? "OpenShell Research Desk <research-desk@openshell.local>";
  const to = process.env.REPORT_TO ?? "you@openshell.local";
  const secure = process.env.MAIL_SECURE === "true" || port === 465;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    ignoreTLS: !user, // Mailpit has no TLS; a relay (with creds) uses STARTTLS/TLS
  });
  const info = await transport.sendMail({ from, to, subject, html });
  return info.messageId;
}
