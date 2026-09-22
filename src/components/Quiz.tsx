"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, VOIVODESHIPS } from "@/lib/constants";
import { LEAD_SEGMENT_KEY } from "@/components/LeadConversion";
import { getUtm } from "@/lib/utm";

type Props = {
  /** Numeryczne ID kursu, jeśli quiz wszedł z karty konkretnego szkolenia (`?kurs=<slug>`). */
  courseId?: number | null;
  defaultCategory?: string;
  defaultVoivodeship?: string;
};

/**
 * Forma zatrudnienia — pięć opcji z realnego formularza konkurencji (BIAR Academy),
 * podpatrzonych 13.09.2026. Mapujemy je na `EMPLOYMENT_STATUSES`, bo TEN enum żyje
 * w bazie i w matchingu — nie dokładamy nowej kolumny ani nowej wartości enuma.
 * Pełny, niezredukowany wybór trafia do `message`, żeby trenerka/admin widzieli
 * dokładnie to, co kandydatka zaznaczyła, nie tylko uproszczoną kategorię.
 */
const EMPLOYMENT_FORM_OPTIONS = [
  { label: "Prowadzę firmę", employmentStatus: "przedsiębiorczyni" },
  { label: "Umowa o pracę / zlecenie / dzieło", employmentStatus: "pracująca" },
  { label: "Osoba bezrobotna", employmentStatus: "bezrobotna" },
  { label: "Nie pracuję, uczę się", employmentStatus: "studentka" },
  { label: "Nie pracuję, bierna zawodowo", employmentStatus: "inna" },
] as const;

/**
 * KRYTERIA WYŻSZEGO DOFINANSOWANIA — wersja z 22.09.2026.
 *
 * 🔴 Dlaczego przepisane: poprzednio było JEDNO abstrakcyjne pytanie „czy należysz do grupy
 * uprawnionej do wyższego poziomu dofinansowania?" z opcją „nie wiem — sprawdźcie za mnie".
 * Efekt na produkcji: **praktycznie każda kandydatka klikała „nie wiem"** — bo nikt nie wie,
 * czy należy do „grupy uprawnionej", dopóki nie zobaczy, co to znaczy. Pytanie nie dawało
 * żadnej informacji do telefonu i zajmowało miejsce.
 *
 * Wzorzec: formularz Akademii Kachel (`akademiakachel.fillout.com/microblading`, odczytany
 * 22.09.2026), czyli realny formularz akademii z wpisem do BUR. Ona wylicza kryteria wprost.
 * Rozpoznanie („czy to o mnie?") jest zadaniem, które człowiek umie wykonać; ocena własnego
 * statusu prawnego nie jest.
 *
 * ⚠️ ŚWIADOMA RÓŻNICA WOBEC PIERWOWZORU — nie pytamy o niepełnosprawność, przynależność do
 * mniejszości ani kryzys bezdomności. To są **kategorie szczególne z art. 9 RODO**, a UB jest
 * pośrednikiem: wniosek o dofinansowanie składa akademia i to ONA te dane zbiera (formularz
 * Kachel jest tego dowodem). Duplikowanie cudzego obowiązku dołożyłoby nam wymogów, niczego
 * nie dając. Zamiast tego ostatnia pozycja pozwala zasygnalizować „jest coś jeszcze" bez
 * zapisywania JAKIEJ kategorii to dotyczy.
 *
 * ⛔ Nie dokładaj tu opcji „nie wiem". Konkretna lista działa tylko dopóty, dopóki nie ma
 * z niej wyjścia bokiem — „Żadne z powyższych" jest świadomą odpowiedzią, „nie wiem" nie jest.
 */
const ELIGIBILITY_OPTIONS = [
  { value: "wiek_55", label: "Mam 55 lat lub więcej" },
  {
    value: "wyksztalcenie",
    label: "Moje wykształcenie to co najwyżej średnie",
    hint: "podstawowe, gimnazjalne, zawodowe, liceum lub technikum",
  },
  {
    value: "bez_pracy",
    label: "Obecnie nie pracuję",
    hint: "status osoby bezrobotnej lub poszukującej pracy trzeba będzie udokumentować",
  },
  {
    value: "inne_do_rozmowy",
    label: "Jest jeszcze coś, co może podnieść moje dofinansowanie",
    hint: "powiesz o tym przez telefon — tutaj niczego nie zapisujemy",
  },
] as const;

/** Wybór wykluczający resztę — bez niego „nic nie zaznaczone" znaczy jednocześnie
 *  „nic mnie nie dotyczy" i „pominęłam pytanie", czyli tyle samo co dawne „nie wiem". */
const ELIGIBILITY_NONE = "zadne";

const GOAL_OPTIONS = [
  "Zmiana zawodu",
  "Rozwój obecnych umiejętności",
  "Otwarcie własnego salonu lub gabinetu",
  "Jeszcze się zastanawiam",
] as const;

const AGE_OPTIONS = ["18–24", "25–34", "35–44", "45–54", "55+"] as const;

const TRAVEL_OPTIONS = [
  { label: "Wolę szkolenie online", km: 0 },
  { label: "Do 10 km", km: 10 },
  { label: "Do 30 km", km: 30 },
  { label: "Do 50 km", km: 50 },
  { label: "Nie mam ograniczeń", km: 999 },
] as const;

const HEARD_FROM_OPTIONS = [
  "Google / wyszukiwarka",
  "Facebook",
  "Instagram",
  "Polecenie od znajomej",
  "Inne",
] as const;

type FormState = {
  category: string;
  voivodeship: string;
  city: string;
  postalCode: string;
  employmentForm: string; // label z EMPLOYMENT_FORM_OPTIONS
  /** Bez „nie wiem": pytanie ma teraz przy sobie definicję, więc nie ma czego nie wiedzieć. */
  hasBusinessActivity: "" | "tak" | "nie";
  /** Zaznaczone wartości z ELIGIBILITY_OPTIONS albo sam ELIGIBILITY_NONE. Patrz komentarz tam. */
  eligibility: string[];
  goal: string;
  /** Inne kategorie, którymi jest zainteresowana — pod multi-sell do 2-3 akademii. */
  alsoInterestedIn: string[];
  worksInBeauty: "" | "tak" | "nie";
  ageRange: string;
  preferredDate: string;
  travelKm: string;
  name: string;
  phone: string;
  email: string;
  heardFrom: string;
  rodoConsent: boolean;
  contactConsent: boolean;
  marketingConsent: boolean;
  website: string; // honeypot
};

const INITIAL: FormState = {
  category: "",
  voivodeship: "",
  city: "",
  postalCode: "",
  employmentForm: "",
  hasBusinessActivity: "",
  eligibility: [],
  goal: "",
  alsoInterestedIn: [],
  worksInBeauty: "",
  ageRange: "",
  preferredDate: "",
  travelKm: "",
  name: "",
  phone: "",
  email: "",
  heardFrom: "",
  rodoConsent: false,
  contactConsent: false,
  marketingConsent: false,
  website: "",
};

type Errors = Partial<Record<keyof FormState, string>>;

const TOTAL_STEPS = 7;

/** Walidacja pojedynczego kroku — blokuje „Dalej", dopóki krok nie jest kompletny. */
function validateStep(step: number, f: FormState): Errors {
  const e: Errors = {};
  if (step === 1) {
    if (f.name.trim().length < 3) e.name = "Podaj imię i nazwisko (min. 3 znaki).";
    const email = f.email.trim();
    if (!email) e.email = "Podaj adres e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "Ten adres e-mail wygląda na niepełny.";
    // Zgoda na kontakt stoi na PIERWSZYM kroku, nie na ostatnim. Powód jest biznesowy:
    // osoba, która porzuci aplikację w połowie, zostawiła już podstawę do przypomnienia
    // o dokończeniu WŁASNEGO zgłoszenia. Wcześniej zgoda wisiała na kroku 7 i porzucone
    // aplikacje były prawnie nie do ruszenia.
    if (!f.contactConsent) {
      e.contactConsent = "Bez zgody na kontakt nie mamy jak przekazać Ci decyzji w sprawie aplikacji.";
    }
  }
  if (step === 2) {
    if (!f.category) e.category = "Wybierz kategorię szkolenia.";
    if (!f.voivodeship) e.voivodeship = "Wybierz województwo — od niego zależy operator dofinansowania.";
    if (f.city.trim().length < 2) e.city = "Podaj miasto — pomoże dobrać akademię w dojeździe.";
  }
  if (step === 3) {
    if (!f.employmentForm) e.employmentForm = "Wybierz formę zatrudnienia.";
    // Grupa WYMAGANA. Pytanie nieobowiązkowe zamieniłoby dawne „nie wiem" na pustą wartość —
    // ta sama ślepota, inny kształt. „Żadne z powyższych" jest pełnoprawną odpowiedzią.
    if (f.eligibility.length === 0) {
      e.eligibility = "Zaznacz, co Cię dotyczy — albo „Żadne z powyższych”.";
    }
  }
  if (step === 4) {
    if (!f.goal) e.goal = "Wybierz, co jest dla Ciebie najważniejsze.";
  }
  if (step === 6) {
    const phone = f.phone.trim();
    if (phone.length < 9) e.phone = "Podaj numer telefonu — min. 9 cyfr.";
    else if (!/^[+\d\s-]+$/.test(phone)) e.phone = "Numer może zawierać tylko cyfry, spacje, myślnik i +.";
  }
  if (step === 7) {
    if (!f.rodoConsent) e.rodoConsent = "Bez tej zgody nie możemy przekazać Twojego zgłoszenia trenerce.";
    // `contactConsent` NIE jest już sprawdzana tutaj — zebraliśmy ją na kroku 1 i bez niej
    // aplikacja nie ruszyła z miejsca. Nadal lustruje `leadSchema.contactConsent`
    // (`src/lib/validators.ts`, `z.literal(true)`), więc backend odrzuca zgłoszenie bez niej.
    // Te dwa miejsca muszą zmieniać się RAZEM — przeniesienie wymogu w UI bez zmiany walidatora
    // (albo odwrotnie) psuje formularz po cichu.
  }
  return e;
}

export function Quiz({ courseId, defaultCategory, defaultVoivodeship }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    ...INITIAL,
    category: defaultCategory ?? "",
    voivodeship: defaultVoivodeship ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Fokus na nagłówek kroku przy każdej zmianie — czytnik ekranu ogłasza nowy krok,
  // a użytkowniczka na mobile nie zostaje wzrokiem na dole poprzedniego ekranu.
  //
  // 🔴 ALE NIE przy pierwszym renderze. Wcześniej `scrollIntoView` odpalał się też na wejściu,
  // więc strona sama zjeżdżała do nagłówka quizu i otwierała się „w dolnej części" —
  // użytkowniczka nie widziała nagłówka strony ani tego, po co tu w ogóle jest.
  // Zgłoszone przez Bartka 13.09 przy pierwszym teście.
  const pierwszyRender = useRef(true);
  useEffect(() => {
    if (pierwszyRender.current) {
      pierwszyRender.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  /**
   * Klucz sesji quizu — ten sam wiersz w `quiz_sessions` jest aktualizowany przy każdym kroku.
   * Trzymany w `sessionStorage`, więc odświeżenie strony nie tworzy duplikatu, a zamknięcie
   * karty kończy sesję.
   */
  const sessionKey = useRef<string>("");
  if (typeof window !== "undefined" && !sessionKey.current) {
    const istniejacy = window.sessionStorage.getItem("ub_quiz_session");
    sessionKey.current = istniejacy ?? crypto.randomUUID();
    window.sessionStorage.setItem("ub_quiz_session", sessionKey.current);
  }

  /**
   * Zapis postępu — „kto i gdzie przerwał". Celowo `void` i bez `await`: to jest telemetria,
   * która NIGDY nie może opóźnić ani zablokować przejścia do kolejnego kroku.
   */
  function zapiszPostep(krok: number, f: FormState, extra?: { completed?: boolean; leadId?: number }) {
    if (!sessionKey.current) return;
    const utm = getUtm();
    void fetch("/api/quiz-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true, // dolatuje nawet gdy użytkowniczka zamyka kartę
      body: JSON.stringify({
        sessionKey: sessionKey.current,
        step: krok,
        name: f.name,
        email: f.email,
        phone: f.phone,
        category: f.category,
        voivodeship: f.voivodeship,
        city: f.city,
        contactConsent: f.contactConsent,
        marketingConsent: f.marketingConsent,
        answers: f as unknown as Record<string, unknown>,
        ...utm,
        ...extra,
      }),
    }).catch(() => {});
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  const err = (field: keyof Errors) =>
    errors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `quiz-err-${field}` }
      : {};

  /**
   * „Żadne z powyższych" wyklucza się z resztą i odwrotnie — inaczej dałoby się oddać
   * odpowiedź sprzeczną („mam 55 lat" + „żadne z powyższych"), której nikt nie umiałby
   * odczytać przy telefonie.
   */
  function toggleEligibility(value: string) {
    setForm((f) => {
      const has = f.eligibility.includes(value);
      if (value === ELIGIBILITY_NONE) return { ...f, eligibility: has ? [] : [ELIGIBILITY_NONE] };
      const bez = f.eligibility.filter((v) => v !== ELIGIBILITY_NONE && v !== value);
      return { ...f, eligibility: has ? bez : [...bez, value] };
    });
    if (errors.eligibility) setErrors((e) => ({ ...e, eligibility: undefined }));
  }

  function toggleInterest(value: string) {
    setForm((f) => ({
      ...f,
      alsoInterestedIn: f.alsoInterestedIn.includes(value)
        ? f.alsoInterestedIn.filter((v) => v !== value)
        : [...f.alsoInterestedIn, value],
    }));
  }

  /**
   * Kroki 3 i 5 mają dużo opcji — na telefonie jedyne wymagane pole bywa u góry ekranu,
   * a „Dalej" na dole. Bez tego kliknięcie „Dalej" z pustym polem wyglądało jak martwy
   * przycisk: błąd renderował się poza widocznym obszarem, nic nie było widać na ekranie.
   * Szukamy pierwszego oznaczonego `aria-invalid` (radiogrupy oznaczają WSZYSTKIE swoje
   * inputy, więc trafiamy na pierwszy w DOM — czyli pierwszą opcję danego pytania).
   */
  function scrollToFirstError() {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
    });
  }

  function goNext() {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      scrollToFirstError();
      return;
    }
    zapiszPostep(step, form);           // stan PO ukończeniu tego kroku
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const found = validateStep(TOTAL_STEPS, form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      scrollToFirstError();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const employmentOption = EMPLOYMENT_FORM_OPTIONS.find((o) => o.label === form.employmentForm);
    // Kryteria składamy w zdania, a nie w kody — `message` czyta człowiek przed telefonem,
    // nie parser. „Żadne z powyższych" zapisujemy JAWNIE: cisza w tym miejscu znaczyłaby
    // „nie zapytaliśmy", a właśnie z tej dwuznaczności wyszliśmy, kasując „nie wiem".
    const eligibilityLabel = form.eligibility.includes(ELIGIBILITY_NONE)
      ? "żadne z wymienionych kryteriów"
      : ELIGIBILITY_OPTIONS.filter((o) => form.eligibility.includes(o.value))
          .map((o) => o.label.toLowerCase())
          .join("; ");

    const messageParts: string[] = [];
    if (form.employmentForm) messageParts.push(`Forma zatrudnienia (dosłownie): ${form.employmentForm}`);
    if (form.postalCode.trim()) messageParts.push(`Kod pocztowy: ${form.postalCode.trim()}`);
    if (eligibilityLabel) messageParts.push(`Kryteria wyższego dofinansowania: ${eligibilityLabel}`);
    if (form.eligibility.includes("inne_do_rozmowy")) {
      messageParts.push("⚠️ Zaznaczyła, że jest coś jeszcze — zapytaj przez telefon (nie zapisujemy kategorii).");
    }
    if (form.alsoInterestedIn.length > 0) {
      messageParts.push(`Interesuje ją też (multi-sell): ${form.alsoInterestedIn.join(", ")}`);
    }
    if (form.goal) messageParts.push(`Cel: ${form.goal}`);
    if (form.ageRange) messageParts.push(`Wiek: ${form.ageRange}`);
    if (form.worksInBeauty) messageParts.push(`Pracuje już w beauty: ${form.worksInBeauty === "tak" ? "tak" : "nie"}`);
    if (form.heardFrom) messageParts.push(`Skąd wie o nas: ${form.heardFrom}`);

    const travelOption = TRAVEL_OPTIONS.find((t) => String(t.km) === form.travelKm);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      voivodeship: form.voivodeship,
      category: form.category,
      employmentStatus: employmentOption?.employmentStatus ?? "inna",
      preferredDate: form.preferredDate.trim(),
      city: form.city.trim(),
      hasBusinessActivity: form.hasBusinessActivity === "tak" ? true : form.hasBusinessActivity === "nie" ? false : undefined,
      travelKm: travelOption ? travelOption.km : undefined,
      message: messageParts.join("\n"),
      rodoConsent: form.rodoConsent,
      contactConsent: form.contactConsent,
      marketingConsent: form.marketingConsent,
      website: form.website, // honeypot
      courseId: courseId ?? null,
      source: "quiz" as const,
      ...getUtm(),
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.field) setErrors({ [data.field]: data.error } as Errors);
        setSubmitError(data.error ?? "Coś poszło nie tak. Spróbuj ponownie lub napisz do nas.");
        setSubmitting(false);
        return;
      }
      try {
        sessionStorage.setItem(
          LEAD_SEGMENT_KEY,
          JSON.stringify({ voivodeship: payload.voivodeship, category: payload.category, source: "quiz" })
        );
      } catch {
        /* brak storage = konwersja bez segmentacji, ale nadal się liczy */
      }
      // Domknięcie sesji quizu — dzięki temu w panelu widać różnicę między „przerwała"
      // a „dokończyła", a lead ma powiązanie z sesją, w której powstał.
      zapiszPostep(TOTAL_STEPS, form, { completed: true, leadId: typeof data?.id === "number" ? data.id : undefined });
      router.push("/dziekujemy");
    } catch {
      setSubmitError("Błąd połączenia. Spróbuj ponownie.");
      setSubmitting(false);
    }
  }

  const pct = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submitting} className="space-y-6">
      {/* honeypot — ukryty dla ludzi, obecny na każdym kroku */}
      <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
        <label>
          Nie wypełniaj tego pola
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </label>
      </div>

      {/* PASEK POSTĘPU */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span>
            Aplikacja — krok {step} z {TOTAL_STEPS}
          </span>
          <span>{pct}%</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Postęp wypełniania: krok ${step} z ${TOTAL_STEPS}`}
        >
          <div className="h-full rounded-full bg-sand-400 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* KROK 2 — kategoria + województwo + miasto */}
      {/* KROK 1 — imię i e-mail NAJPIERW. Dzięki temu mamy kontakt nawet gdy quiz zostanie
          porzucony w połowie (zapis przez /api/quiz-progress). Zgoda marketingowa stoi TU,
          bo bez niej do osoby, która nie dokończyła, NIE WOLNO napisać maila (art. 398 PKE). */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-36 font-serif text-xl font-bold outline-none">
            Rozpocznij aplikację
          </h2>
          <p className="text-sm text-muted">
            Na podstawie aplikacji sprawdzimy, jakie dofinansowanie Ci przysługuje,
            i dobierzemy certyfikowaną akademię.
          </p>
          <div>
            <label className="label" htmlFor="q-name">Imię i nazwisko *</label>
            <input id="q-name" type="text" autoComplete="name" className="input" placeholder="np. Anna Kowalska" value={form.name} onChange={(e) => set("name", e.target.value)} {...err("name")} />
            {errors.name && <p id="quiz-err-name" role="alert" className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label className="label" htmlFor="q-email">Adres e-mail *</label>
            <input id="q-email" type="email" autoComplete="email" className="input" placeholder="np. anna@email.pl" value={form.email} onChange={(e) => set("email", e.target.value)} {...err("email")} />
            {errors.email && <p id="quiz-err-email" role="alert" className="field-error">{errors.email}</p>}
            <p className="mt-1.5 text-xs text-muted">
              Na ten adres wyślemy decyzję w sprawie Twojej aplikacji.
            </p>
          </div>
          {/* Zgoda WYMAGANA — dotyczy tej aplikacji, nie marketingu. Rozdzielenie jest celowe:
              uzależnienie usługi od zgody marketingowej łamie art. 7 ust. 4 RODO. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-sand-200 bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-sand-700"
              checked={form.contactConsent}
              onChange={(e) => set("contactConsent", e.target.checked)}
              {...err("contactConsent")}
            />
            <span className="text-ink">
              Zgadzam się na kontakt w sprawie mojej aplikacji — e-mailem, telefonicznie lub SMS-em —
              ze strony Uniwersytetu Beauty oraz dopasowanych trenerek. Obejmuje to przypomnienie
              o dokończeniu aplikacji, jeśli jej nie złożę. *
            </span>
          </label>
          {errors.contactConsent && (
            <p id="quiz-err-contactConsent" role="alert" className="field-error">{errors.contactConsent}</p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-sand-50 p-3 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-sand-700"
              checked={form.marketingConsent}
              onChange={(e) => set("marketingConsent", e.target.checked)}
            />
            <span>
              Dodatkowo chcę dostawać e-mailem informacje o nowych naborach i terminach szkoleń
              z dofinansowaniem. Ta zgoda jest dobrowolna — aplikacja działa bez niej — i mogę ją
              wycofać w każdej chwili.
            </span>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-36 font-serif text-xl font-bold outline-none">
            Jakiego szkolenia szukasz?
          </h2>
          <div>
            <label className="label" htmlFor="q-category">Kategoria szkolenia *</label>
            <select
              id="q-category"
              className="input"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              {...err("category")}
            >
              <option value="" disabled>Wybierz kategorię</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <p id="quiz-err-category" role="alert" className="field-error">{errors.category}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="q-voiv">Województwo *</label>
              <select
                id="q-voiv"
                className="input"
                value={form.voivodeship}
                onChange={(e) => set("voivodeship", e.target.value)}
                {...err("voivodeship")}
              >
                <option value="" disabled>Wybierz województwo</option>
                {VOIVODESHIPS.map((v) => (
                  <option key={v.slug} value={v.slug}>{v.name}</option>
                ))}
              </select>
              {errors.voivodeship && <p id="quiz-err-voivodeship" role="alert" className="field-error">{errors.voivodeship}</p>}
            </div>
            <div>
              <label className="label" htmlFor="q-city">Miasto *</label>
              <input
                id="q-city"
                type="text"
                className="input"
                placeholder="np. Katowice"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                {...err("city")}
              />
              {errors.city && <p id="quiz-err-city" role="alert" className="field-error">{errors.city}</p>}
            </div>
          </div>
          {/* Kod pocztowy za formularzem Akademii Kachel. U nas ma jeden konkretny użytek:
              operatorzy BUR dzielą województwa na subregiony, a akademię dobieramy po odległości.
              Sama nazwa miasta bywa dwuznaczna (Lubanie ≠ Lubania) — kod nie jest. */}
          <div className="sm:w-1/2 sm:pr-2">
            <label className="label" htmlFor="q-postal">Kod pocztowy</label>
            <input
              id="q-postal"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              className="input"
              placeholder="np. 43-100"
              maxLength={6}
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* KROK 3 — sytuacja zawodowa i uprawnienia do dofinansowania */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-36 font-serif text-xl font-bold outline-none">
            Twoja sytuacja
          </h2>
          <p className="text-sm text-muted">Od tego zależy, ile dofinansowania możesz dostać.</p>

          <fieldset>
            <legend className="label">Forma zatrudnienia *</legend>
            <div className="space-y-2">
              {EMPLOYMENT_FORM_OPTIONS.map((o) => (
                <label key={o.label} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[10px] border-2 border-sand-600 px-4 py-2.5 text-sm text-ink has-[:checked]:bg-sand-400 has-[:checked]:text-ink-soft has-[:checked]:font-semibold">
                  <input
                    type="radio"
                    name="q-employment"
                    className="h-4 w-4 shrink-0 accent-sand-700"
                    checked={form.employmentForm === o.label}
                    onChange={() => set("employmentForm", o.label)}
                    {...err("employmentForm")}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {errors.employmentForm && <p id="quiz-err-employmentForm" role="alert" className="field-error">{errors.employmentForm}</p>}
          </fieldset>

          <fieldset>
            <legend className="label">Czy prowadzisz działalność gospodarczą?</legend>
            {/* Definicja przy pytaniu, nie w domyśle — to ona zastąpiła opcję „nie wiem”.
                Sformułowanie za formularzem Akademii Kachel (art. 4 ust. 1-2 Prawa
                przedsiębiorców), bo to ta definicja decyduje o ścieżce finansowania. */}
            <p className="mb-2 text-xs text-muted">
              Liczy się jednoosobowa działalność i wspólniczka spółki cywilnej — <strong>także zawieszona</strong>.
            </p>
            <div className="flex flex-wrap gap-3">
              {(["tak", "nie"] as const).map((v) => (
                <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-sand-600 px-4 py-2 text-sm font-semibold text-ink has-[:checked]:bg-sand-400 has-[:checked]:text-ink-soft">
                  <input
                    type="radio"
                    name="q-business"
                    className="sr-only"
                    checked={form.hasBusinessActivity === v}
                    onChange={() => set("hasBusinessActivity", v)}
                  />
                  {v === "tak" ? "Tak" : "Nie"}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Czy któreś z tych zdań jest o Tobie? *</legend>
            <p className="mb-2 text-xs text-muted">
              Każde z nich może podnieść Twój poziom dofinansowania. Zaznacz wszystkie, które pasują.
            </p>
            <div className="space-y-2">
              {ELIGIBILITY_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[10px] border-2 border-sand-600 px-4 py-2.5 text-sm text-ink has-[:checked]:bg-sand-400 has-[:checked]:font-semibold has-[:checked]:text-ink-soft"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-sand-700"
                    checked={form.eligibility.includes(o.value)}
                    onChange={() => toggleEligibility(o.value)}
                    {...err("eligibility")}
                  />
                  <span>
                    {o.label}
                    {"hint" in o && o.hint && <span className="block text-xs font-normal text-muted">{o.hint}</span>}
                  </span>
                </label>
              ))}
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[10px] border-2 border-dashed border-sand-600 px-4 py-2.5 text-sm text-ink has-[:checked]:bg-sand-400 has-[:checked]:font-semibold has-[:checked]:text-ink-soft">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-sand-700"
                  checked={form.eligibility.includes(ELIGIBILITY_NONE)}
                  onChange={() => toggleEligibility(ELIGIBILITY_NONE)}
                />
                Żadne z powyższych
              </label>
            </div>
            {errors.eligibility && <p id="quiz-err-eligibility" role="alert" className="field-error">{errors.eligibility}</p>}
          </fieldset>
        </div>
      )}

      {/* KROK 4 — cel i doświadczenie */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-36 font-serif text-xl font-bold outline-none">
            Co chcesz osiągnąć?
          </h2>
          <fieldset>
            <legend className="label">Co jest dla Ciebie najważniejsze? *</legend>
            <div className="space-y-2">
              {GOAL_OPTIONS.map((g) => (
                <label key={g} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[10px] border-2 border-sand-600 px-4 py-2.5 text-sm text-ink has-[:checked]:bg-sand-400 has-[:checked]:text-ink-soft has-[:checked]:font-semibold">
                  <input
                    type="radio"
                    name="q-goal"
                    className="h-4 w-4 shrink-0 accent-sand-700"
                    checked={form.goal === g}
                    onChange={() => set("goal", g)}
                    {...err("goal")}
                  />
                  {g}
                </label>
              ))}
            </div>
            {errors.goal && <p id="quiz-err-goal" role="alert" className="field-error">{errors.goal}</p>}
          </fieldset>

          <fieldset>
            <legend className="label">Czy pracujesz już w branży beauty?</legend>
            <div className="flex flex-wrap gap-3">
              {(["tak", "nie"] as const).map((v) => (
                <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-sand-600 px-4 py-2 text-sm font-semibold text-ink has-[:checked]:bg-sand-400 has-[:checked]:text-ink-soft">
                  <input
                    type="radio"
                    name="q-works"
                    className="sr-only"
                    checked={form.worksInBeauty === v}
                    onChange={() => set("worksInBeauty", v)}
                  />
                  {v === "tak" ? "Tak" : "Nie"}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Multi-sell: model zakłada sprzedanie jednego leada 2-3 akademiom. Kandydatka
              zainteresowana rzęsami I paznokciami ma dwóch adresatów zamiast jednego.
              Pytanie z formularza Akademii Kachel („Jakie szkolenia Cię interesują?"),
              ale na NASZEJ taksonomii CATEGORIES — tej samej, po której matchujemy.
              ⚠️ Dziś to informacja DO TELEFONU (ląduje w karcie leada), nie automat:
              przydział nadal idzie po kategorii głównej. */}
          <fieldset>
            <legend className="label">Jakie jeszcze szkolenia Cię interesują?</legend>
            <p className="mb-2 text-xs text-muted">Możesz zaznaczyć kilka albo pominąć.</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => c !== form.category).map((c) => (
                <label key={c} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-sand-600 px-4 py-2 text-sm font-semibold text-ink has-[:checked]:bg-sand-400 has-[:checked]:text-ink-soft">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.alsoInterestedIn.includes(c)}
                    onChange={() => toggleInterest(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* KROK 5 — o Tobie */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-36 font-serif text-xl font-bold outline-none">
            Kilka słów o Tobie
          </h2>
          <div>
            <label className="label" htmlFor="q-age">Przedział wiekowy</label>
            <select id="q-age" className="input" value={form.ageRange} onChange={(e) => set("ageRange", e.target.value)}>
              <option value="">Wolę nie podawać</option>
              {AGE_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="q-date">Preferowany termin</label>
              <input id="q-date" type="text" className="input" placeholder="np. weekendy, od marca" value={form.preferredDate} onChange={(e) => set("preferredDate", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="q-travel">Gotowość dojazdu na szkolenie</label>
              <select id="q-travel" className="input" value={form.travelKm} onChange={(e) => set("travelKm", e.target.value)}>
                <option value="">Wybierz</option>
                {TRAVEL_OPTIONS.map((t) => (
                  <option key={t.km} value={t.km}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KROK 6 — dane kontaktowe */}
      {step === 6 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-36 font-serif text-xl font-bold outline-none">
            Gdzie się z Tobą skontaktować?
          </h2>
          <div>
            <label className="label" htmlFor="q-phone">Telefon *</label>
            <input id="q-phone" type="tel" autoComplete="tel" className="input" placeholder="np. 512 345 678" value={form.phone} onChange={(e) => set("phone", e.target.value)} {...err("phone")} />
            {errors.phone && <p id="quiz-err-phone" role="alert" className="field-error">{errors.phone}</p>}
          </div>
          <div>
            <label className="label" htmlFor="q-heard">Skąd o nas wiesz?</label>
            <select id="q-heard" className="input" value={form.heardFrom} onChange={(e) => set("heardFrom", e.target.value)}>
              <option value="">Wybierz</option>
              {HEARD_FROM_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* KROK 7 — zgody + wysyłka */}
      {step === 7 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-36 font-serif text-xl font-bold outline-none">
            Złóż aplikację
          </h2>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-sand-700"
                checked={form.rodoConsent}
                onChange={(e) => set("rodoConsent", e.target.checked)}
                {...err("rodoConsent")}
              />
              <span>
                Wyrażam zgodę na przetwarzanie moich danych osobowych i przekazanie ich maksymalnie trzem
                trenerkom współpracującym z Uniwersytetem Beauty, dopasowanym do wybranej kategorii szkolenia i
                województwa, w celu przedstawienia mi oferty, zgodnie z{" "}
                <a href="/polityka-prywatnosci" target="_blank" rel="noopener" className="font-semibold text-sand-700 underline">
                  polityką prywatności
                </a>
                . *
              </span>
            </label>
            {errors.rodoConsent && <p id="quiz-err-rodoConsent" role="alert" className="field-error">{errors.rodoConsent}</p>}

            {/* Zgoda na kontakt oraz marketingowa są zbierane na KROKU 1 — obie muszą istnieć,
                ZANIM ktokolwiek porzuci aplikację w połowie. Tutaj tylko przypominamy stan,
                bez drugiego checkboxa: dwa pola sterujące tą samą wartością to prosta droga
                do przypadkowego odznaczenia tuż przed wysłaniem. */}
            <p className="text-sm text-muted">
              ✓ Zgodziłaś się na kontakt w sprawie tej aplikacji (e-mail, telefon, SMS).
            </p>
            {form.marketingConsent && (
              <p className="text-sm text-muted">
                ✓ Zgodziłaś się na e-maile o naborach i terminach szkoleń. Możesz to wycofać w każdej chwili.
              </p>
            )}

            <p className="text-xs text-muted">
              Zgody oznaczone * są niezbędne, żebyśmy mogli przekazać zgłoszenie trenerce. Każdą zgodę możesz
              wycofać w dowolnym momencie, pisząc na biuro@uniwersytetbeauty.pl.
            </p>
          </div>

          {submitError && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </p>
          )}
        </div>
      )}

      {/* NAWIGACJA */}
      <div className="flex items-center gap-3 pt-2">
        {step > 1 && (
          <button type="button" onClick={goBack} className="btn-outline !px-6" disabled={submitting}>
            Wstecz
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button type="button" onClick={goNext} className="btn-primary flex-1">
            Dalej
          </button>
        ) : (
          <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-60 disabled:hover:translate-y-0">
            {submitting ? "Wysyłanie..." : "Aplikuj o dofinansowanie"}
          </button>
        )}
      </div>
      {step === TOTAL_STEPS && (
        <p className="text-center text-xs text-muted">Odpowiemy na Twoją aplikację w ciągu 24 h. Zero spamu.</p>
      )}
    </form>
  );
}
