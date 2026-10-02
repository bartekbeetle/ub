/**
 * Test przypomnienia „dokończ aplikację" na PGlite w pamięci — BEZ sieci, BEZ SMTP, BEZ ./.pglite.
 * Migracje lecą z ./drizzle jak na produkcji. Kolejkowanie podmienione na zapis do `email_queue`.
 *
 * Sprawdza: okno 2 h – 7 dni, wymóg zgody na kontakt, wykluczenie dokończonych / adresów z leadem /
 * wypisanych, max jedno przypomnienie na adres (UNIQUE + ponowne uruchomienie), dedup wielu sesji,
 * kill-switch (flaga wyłączona = zero w kolejce), brak „0 zł" / „za darmo" w treści,
 * wznowienie po tokenie (ważność, dokończona).
 *
 * Użycie: npm run test:porzucone
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import {
  buildReminderMessage,
  isMailerEnabled,
  loadResumeByToken,
  reminderStatusByEmail,
  runAbandonedMailerCore,
  type EnqueueFn,
} from "../src/lib/abandoned-core";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "BLAD"}  ${label}${ok ? "" : ` — oczekiwano ${JSON.stringify(expected)}, jest ${JSON.stringify(actual)}`}`);
}

const H = 3600_000;
const D = 24 * H;

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });

  const now = new Date("2026-10-10T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  let n = 0;
  async function session(o: Partial<typeof schema.quizSessions.$inferInsert> & { age: number }) {
    n++;
    const { age, ...rest } = o;
    const [row] = await db
      .insert(schema.quizSessions)
      .values({
        sessionKey: `klucz-testowy-${n}-${Math.random().toString(36).slice(2)}`,
        name: "Anna Kowalska",
        email: `anna${n}@example.com`,
        category: "Makijaż permanentny",
        contactConsentAt: ago(age),
        completed: false,
        createdAt: ago(age),
        updatedAt: ago(age),
        ...rest,
      })
      .returning();
    return row;
  }

  // --- stan wejściowy ---
  const wOknie = await session({ age: 5 * H, email: "okno@example.com" });
  await session({ age: 1 * H, email: "za-swieza@example.com" });
  await session({ age: 8 * D, email: "za-stara@example.com" });
  await session({ age: 5 * H, email: "bez-zgody@example.com", contactConsentAt: null });
  await session({ age: 5 * H, email: "dokonczona@example.com", completed: true });
  await session({ age: 5 * H, email: null });
  await session({ age: 5 * H, email: "krzywy-adres" });
  // adres z dokończoną sesją gdzie indziej
  await session({ age: 6 * H, email: "inna-dokonczona@example.com" });
  await session({ age: 30 * D, email: "inna-dokonczona@example.com", completed: true });
  // adres z leadem
  await session({ age: 6 * H, email: "Ma-Lead@Example.com" });
  await db.insert(schema.leads).values({
    name: "Ma Lead", phone: "500500500", email: "ma-lead@example.com", voivodeship: "mazowieckie",
    category: "Brwi", employmentStatus: "pracuje", rodoConsentAt: now,
  });
  // wypisana
  await session({ age: 6 * H, email: "wypisana@example.com" });
  await db.insert(schema.marketingSuppression).values({ email: "wypisana@example.com", token: "t".repeat(64), optOutAt: now });
  // wiele sesji tego samego adresu (różna wielkość liter) -> jedna wiadomość
  await session({ age: 20 * H, email: "wiele@example.com" });
  const najnowsza = await session({ age: 4 * H, email: "WIELE@example.com " });

  const unsubTokens = new Map<string, string>();
  let enqueued: { to: string; subject: string; body: string; headers: Record<string, string> }[] = [];
  const enqueue: EnqueueFn = async (m) => {
    enqueued.push(m);
    const [q] = await db
      .insert(schema.emailQueue)
      .values({ toEmail: m.to, subject: m.subject, body: m.body, kind: "porzucona_aplikacja", headers: m.headers })
      .returning();
    return { queueId: q.id };
  };
  const deps = {
    now,
    siteUrl: "https://uniwersytetbeauty.pl",
    enqueue,
    unsubscribeToken: async (email: string) => {
      if (!unsubTokens.has(email)) unsubTokens.set(email, `unsub${unsubTokens.size}`.padEnd(64, "x"));
      return unsubTokens.get(email)!;
    },
  };

  // --- 1. flaga wyłączona = nic ---
  const off = await runAbandonedMailerCore(db, { ...deps, enabled: false });
  check("flaga wyłączona: nic w kolejce", [off.enabled, off.queued, enqueued.length], [false, 0, 0]);
  check("flaga: domyślnie włączona", isMailerEnabled({}), true);
  check("flaga: ABANDONED_MAILER_ENABLED=false wyłącza", isMailerEnabled({ ABANDONED_MAILER_ENABLED: "false" }), false);
  check("flaga: =0 wyłącza", isMailerEnabled({ ABANDONED_MAILER_ENABLED: "0" }), false);
  const rejestrPusty = await db.select().from(schema.abandonedReminders);
  check("flaga wyłączona: rejestr pusty (adresy nie spalone)", rejestrPusty.length, 0);

  // --- 2. właściwy przebieg ---
  const r1 = await runAbandonedMailerCore(db, { ...deps, enabled: true });
  const adresaci = enqueued.map((m) => m.to).sort();
  check("do kolejki trafiają tylko okno + wiele-sesji", adresaci, ["okno@example.com", "wiele@example.com"]);
  check("okno: <2 h pominięte", adresaci.includes("za-swieza@example.com"), false);
  check("okno: >7 dni pominięte", adresaci.includes("za-stara@example.com"), false);
  check("bez zgody na kontakt pominięta", adresaci.includes("bez-zgody@example.com"), false);
  check("dokończona sesja pominięta", adresaci.includes("dokonczona@example.com"), false);
  check("adres z dokończoną sesją gdzie indziej pominięty", adresaci.includes("inna-dokonczona@example.com"), false);
  check("adres z leadem pominięty (wielkość liter bez znaczenia)", adresaci.includes("ma-lead@example.com"), false);
  check("wypisana pominięta", adresaci.includes("wypisana@example.com"), false);
  check("krzywy adres i brak adresu pominięte", adresaci.some((a) => !a.includes("@")), false);
  check("wynik: 2 w kolejce", r1.queued, 2);

  const rej = await db.select().from(schema.abandonedReminders);
  const wiele = rej.find((r) => r.email === "wiele@example.com");
  check("wiele sesji: rejestr wskazuje najnowszą", wiele?.quizSessionId, najnowsza.id);
  check("email_queue ma 2 wiersze, kind porzucona_aplikacja", (await db.select().from(schema.emailQueue)).map((q) => q.kind), ["porzucona_aplikacja", "porzucona_aplikacja"]);

  // --- 3. dedup: drugi przebieg i drugie, późniejsze porzucenie ---
  enqueued = [];
  const r2 = await runAbandonedMailerCore(db, { ...deps, enabled: true });
  check("ponowne uruchomienie: 0 nowych maili", [r2.queued, enqueued.length], [0, 0]);
  await session({ age: 3 * H, email: "okno@example.com" }); // nowa sesja tego samego adresu
  const r3 = await runAbandonedMailerCore(db, { ...deps, enabled: true });
  check("nowa sesja tego samego adresu: nadal max JEDNO przypomnienie kiedykolwiek", [r3.queued, enqueued.length], [0, 0]);
  let blad: unknown = null;
  try {
    await db.insert(schema.abandonedReminders).values({ email: "okno@example.com", resumeToken: "z".repeat(64) });
  } catch (e) {
    blad = e;
  }
  check("UNIQUE na adresie blokuje drugi wiersz w rejestrze", Boolean(blad), true);

  // --- 4. wykluczenia reagują na zmianę stanu ---
  const spozniona = await session({ age: 6 * H, email: "pozniej-dokonczy@example.com" });
  await db.update(schema.quizSessions).set({ completed: true }).where(eq(schema.quizSessions.id, spozniona.id));
  const r4 = await runAbandonedMailerCore(db, { ...deps, enabled: true });
  check("sesja dokończona przed przebiegiem: pominięta", r4.queued, 0);

  // --- 5. nieudane kolejkowanie zwalnia rezerwację ---
  await session({ age: 6 * H, email: "awaria@example.com" });
  const r5 = await runAbandonedMailerCore(db, { ...deps, enabled: true, enqueue: async () => { throw new Error("boom"); } });
  check("awaria kolejki: failed=1, rezerwacja zwolniona", [r5.failed, (await db.select().from(schema.abandonedReminders).where(eq(schema.abandonedReminders.email, "awaria@example.com"))).length], [1, 0]);
  const r6 = await runAbandonedMailerCore(db, { ...deps, enabled: true });
  check("następny przebieg ponawia po awarii", [r6.queued, enqueued.at(-1)?.to], [1, "awaria@example.com"]);

  // --- 6. treść ---
  const mail = enqueued.find((m) => m.to === "awaria@example.com")!;
  check("treść: bez „0 zł”", /0\s?zł/i.test(mail.body), false);
  check("treść: bez „za darmo”", /za darmo/i.test(mail.body), false);
  check("treść: formuła „nawet do 95%”", mail.body.includes("nawet do 95%"), true);
  check("treść: bez myślnika-pauzy", /—/.test(mail.body + mail.subject), false);
  check("treść: link wznowienia z losowym tokenem (bez adresu e-mail w URL)", /\/aplikacja\?wznow=[a-f0-9]{64}\b/.test(mail.body) && !mail.body.includes("awaria@example.com"), true);
  check("treść: link wypisania /wypisz/<token>", /https:\/\/uniwersytetbeauty\.pl\/wypisz\/\S{64}/.test(mail.body), true);
  check("nagłówek List-Unsubscribe-Post (one-click)", mail.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  check("kategoria w treści", mail.body.includes("Makijaż permanentny"), true);
  const bezKat = buildReminderMessage({ name: null, category: null, resumeUrl: "u", unsubUrl: "w" });
  check("bez imienia i kategorii: brak „Dzień dobry ,” i pustych znaczników", [bezKat.body.includes("Dzień dobry,"), bezKat.body.includes("{{")], [true, false]);

  // --- 7. panel: stan przypomnień ---
  const stan = await reminderStatusByEmail(db, ["OKNO@example.com", "za-swieza@example.com"]);
  check("panel: adres z przypomnieniem ma stan „w_kolejce”", stan.get("okno@example.com")?.status, "w_kolejce");
  check("panel: adres bez przypomnienia nie ma wpisu", stan.has("za-swieza@example.com"), false);
  const qid = (await db.select().from(schema.abandonedReminders).where(eq(schema.abandonedReminders.email, "okno@example.com")))[0].emailQueueId!;
  await db.update(schema.emailQueue).set({ status: "wyslany", sentAt: now }).where(eq(schema.emailQueue.id, qid));
  const stan2 = await reminderStatusByEmail(db, ["okno@example.com"]);
  check("panel: po wysyłce stan „wyslany” + data", [stan2.get("okno@example.com")?.status, Boolean(stan2.get("okno@example.com")?.sentAt)], ["wyslany", true]);

  // --- 8. wznowienie po tokenie ---
  const tokenOkno = rej.find((r) => r.email === "okno@example.com")!.resumeToken;
  const wznow = await loadResumeByToken(db, tokenOkno, now);
  check("wznowienie: token działa i oddaje właściwą sesję", wznow?.id, wOknie.id);
  check("wznowienie: śmieciowy token", await loadResumeByToken(db, "abc", now), null);
  check("wznowienie: nieistniejący token", await loadResumeByToken(db, "0".repeat(64), now), null);
  check("wznowienie: wygasa po 14 dniach", await loadResumeByToken(db, tokenOkno, new Date(now.getTime() + 15 * D)), null);
  await db.update(schema.quizSessions).set({ completed: true }).where(eq(schema.quizSessions.id, wOknie.id));
  check("wznowienie: dokończona aplikacja nie jest wznawiana", await loadResumeByToken(db, tokenOkno, now), null);

  console.log(failed === 0 ? "\nWszystko OK." : `\n${failed} testów NIE przeszło.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
