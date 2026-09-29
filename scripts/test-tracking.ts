/**
 * Test logiki śledzenia — BEZ sieci, BEZ bazy, BEZ Next.js. Sprawdza:
 * 1) mapę zdarzeń (`tracking-events.ts`) — kształt, które kanały są zdefiniowane,
 * 2) normalizację e-maila/telefonu i hash SHA-256 (`tracking-format.ts`, `meta-capi-core.ts`),
 * 3) budowę payloadu CAPI — brak PII w formie jawnej, brak pól wrażliwych, obecność `event_id`,
 * 4) decyzję „czy wysyłać CAPI" (`shouldSendCapi`) i „czy CAPI jest skonfigurowane" (`isCapiConfigured`),
 * 5) POPRAWKĘ BŁĘDU Z 22.09 (audyt paneli 29.09): `trackEvent` musi odpalić KAŻDY kanał
 *    niezależnie, nawet gdy fbq/gtag stają się gotowe w różnej kolejności i w różnym czasie —
 *    stary kod miał jedną wspólną flagę `done`, przez co kanał, który wstawał jako drugi,
 *    nigdy nie dostawał zdarzenia. To jest scenariusz, który wyprodukował „0 zdarzeń Lead
 *    w Mecie przy niezerowym GA4 generate_lead".
 *
 * Użycie: npm run test:tracking
 */
import {
  TRACK_EVENTS,
  trackEvent,
  type UbAnalyticsConfig,
} from "../src/lib/tracking-events";
import { normalizeEmail, normalizePhoneDigits, toE164PL } from "../src/lib/tracking-format";
import {
  sha256Hex,
  hashEmail,
  hashPhone,
  buildMetaCapiPayload,
  isCapiConfigured,
  shouldSendCapi,
  metaApiVersion,
} from "../src/lib/meta-capi-core";

let failed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "BLAD"}  ${label}${ok ? "" : ` — oczekiwano ${JSON.stringify(expected)}, jest ${JSON.stringify(actual)}`}`);
}
function assertTrue(label: string, cond: boolean) {
  if (!cond) failed++;
  console.log(`${cond ? "OK  " : "BLAD"}  ${label}`);
}

// ===== 1) Mapa zdarzeń =====

check("lead: adsConversion=true", TRACK_EVENTS.lead.adsConversion, true);
check("lead: GA4 = generate_lead", TRACK_EVENTS.lead.ga4Name, "generate_lead");
check("lead: Meta = track Lead", TRACK_EVENTS.lead.meta, { method: "track", name: "Lead" });
check("quiz_start: Meta = trackCustom QuizStart (NIE track)", TRACK_EVENTS.quiz_start.meta, {
  method: "trackCustom",
  name: "QuizStart",
});
check("view_item: GA4 = view_item", TRACK_EVENTS.view_item.ga4Name, "view_item");
check("sign_up: bez konwersji Ads (tylko Lead ma)", Boolean(TRACK_EVENTS.sign_up.adsConversion), false);
check("contact: GA4 = contact", TRACK_EVENTS.contact.ga4Name, "contact");
check("lead_magnet: Meta = CompleteRegistration", TRACK_EVENTS.lead_magnet.meta?.name, "CompleteRegistration");
check("begin_checkout: Meta = InitiateCheckout", TRACK_EVENTS.begin_checkout.meta?.name, "InitiateCheckout");
assertTrue(
  "brak własnego 'form_start' w mapie (GA4 Enhanced Measurement już to zbiera — korekta CEO 29.09)",
  !("form_start" in TRACK_EVENTS)
);

// lead.toParams: Meta dostaje content_name, GA4 dostaje lead_source — różne parametry, ta sama treść.
const leadOut = TRACK_EVENTS.lead.toParams!({ source: "quiz", wojewodztwo: "slaskie", kategoria: "PMU" });
check("lead→Meta: content_name dla quizu", leadOut.metaParams.content_name, "quiz-kwalifikacyjny");
check("lead→GA4: lead_source zamiast content_name", leadOut.ga4Params.lead_source, "quiz");
assertTrue("lead→GA4: brak content_name (to pole jest tylko dla Mety)", !("content_name" in leadOut.ga4Params));

// ===== 2) Normalizacja + hash =====

check("normalizeEmail: trim + lowercase", normalizeEmail(" Test@Example.com "), "test@example.com");
check("normalizePhoneDigits: 9 cyfr → dopisz 48", normalizePhoneDigits("512 345 678"), "48512345678");
check("normalizePhoneDigits: już z 48 → bez zmian", normalizePhoneDigits("+48 512-345-678"), "48512345678");
check("toE164PL: z plusem", toE164PL("512345678"), "+48512345678");

// Wektor niezależny od naszej implementacji — policzony z shell: printf 'test@example.com' | shasum -a 256
const KNOWN_EMAIL_HASH = "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b".slice(0, 64);
check("sha256Hex('test@example.com') == wektor niezależny (shasum)", sha256Hex("test@example.com"), KNOWN_EMAIL_HASH);
check("hashEmail robi normalizację PRZED haszem", hashEmail(" Test@Example.com "), KNOWN_EMAIL_HASH);

const KNOWN_PHONE_HASH = "10056dd3f796b0c08a6000347953e20ec0cd521beb1261246cc231f35bd12718".slice(0, 64);
check("hashPhone('512 345 678') == wektor niezależny (shasum '48512345678')", hashPhone("512 345 678"), KNOWN_PHONE_HASH);

// ===== 3) Payload CAPI — bez PII w formie jawnej, whitelist pól =====

const payload = buildMetaCapiPayload({
  eventName: "Lead",
  eventId: "11111111-1111-1111-1111-111111111111",
  eventSourceUrl: "https://uniwersytetbeauty.pl/aplikacja",
  email: "Anna.Kowalska@Example.com",
  phone: "512 345 678",
  clientIp: "1.2.3.4",
  userAgent: "Mozilla/5.0",
  fbp: "fb.1.111.222",
  fbc: "fb.1.111.333",
  customData: { wojewodztwo: "slaskie", kategoria: "PMU", content_name: "quiz-kwalifikacyjny" },
});
const raw = JSON.stringify(payload);

assertTrue("payload CAPI: BRAK surowego e-maila", !raw.includes("anna.kowalska@example.com") && !raw.includes("Anna.Kowalska"));
assertTrue("payload CAPI: BRAK surowego telefonu (ani z myślnikami, ani samych cyfr 512345678)", !raw.includes("512 345 678") && !raw.includes("512345678"));
assertTrue("payload CAPI: BRAK statusu zawodowego ('bezrobotna' ani żadnego 'employmentStatus')", !raw.includes("bezrobotn") && !raw.includes("employmentStatus"));
assertTrue("payload CAPI: BRAK kodu pocztowego (wzorzec NN-NNN)", !/\b\d{2}-\d{3}\b/.test(raw));
check("payload CAPI: event_id obecny", payload.data[0].event_id, "11111111-1111-1111-1111-111111111111");
check("payload CAPI: event_time w SEKUNDACH (10 cyfr, nie 13)", String(payload.data[0].event_time).length, 10);
check("payload CAPI: em = [hashEmail]", payload.data[0].user_data.em, [hashEmail("anna.kowalska@example.com")]);
check("payload CAPI: ph = [hashPhone]", payload.data[0].user_data.ph, [hashPhone("512345678")]);
check("payload CAPI: action_source = website", payload.data[0].action_source, "website");
check("payload CAPI: bez test_event_code, gdy nie podano", "test_event_code" in payload, false);

const payloadWithTestCode = buildMetaCapiPayload({
  eventName: "SubmitApplication",
  eventId: "x",
  eventSourceUrl: "https://uniwersytetbeauty.pl/dla-akademii/rejestracja",
  email: "a@b.pl",
  phone: "512345678",
  testEventCode: "TEST12345",
});
check("payload CAPI: test_event_code na POZIOMIE GŁÓWNYM, nie w data[]", payloadWithTestCode.test_event_code, "TEST12345");
assertTrue("payload CAPI: test_event_code NIE wewnątrz data[0]", !("test_event_code" in payloadWithTestCode.data[0]));

check("metaApiVersion(): domyślnie v23.0 bez override", metaApiVersion({} as NodeJS.ProcessEnv), "v23.0");
check(
  "metaApiVersion(): respektuje META_CAPI_API_VERSION",
  metaApiVersion({ META_CAPI_API_VERSION: "v26.0" } as NodeJS.ProcessEnv),
  "v26.0"
);

// ===== 4) Konfiguracja i decyzja o wysyłce CAPI =====

check("isCapiConfigured: brak env → false", isCapiConfigured({} as NodeJS.ProcessEnv), false);
check(
  "isCapiConfigured: token bez pixela → false",
  isCapiConfigured({ META_CAPI_TOKEN: "x" } as NodeJS.ProcessEnv),
  false
);
check(
  "isCapiConfigured: token + pixel → true",
  isCapiConfigured({ META_CAPI_TOKEN: "x", META_PIXEL_ID: "123" } as NodeJS.ProcessEnv),
  true
);

check("shouldSendCapi: bez zgody, bez eventId → false", shouldSendCapi({}), false);
check("shouldSendCapi: zgoda ale BEZ eventId → false (serwer nie wolno mu zgadywać ID)", shouldSendCapi({ adConsent: true }), false);
check("shouldSendCapi: eventId ale BEZ zgody → false", shouldSendCapi({ eventId: "x" }), false);
check("shouldSendCapi: zgoda + eventId → true", shouldSendCapi({ adConsent: true, eventId: "x" }), true);

// ===== 5) Niezależność kanałów — scenariusz błędu z 22.09 =====
//
// Symulujemy przeglądarkę: `window` z `setInterval`/`clearInterval` prawdziwego Node,
// a `fbq`/`gtag` oraz `window.__ubAnalytics` "wstają" w różnym czasie i różnej kolejności.
// Stary kod (jedna flaga `done` na CAŁE zdarzenie) w tym teście by NIE PRZESZEDŁ:
// ten kanał, który wstał jako drugi, zostałby bez zdarzenia.

type FakeWindow = {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  __ubAnalytics?: UbAnalyticsConfig;
  __ubFiredEvents?: Set<string>;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

function withFakeWindow<T>(run: (win: FakeWindow, calls: { fbq: unknown[][]; gtag: unknown[][] }) => Promise<T>): Promise<T> {
  const calls = { fbq: [] as unknown[][], gtag: [] as unknown[][] };
  const win: FakeWindow = {
    setInterval: setInterval.bind(globalThis),
    clearInterval: clearInterval.bind(globalThis),
  };
  (globalThis as unknown as { window: FakeWindow }).window = win;
  return run(win, calls).finally(() => {
    delete (globalThis as unknown as { window?: FakeWindow }).window;
  });
}

async function testGtagReadyFirst() {
  await withFakeWindow(async (win, calls) => {
    // GA4/Ads (gtag) gotowe PRAWIE od razu; Meta (fbq) dopiero po 600ms — dokładnie ten wyścig,
    // który w starym kodzie zjadał zdarzenie Lead w Mecie (widoczne w panelach jako 0 zdarzeń).
    win.__ubAnalytics = { ga4: "G-TEST", pixel: null, adsId: "AW-TEST", adsLeadLabel: "LABEL" };
    win.gtag = (...args: unknown[]) => calls.gtag.push(args);
    setTimeout(() => {
      win.__ubAnalytics = { ga4: "G-TEST", pixel: "PIXEL-TEST", adsId: "AW-TEST", adsLeadLabel: "LABEL" };
      win.fbq = (...args: unknown[]) => calls.fbq.push(args);
    }, 600);

    trackEvent("lead", { wojewodztwo: "slaskie", kategoria: "PMU", source: "formularz" }, { eventId: "evt-A" });

    await new Promise((r) => setTimeout(r, 1500));

    assertTrue("wyścig gtag-pierwsze: GA4 generate_lead odpalone", calls.gtag.some((c) => c[0] === "event" && c[1] === "generate_lead"));
    assertTrue("wyścig gtag-pierwsze: konwersja Ads odpalona", calls.gtag.some((c) => c[0] === "event" && c[1] === "conversion"));
    assertTrue(
      "wyścig gtag-pierwsze: Meta Lead MIMO TO odpalone (to jest poprawka błędu 22.09)",
      calls.fbq.some((c) => c[0] === "track" && c[1] === "Lead")
    );
  });
}

async function testFbqReadyFirst() {
  await withFakeWindow(async (win, calls) => {
    // Odwrotny wyścig: Meta gotowe od razu, GA4/Ads dopiero po 600ms.
    win.__ubAnalytics = { ga4: null, pixel: "PIXEL-TEST", adsId: null, adsLeadLabel: null };
    win.fbq = (...args: unknown[]) => calls.fbq.push(args);
    setTimeout(() => {
      win.__ubAnalytics = { ga4: "G-TEST", pixel: "PIXEL-TEST", adsId: "AW-TEST", adsLeadLabel: "LABEL" };
      win.gtag = (...args: unknown[]) => calls.gtag.push(args);
    }, 600);

    trackEvent("lead", { wojewodztwo: "mazowieckie", kategoria: "rzęsy", source: "quiz" }, { eventId: "evt-B" });

    await new Promise((r) => setTimeout(r, 1500));

    assertTrue("wyścig fbq-pierwsze: Meta Lead odpalone", calls.fbq.some((c) => c[0] === "track" && c[1] === "Lead"));
    assertTrue(
      "wyścig fbq-pierwsze: GA4 generate_lead MIMO TO odpalone",
      calls.gtag.some((c) => c[0] === "event" && c[1] === "generate_lead")
    );
    assertTrue(
      "wyścig fbq-pierwsze: konwersja Ads MIMO TO odpalona",
      calls.gtag.some((c) => c[0] === "event" && c[1] === "conversion")
    );
  });
}

async function testDedupeNoDoubleFire() {
  await withFakeWindow(async (win, calls) => {
    win.__ubAnalytics = { ga4: "G-TEST", pixel: "PIXEL-TEST", adsId: null, adsLeadLabel: null };
    win.fbq = (...args: unknown[]) => calls.fbq.push(args);
    win.gtag = (...args: unknown[]) => calls.gtag.push(args);

    trackEvent("lead", { source: "formularz" }, { eventId: "evt-C" });
    trackEvent("lead", { source: "formularz" }, { eventId: "evt-C" }); // np. StrictMode / drugi montaż

    await new Promise((r) => setTimeout(r, 50));

    check("dedup: Lead do Mety poszedł DOKŁADNIE RAZ mimo dwóch wywołań z tym samym eventId", calls.fbq.filter((c) => c[1] === "Lead").length, 1);
    check("dedup: generate_lead do GA4 poszedł DOKŁADNIE RAZ", calls.gtag.filter((c) => c[1] === "generate_lead").length, 1);
  });
}

async function main() {
  await testGtagReadyFirst();
  await testFbqReadyFirst();
  await testDedupeNoDoubleFire();

  console.log("\n" + (failed === 0 ? `WSZYSTKO OK` : `${failed} BŁĄD(Y)`));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Blad testu:", err);
  process.exit(1);
});
