import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { academyRegistrationSchema } from "@/lib/validators";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { findMatchingProspect, freeTrainerSlug, logProspectActivity } from "@/lib/prospects";
import { getSettings } from "@/lib/settings";
import { sendOrQueueEmail, EMAIL_KIND } from "@/lib/email";
import { CONSENT_VERSION, voivodeshipName } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * SAMODZIELNA REJESTRACJA AKADEMII — publiczny, nieuwierzytelniony zapis.
 *
 * Powstaje z tego RAZEM: konto do panelu (`users`), profil-szkic (`trainers`, ukryty)
 * i pozycja w CRM (`prospects`) ustawiona na dziś w kolejce „do zadzwonienia”.
 * Trzecia rzecz jest najważniejsza biznesowo: rejestracja bez telefonu z naszej strony
 * nie kończy się umową, a kolejka CRM jest jedynym miejscem, do którego Bartek zagląda.
 *
 * Czego ten endpoint CELOWO nie robi:
 *  - nie publikuje profilu (`isActive: false`),
 *  - nie włącza automatycznego przydziału leadów (`autoAssign: false` — bramka umowy),
 *  - nie weryfikuje maila linkiem aktywacyjnym: skrzynka `szkolenia@` jeszcze nie istnieje,
 *    więc link aktywacyjny nigdzie by nie doleciał, a konto i tak nie daje dostępu do
 *    żadnych cudzych danych. Weryfikacją jest telefon.
 *
 * Ochrona przed śmieciem w kolejce CRM: rate limit + honeypot (ten sam wzorzec co `/api/lead`).
 * Świadomie NIE budujemy moderacji — przy spodziewanym wolumenie (kilka zgłoszeń miesięcznie)
 * kosztowałaby więcej niż skasowanie jednego wiersza ręcznie.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`akademia-rejestracja:${ip}`, 3, 10 * 60_000)) {
    return NextResponse.json({ error: "Zbyt wiele zgłoszeń. Spróbuj za kilka minut." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const parsed = academyRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      { error: first?.message ?? "Nieprawidłowe dane formularza.", field: first?.path?.[0] ?? null },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // honeypot wypełniony -> udajemy sukces, nie zapisujemy niczego
  if (d.fax && d.fax.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const email = d.email.toLowerCase();
  const db = await getDb();

  const existingUser = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existingUser.length > 0) {
    return NextResponse.json(
      {
        error: "Konto z tym adresem e-mail już istnieje. Zaloguj się albo napisz do nas na biuro@uniwersytetbeauty.pl.",
        field: "email",
      },
      { status: 409 }
    );
  }

  const settings = await getSettings();
  const slug = await freeTrainerSlug(d.name);

  // 1) PROFIL-SZKIC. Ukryty i bez auto-przydziału — patrz komentarz nad handlerem.
  const [trainer] = await db
    .insert(schema.trainers)
    .values({
      slug,
      name: d.name,
      email,
      phone: d.phone,
      city: d.city,
      voivodeship: d.voivodeship,
      specializations: d.categories,
      website: d.academyWebsite || null,
      instagram: d.instagram || null,
      billingModel: "per_zapis",
      rate: settings.defaultRatePerSignup,
      autoAssign: false,
      isActive: false,
    })
    .returning();

  // 2) KONTO. Hasło ustawia sama przy rejestracji, więc `mustChangePassword: false` —
  // wymuszanie zmiany hasła dotyczy wyłącznie haseł startowych wydanych przez nas.
  try {
    await db.insert(schema.users).values({
      email,
      passwordHash: await hashPassword(d.password),
      role: "trenerka",
      trainerId: trainer.id,
      mustChangePassword: false,
      isActive: true,
    });
  } catch (err) {
    // Wyścig na unikalnym e-mailu (dwa submity naraz) albo błąd zapisu: profil-szkic bez konta
    // byłby sierotą w katalogu, więc go sprzątamy zamiast zostawiać.
    await db.delete(schema.trainers).where(eq(schema.trainers.id, trainer.id));
    console.error("[rejestracja-akademii] Nie udało się założyć konta:", err);
    return NextResponse.json(
      { error: "Nie udało się założyć konta. Spróbuj ponownie albo napisz na biuro@uniwersytetbeauty.pl." },
      { status: 500 }
    );
  }

  // 3) CRM. Najpierw szukamy, czy tej akademii już nie mamy z researchu — dopiero potem zakładamy nową.
  const match = await findMatchingProspect({ nip: d.nip, phone: d.phone, email, name: d.name, city: d.city });
  const now = new Date();
  const burSegment = d.burSegment;
  const consentNote =
    `Zgody z formularza (wersja ${CONSENT_VERSION}, IP ${ip}): regulamin i polityka prywatności ✓, kontakt telefoniczny/e-mail ✓.`;

  let prospectId: number;
  /** Podmiot jest w bazie, ale ma już własny profil — sytuacja do rozstrzygnięcia przez człowieka. */
  const conflict = Boolean(match && match.prospect.trainerId && match.prospect.trainerId !== trainer.id);
  if (match && match.prospect.trainerId && match.prospect.trainerId !== trainer.id) {
    // 🔴 PODMIOT MA JUŻ PROFIL, a ktoś zakłada dla niego DRUGIE konto (inny adres e-mail,
    // więc dedup po `users.email` tego nie złapał). Nie wolno tu ruszyć ani jednego pola:
    // przepięcie `trainerId` na świeżą, pustą skorupę zabrałoby działającej akademii
    // powiązanie z jej realnym profilem — a nadpisanie e-maila podmieniłoby kontakt
    // partnera na adres osoby, której jeszcze nie zweryfikowaliśmy.
    // Nie dowiązujemy też nowego konta do istniejącego profilu: ten profil bywa aktywny,
    // więc dowiązanie oddałoby dostęp do danych kursantek bez weryfikacji. Rozstrzyga człowiek.
    const { prospect, matchedBy } = match;
    prospectId = prospect.id;
    await db
      .update(schema.prospects)
      .set({ nextActionAt: now, nextActionNote: "Drugie konto dla podmiotu z profilem — wyjaśnij", updatedAt: now })
      .where(eq(schema.prospects.id, prospect.id));
    await logProspectActivity({
      prospectId,
      type: "notatka",
      content:
        `⚠️ DRUGIE KONTO dla podmiotu, który MA JUŻ profil trenerki #${prospect.trainerId} ` +
        `(dopasowano po: ${matchedBy}). Ktoś zarejestrował się z adresu ${email} jako „${d.name}”, ` +
        `osoba do kontaktu: ${d.contactPerson}, telefon ${d.phone}. ` +
        `Utworzono osobne konto i profil-szkic #${trainer.id} — NIC nie zostało podmienione ` +
        `w tym wierszu ani w istniejącym profilu. Do rozstrzygnięcia ręcznie: to ta sama osoba ` +
        `(scalić) czy inna filia/podmiot (rozdzielić). ${consentNote}`,
      createdBy: "system",
    });
  } else if (match) {
    const { prospect, matchedBy } = match;
    const changes: string[] = [];
    if (prospect.phone && prospect.phone !== d.phone) changes.push(`telefon: „${prospect.phone}” → „${d.phone}”`);
    if (prospect.email && prospect.email.toLowerCase() !== email) changes.push(`e-mail: „${prospect.email}” → „${email}”`);

    await db
      .update(schema.prospects)
      .set({
        // Dane od właścicielki są nadrzędne wobec tego, co znaleźliśmy researchem w internecie.
        phone: d.phone,
        email,
        city: prospect.city ?? d.city,
        voivodeship: prospect.voivodeship ?? d.voivodeship,
        nip: prospect.nip ?? (d.nip || null),
        website: prospect.website ?? (d.academyWebsite || null),
        instagram: prospect.instagram ?? (d.instagram || null),
        // Deklaracja BUR z formularza nie kasuje ustalenia z rejestru PARP — nadpisuje
        // wyłącznie wtedy, gdy dotąd nie wiedzieliśmy (`nieznany`).
        burSegment: prospect.burSegment === "nieznany" ? burSegment : prospect.burSegment,
        burProviderId: prospect.burProviderId ?? (d.burProviderId || null),
        trainerId: trainer.id,
        priority: "wysoki",
        status: prospect.status === "potencjalny" || prospect.status === "research" ? "do_kontaktu" : prospect.status,
        nextActionAt: now,
        nextActionNote: "Zgłosiła się sama przez formularz — oddzwoń",
        updatedAt: now,
      })
      .where(eq(schema.prospects.id, prospect.id));
    prospectId = prospect.id;

    await logProspectActivity({
      prospectId,
      type: "notatka",
      content:
        `🟢 SAMODZIELNA REJESTRACJA w panelu (dopasowano po: ${matchedBy}). ` +
        `Osoba do kontaktu: ${d.contactPerson}. Deklaruje wpis do BUR: ${burLabel(burSegment)}` +
        (d.burProviderId ? ` (ID dostawcy: ${d.burProviderId})` : "") +
        `. Kategorie: ${d.categories.join(", ")}. Utworzono konto i profil-szkic #${trainer.id}.` +
        (changes.length ? ` Zaktualizowane dane: ${changes.join("; ")}.` : "") +
        ` ${consentNote}`,
      createdBy: "system",
    });
  } else {
    const [created] = await db
      .insert(schema.prospects)
      .values({
        name: d.name,
        nip: d.nip || null,
        city: d.city,
        voivodeship: d.voivodeship,
        categories: d.categories,
        phone: d.phone,
        email,
        website: d.academyWebsite || null,
        instagram: d.instagram || null,
        status: "do_kontaktu",
        priority: "wysoki",
        source: "rejestracja",
        burSegment,
        burProviderId: d.burProviderId || null,
        trainerId: trainer.id,
        nextActionAt: now,
        nextActionNote: "Zgłosiła się sama przez formularz — oddzwoń",
      })
      .returning();
    prospectId = created.id;

    await logProspectActivity({
      prospectId,
      type: "notatka",
      content:
        `🟢 SAMODZIELNA REJESTRACJA w panelu (nowy podmiot — nie było go w bazie). ` +
        `Osoba do kontaktu: ${d.contactPerson}. Deklaruje wpis do BUR: ${burLabel(burSegment)}` +
        (d.burProviderId ? ` (ID dostawcy: ${d.burProviderId})` : "") +
        `. Kategorie: ${d.categories.join(", ")}. Utworzono konto i profil-szkic #${trainer.id}. ${consentNote}`,
      createdBy: "system",
    });
  }

  await logAudit({
    actor: "system",
    action: "akademia_rejestracja",
    entityType: "trainer",
    entityId: trainer.id,
    details: {
      prospectId,
      email,
      dopasowanie: conflict ? "konflikt-ma-juz-profil" : match ? match.matchedBy : "nowy",
      burSegment,
      voivodeship: d.voivodeship,
      zgody: { regulamin: true, kontakt: true, wersja: CONSENT_VERSION, ip },
    },
  });

  // 4) MAILE. Oba lecą do kolejki, jeśli SMTP jeszcze nie stoi (skrzynka `szkolenia@` u Bartka).
  // ⚠️ Worker pomija maile starsze niż 7 dni — przy włączeniu SMTP później te dwa przepadną.
  // Przyjęte świadomie: ekran po rejestracji mówi akademii wszystko, co jest w mailu,
  // a nas o zgłoszeniu i tak powiadamia kolejka „do zadzwonienia” w CRM.
  const region = `${d.city}, ${voivodeshipName(d.voivodeship)}`;
  await sendOrQueueEmail({
    to: settings.notifyEmail,
    kind: EMAIL_KIND.WEWNETRZNE_AKADEMIA,
    subject: `Nowa akademia zgłosiła się sama — ${d.name} (${region})`,
    body:
      `${d.name}\n${region}\n\n` +
      `Osoba do kontaktu: ${d.contactPerson}\nTelefon: ${d.phone}\nE-mail: ${email}\n` +
      `Kategorie: ${d.categories.join(", ")}\n` +
      `Wpis do BUR (deklaracja): ${burLabel(burSegment)}${d.burProviderId ? ` — ID ${d.burProviderId}` : ""}\n` +
      `NIP: ${d.nip || "—"}\n\n` +
      `W CRM: prospekt #${prospectId}${
        conflict
          ? ` — ⚠️ TEN PODMIOT MA JUŻ PROFIL TRENERKI. Powstało drugie, osobne konto; nic nie zostało podmienione. Sprawdź, czy scalić.`
          : match
            ? ` (dopasowany do istniejącego po: ${match.matchedBy})`
            : " (nowy)"
      }.\n` +
      `Profil-szkic #${trainer.id} — ukryty, bez auto-przydziału. Konto do panelu już działa.\n\n` +
      `Następny ruch: telefon. Kolejka: /admin/crm-trenerki`,
  });

  await sendOrQueueEmail({
    to: email,
    kind: EMAIL_KIND.AKADEMIA_POWITANIE,
    subject: "Konto w Uniwersytecie Beauty założone — co dalej",
    body:
      `Dzień dobry,\n\n` +
      `dziękujemy za zgłoszenie akademii ${d.name}. Konto w panelu jest już aktywne — ` +
      `logujesz się adresem ${email} i hasłem ustawionym przy rejestracji: https://uniwersytetbeauty.pl/panel/login\n\n` +
      `Co dzieje się dalej:\n\n` +
      `1. Sprawdzamy Twój wpis w Bazie Usług Rozwojowych. Bez niego kursantka nie rozliczy dofinansowania, ` +
      `dlatego robimy to zanim przekażemy pierwszy kontakt.\n` +
      `2. Dzwonimy — zwykle w ciągu 1-2 dni roboczych. Ustalamy zakres szkoleń, region i zasady rozliczenia.\n` +
      `3. Podpisujemy umowę partnerską. Dopiero od tego momentu wolno nam przekazać Ci dane kontaktowe kursantki — ` +
      `wcześniej nie pozwala na to RODO.\n\n` +
      `W międzyczasie warto uzupełnić profil akademii w panelu (zakładka „Mój profil”). ` +
      `Korzystamy z niego, dobierając kursantki do akademii — im konkretniej opiszesz zakres, tym trafniej.\n\n` +
      `Pozdrawiamy,\nZespół Uniwersytet Beauty\nbiuro@uniwersytetbeauty.pl`,
  });

  return NextResponse.json({ ok: true, email }, { status: 201 });
}

function burLabel(segment: "A" | "B" | "nieznany"): string {
  if (segment === "A") return "ma wpis";
  if (segment === "B") return "nie ma wpisu";
  return "nie wie / w trakcie";
}
