/**
 * Test telefonu admina (SMS Gateway + dziennik rozmów) na PGlite w pamięci — bez sieci i Next.js.
 * Uruchamiaj przez `npm run test:telefon`. Migracje lecą z ./drizzle jak na produkcji.
 *
 * Sprawdza: podpis webhooka (poprawny / zły / za stary / bez klucza), sterownik (adres, auth, ciało,
 * błędy), tryb testowy bez loginu, normalizację numerów, wątek: wysłany + odebrany (bez duplikatu),
 * statusy z webhooków, nieprzeczytane, dziennik rozmów, etykiety z bazy kontaktów, straż strukturalną.
 */
import Module from "module";
import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = Module as any;
const origLoad = M._load;
M._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return origLoad.call(this, request, ...rest);
};

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "BLAD"}  ${label}${ok ? "" : ` — oczekiwano ${JSON.stringify(expected)}, jest ${JSON.stringify(actual)}`}`);
}

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  // getDb() to singleton na globalThis — podstawiamy bazę w pamięci przed pierwszym importem rdzenia.
  (globalThis as { __ubDb?: unknown }).__ubDb = Promise.resolve(db);

  const { verifyWebhookSignature, SmsgateProvider, getTelefonSmsProvider } = await import("../src/lib/telefon/smsgate");
  const { normalizeAnyPhone, formatPhone } = await import("../src/lib/telefon/phone");
  const core = await import("../src/lib/telefon/core");

  // --- 1. podpis webhooka
  const key = "klucz-testowy";
  const body = '{"event":"sms:received","payload":{"sender":"+48500600700","message":"Tak, jestem zainteresowana"}}';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", key).update(body + ts).digest("hex");
  check("podpis poprawny", verifyWebhookSignature(key, body, ts, sig), true);
  check("podpis: zmienione ciało", verifyWebhookSignature(key, body + " ", ts, sig), false);
  check("podpis: zły klucz", verifyWebhookSignature("inny", body, ts, sig), false);
  check("podpis: brak nagłówka", verifyWebhookSignature(key, body, null, null), false);
  check("podpis: pusty klucz w env odrzuca wszystko", verifyWebhookSignature("", body, ts, sig), false);
  const old = String(Math.floor(Date.now() / 1000) - 3600);
  const oldSig = createHmac("sha256", key).update(body + old).digest("hex");
  check("podpis: za stary (replay)", verifyWebhookSignature(key, body, old, oldSig), false);
  check("podpis: śmieciowa sygnatura nie wywala", verifyWebhookSignature(key, body, ts, "zzzz"), false);

  // --- 2. sterownik
  let seen: { url: string; init: RequestInit } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ id: "abc123", state: "Pending" }), { status: 202 });
  }) as unknown as typeof fetch;
  const prov = new SmsgateProvider("u", "p", undefined, fake);
  const r1 = await prov.send("+48500600700", "Cześć");
  check("sterownik: sukces", r1, { id: "abc123", status: "sent" });
  check("sterownik: adres", seen!.url, "https://api.sms-gate.app/3rdparty/v1/message");
  check("sterownik: Basic auth", (seen!.init.headers as Record<string, string>).Authorization, "Basic " + Buffer.from("u:p").toString("base64"));
  check("sterownik: ciało", JSON.parse(String(seen!.init.body)), { textMessage: { text: "Cześć" }, phoneNumbers: ["+48500600700"] });
  const bad = new SmsgateProvider("u", "x", undefined, (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch);
  check("sterownik: 401 → failed", (await bad.send("+48500600700", "x")).status, "failed");
  const boom = new SmsgateProvider("u", "x", undefined, (async () => { throw new Error("timeout"); }) as unknown as typeof fetch);
  check("sterownik: błąd sieci → failed", (await boom.send("+48500600700", "x")).status, "failed");
  check("bez loginu → tryb testowy", getTelefonSmsProvider({}).name, "dryrun");
  check("z loginem → smsgate", getTelefonSmsProvider({ SMSGATE_USER: "a", SMSGATE_PASSWORD: "b" }).name, "smsgate");

  // --- 3. numery
  check("numer: 9 cyfr", normalizeAnyPhone("500 600 700"), "+48500600700");
  check("numer: 48 bez plusa", normalizeAnyPhone("48500600700"), "+48500600700");
  check("numer: zagraniczny z plusem", normalizeAnyPhone("+380501234567"), "+380501234567");
  check("numer: 0048", normalizeAnyPhone("0048500600700"), "+48500600700");
  check("numer: śmieci", normalizeAnyPhone("abc"), null);
  check("format", formatPhone("+48500600700"), "500 600 700");

  // --- 4. wątek na prawdziwej bazie (dry-run, bo brak SMSGATE_*)
  delete process.env.SMSGATE_USER;
  delete process.env.SMSGATE_PASSWORD;
  const [admin] = await db.insert(schema.users).values({ email: "a@test.pl", passwordHash: "x", role: "admin", isActive: true } as never).returning();
  const sent = await core.sendAdminSms(admin as never, "500 600 700", "Dzień dobry, tu UB");
  check("SMS dry-run zapisany", sent.ok && sent.dryRun, true);
  const badNum = await core.sendAdminSms(admin as never, "123", "x");
  check("zły numer odrzucony", !badNum.ok && badNum.status, 400);
  const tooLong = await core.sendAdminSms(admin as never, "500600700", "ą".repeat(300));
  check("za długi SMS odrzucony", !tooLong.ok && tooLong.status, 400);

  await core.recordInboundSms("+48500600700", "Tak, jestem zainteresowana", "in-1");
  await core.recordInboundSms("+48500600700", "Tak, jestem zainteresowana", "in-1"); // powtórzony webhook
  let t = await core.getThread("+48500600700");
  check("wątek: 1 wysłany + 1 odebrany (bez duplikatu)", t.messages.map((m) => m.direction).sort(), ["in", "out"]);
  check("nieprzeczytane = 1", await core.unreadCount(), 1);
  let threads = await core.listThreads();
  check("lista wątków: 1 wątek z licznikiem", [threads.length, threads[0].unread], [1, 1]);
  await core.markThreadRead("+48500600700");
  check("po przeczytaniu = 0", await core.unreadCount(), 0);

  // statusy z webhooków: dopisujemy wiadomość z providerId i zmieniamy status
  await db.insert(schema.phoneMessages).values({ direction: "out", phone: "+48500600700", body: "x", status: "wyslany", provider: "smsgate", providerId: "out-1" });
  await core.updateOutboundStatus("out-1", "dostarczony");
  t = await core.getThread("+48500600700");
  check("status → dostarczony", t.messages.find((m) => m.providerId === "out-1")?.status, "dostarczony");
  await core.updateOutboundStatus("out-1", "blad", "Network error");
  t = await core.getThread("+48500600700");
  check("status → błąd z powodem", t.messages.find((m) => m.providerId === "out-1")?.error, "Network error");

  // --- 5. dziennik rozmów
  const c = await core.logCall(admin as never, "500600700", "nieodebrala", " oddzwonić po 16 ");
  check("rozmowa zapisana", c.ok, true);
  t = await core.getThread("+48500600700");
  check("rozmowa w wątku z notatką", [t.calls.length, t.calls[0].outcome, t.calls[0].note], [1, "nieodebrala", "oddzwonić po 16"]);
  const badCall = await core.logCall(admin as never, "xx", "odebrala", null);
  check("rozmowa: zły numer", !badCall.ok, true);

  // --- 6. etykieta z bazy kontaktów
  await db.insert(schema.trainers).values({ name: "Akademia Test", phone: "500 600 700", slug: "akademia-test" } as never).catch(() => {});
  const labels = await core.labelsFor(["+48500600700"]);
  check("etykieta z bazy trenerek", labels.get("+48500600700")?.includes("Akademia Test") ?? "brak (pominięto: wymagane pola trenerki)", true);

  // --- 7. audyt nie niesie treści ani numeru
  const audit = await db.select().from(schema.adminAuditLog);
  const leaked = JSON.stringify(audit).includes("500600700") || JSON.stringify(audit).includes("Dzień dobry");
  check("dziennik adminów bez numeru i treści", leaked, false);

  // --- 8. straż strukturalna: każda trasa/strona telefonu ma flagę i bramkę sesji
  const files = [
    "src/app/api/admin/telefon/sms/route.ts",
    "src/app/api/admin/telefon/rozmowa/route.ts",
    "src/app/admin/(panel)/telefon/page.tsx",
    "src/app/api/telefon/webhook/route.ts",
  ];
  for (const f of files) {
    check(`${f}: flaga`, existsSync(f) && readFileSync(f, "utf8").includes("telefonEnabled()"), true);
  }
  for (const f of files.filter((x) => !x.includes("webhook"))) {
    check(`${f}: bramka sesji`, readFileSync(f, "utf8").includes("requireAdmin()"), true);
  }
  check("webhook: weryfikacja podpisu", readFileSync(files[3], "utf8").includes("verifyWebhookSignature("), true);

  console.log(failed === 0 ? "\nWSZYSTKO OK" : `\n${failed} BŁĘDÓW`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
