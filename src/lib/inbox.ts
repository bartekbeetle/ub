import "server-only";
import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * Skrzynka odbiorcza `biuro@` w panelu admina (01.10.2026).
 *
 * Po co: automaty wychodzą ze `szkolenia@`, ale Reply-To wszystkich maili do kursantek
 * wskazuje `biuro@` (patrz `replyToAddress` w `./email`). Do 01.10 tej skrzynki nikt nie
 * czytał — kursantka (Zosia, 28.09) pytała przez formularz, czy doszła jej aplikacja,
 * bo na maila nie miała komu odpisać. Teraz odpowiedzi i wycofania zgód RODO widać tam,
 * gdzie i tak siedzi obsługa leadów.
 *
 * Zakres celowo minimalny: lista, podgląd, odpowiedź. Foldery, załączniki i wyszukiwanie
 * czekają, aż poczty będzie tyle, że lista 50 ostatnich przestanie wystarczać.
 *
 * Bezpieczeństwo:
 *  - pokazujemy WYŁĄCZNIE tekst. HTML z cudzego maila nigdy nie trafia do DOM panelu
 *    (XSS w panelu, który widzi dane wszystkich kursantek). Mail tylko-HTML jest
 *    sprowadzany do tekstu przez mailparser (`textAsHtml` nie używamy).
 *  - czytanie NIE oznacza wiadomości jako przeczytanej (`BODY.PEEK` przez `fetchOne` z
 *    `source` + flaga ustawiana świadomie dopiero przy odpowiedzi) — skrzynkę może równolegle
 *    czytać człowiek w programie pocztowym i nie wolno mu podbierać stanu „nowe".
 */

export type InboxFolder = "odebrane" | "wyslane";

export type InboxListItem = {
  uid: number;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  date: Date | null;
  seen: boolean;
  answered: boolean;
};

export type InboxMessage = InboxListItem & {
  text: string;
  messageId: string | null;
  references: string[];
  attachments: { filename: string; size: number }[];
};

/** Host z panelu LH (Serwery → Konta e-mail → „Jakie są adresy serwerów pocztowych?"). */
const DEFAULT_IMAP_HOST = "mail-serwer227270.lh.pl";

export function inboxAddress(): string {
  return process.env.INBOX_USER || "biuro@uniwersytetbeauty.pl";
}

export function inboxConfigured(): boolean {
  return Boolean(process.env.INBOX_USER && process.env.INBOX_PASS);
}

function client(): ImapFlow {
  return new ImapFlow({
    host: process.env.INBOX_IMAP_HOST || DEFAULT_IMAP_HOST,
    port: Number(process.env.INBOX_IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.INBOX_USER!, pass: process.env.INBOX_PASS! },
    logger: false,
    // Wolny serwer pocztowy nie może zawiesić renderu panelu.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

async function withClient<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = client();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.logout().catch(() => c.close());
  }
}

/** Ścieżka folderu „Wysłane" — po fladze special-use, a gdy serwer jej nie ma, po nazwie. */
async function sentPath(c: ImapFlow): Promise<string | null> {
  const list = await c.list();
  const bySpecial = list.find((m) => m.specialUse === "\\Sent");
  if (bySpecial) return bySpecial.path;
  const byName = list.find((m) => /^(inbox[./])?(sent|wys[lł]ane|sent items|sent messages)$/i.test(m.path));
  return byName?.path ?? null;
}

async function folderPath(c: ImapFlow, folder: InboxFolder): Promise<string | null> {
  return folder === "wyslane" ? sentPath(c) : "INBOX";
}

function toItem(m: FetchMessageObject, folder: InboxFolder): InboxListItem {
  const env = m.envelope;
  const fromAddr = env?.from?.[0];
  const toAddr = env?.to?.[0];
  return {
    uid: m.uid,
    // W „Wysłanych" interesuje nas adresat, nie my sami — lista ma pokazywać, z kim rozmawiamy.
    from: (folder === "wyslane" ? toAddr?.address : fromAddr?.address) ?? "",
    fromName: (folder === "wyslane" ? toAddr?.name : fromAddr?.name) ?? "",
    to: toAddr?.address ?? "",
    subject: env?.subject || "(bez tematu)",
    date: env?.date ? new Date(env.date) : (m.internalDate ? new Date(m.internalDate) : null),
    seen: m.flags?.has("\\Seen") ?? false,
    answered: m.flags?.has("\\Answered") ?? false,
  };
}

/** Ostatnie `limit` wiadomości z folderu, najnowsze pierwsze. Same koperty, bez treści. */
export async function listInbox(folder: InboxFolder = "odebrane", limit = 50): Promise<InboxListItem[]> {
  return withClient(async (c) => {
    const path = await folderPath(c, folder);
    if (!path) return [];
    const lock = await c.getMailboxLock(path, { readOnly: true });
    try {
      const mailbox = c.mailbox;
      const total = mailbox ? mailbox.exists : 0;
      if (!total) return [];
      const start = Math.max(1, total - limit + 1);
      const items: InboxListItem[] = [];
      for await (const m of c.fetch(`${start}:*`, { uid: true, envelope: true, flags: true, internalDate: true })) {
        items.push(toItem(m, folder));
      }
      return items.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    } finally {
      lock.release();
    }
  });
}

/** Jedna wiadomość z treścią tekstową. `null`, gdy UID nie istnieje. Nie zmienia flag. */
export async function getInboxMessage(folder: InboxFolder, uid: number): Promise<InboxMessage | null> {
  return withClient(async (c) => {
    const path = await folderPath(c, folder);
    if (!path) return null;
    const lock = await c.getMailboxLock(path, { readOnly: true });
    try {
      const m = await c.fetchOne(
        String(uid),
        { uid: true, envelope: true, flags: true, internalDate: true, source: true },
        { uid: true }
      );
      if (!m || !m.source) return null;
      const parsed = await simpleParser(m.source);
      const refs = parsed.references;
      return {
        ...toItem(m, folder),
        // `parsed.text` istnieje także dla maili tylko-HTML (mailparser konwertuje).
        text: (parsed.text ?? "").trim() || "(wiadomość bez treści tekstowej)",
        messageId: parsed.messageId ?? null,
        references: Array.isArray(refs) ? refs : refs ? [refs] : [],
        attachments: parsed.attachments.map((a) => ({ filename: a.filename || "załącznik", size: a.size })),
      };
    } finally {
      lock.release();
    }
  });
}

/**
 * Wysyła maila z `biuro@` (odpowiedź albo nową wiadomość) i odkłada kopię do „Wysłanych".
 *
 * Logowanie do SMTP kontem `biuro@`, nie `szkolenia@`: LH odrzuca nadawcę różnego od
 * zalogowanego konta, a odpowiedź z adresu automatu wyglądałaby na kolejny automat.
 * Host SMTP potwierdzony z VPS 19.09 (`mail16.lh.pl:587`, STARTTLS).
 */
export async function sendFromInbox(params: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
  /** UID oryginału w INBOX — po wysłaniu dostaje flagę \Answered. */
  answeredUid?: number;
}): Promise<void> {
  const nodemailer = (await import("nodemailer")).default;
  const MailComposer = (await import("nodemailer/lib/mail-composer")).default;
  const port = Number(process.env.INBOX_SMTP_PORT || process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.INBOX_SMTP_HOST || process.env.SMTP_HOST || "mail16.lh.pl",
    port,
    secure: port === 465,
    auth: { user: process.env.INBOX_USER, pass: process.env.INBOX_PASS },
  });

  const address = inboxAddress();
  const mail = {
    from: { name: "Uniwersytet Beauty", address },
    to: params.to,
    subject: params.subject,
    text: params.text,
    inReplyTo: params.inReplyTo ?? undefined,
    references: params.references?.length ? params.references : undefined,
  };
  await transport.sendMail(mail);

  // Kopia w „Wysłanych" i flaga \Answered — po to, żeby człowiek czytający skrzynkę
  // w programie pocztowym widział, że ktoś już odpisał. Błąd tutaj nie cofa wysyłki.
  try {
    const raw = await new MailComposer(mail).compile().build();
    await withClient(async (c) => {
      const sent = await sentPath(c);
      if (sent) await c.append(sent, raw, ["\\Seen"]);
      if (params.answeredUid) {
        const lock = await c.getMailboxLock("INBOX");
        try {
          await c.messageFlagsAdd(String(params.answeredUid), ["\\Answered", "\\Seen"], { uid: true });
        } finally {
          lock.release();
        }
      }
    });
  } catch (err) {
    console.error("[inbox] Wysłane, ale nie udało się odłożyć kopii / flagi:", err);
  }
}

/** „Re: " bez piętrzenia „Re: Re: Re:". */
export function replySubject(subject: string): string {
  return /^\s*(re|odp)\s*:/i.test(subject) ? subject : `Re: ${subject}`;
}

/** Cytat oryginału pod odpowiedzią — klasyczny format, który rozumie każdy klient poczty. */
export function quoteOriginal(msg: Pick<InboxMessage, "text" | "date" | "fromName" | "from">): string {
  const who = msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from;
  const when = msg.date ? msg.date.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }) : "";
  const quoted = msg.text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return `\n\n${when ? `${when}, ` : ""}${who} napisał(a):\n${quoted}`;
}
