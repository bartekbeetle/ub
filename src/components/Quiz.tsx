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

const EDUCATION_OPTIONS = ["Podstawowe", "Zawodowe", "Średnie", "Student(ka)", "Wyższe"] as const;

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

type YesNoUnknown = "" | "tak" | "nie" | "nie_wiem";

type FormState = {
  category: string;
  voivodeship: string;
  city: string;
  employmentForm: string; // label z EMPLOYMENT_FORM_OPTIONS
  hasBusinessActivity: "" | "tak" | "nie" | "nie_wiem";
  education: string;
  /**
   * Neutralne pytanie o grupę uprawnioną do wyższego dofinansowania — ŚWIADOMIE bez
   * wyliczania kategorii (niepełnosprawność, mniejszość narodowa, bezdomność). Te dane
   * to kategorie szczególne z art. 9 RODO; nie zbieramy ich w dniu startu kampanii bez
   * opinii prawnika. "Nie wiem — sprawdźcie za mnie" daje ten sam sygnał do telefonu,
   * bez gromadzenia niczego wrażliwego.
   */
  eligibleGroup: YesNoUnknown;
  goal: string;
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
  employmentForm: "",
  hasBusinessActivity: "",
  education: "",
  eligibleGroup: "",
  goal: "",
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
  }
  if (step === 2) {
    if (!f.category) e.category = "Wybierz kategorię szkolenia.";
    if (!f.voivodeship) e.voivodeship = "Wybierz województwo — od niego zależy operator dofinansowania.";
    if (f.city.trim().length < 2) e.city = "Podaj miasto — pomoże dobrać akademię w dojeździe.";
  }
  if (step === 3) {
    if (!f.employmentForm) e.employmentForm = "Wybierz formę zatrudnienia.";
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
    // 🔴 `contactConsent` jest CELOWO NIEwymagana — tak samo jak w formularzu na produkcji.
    // Uzależnienie wysłania zgłoszenia od zgody na konkretny kanał kontaktu to potencjalne
    // „związanie" zgody z art. 7 ust. 4 RODO, a tego pytania prawnik jeszcze nie rozstrzygnął
    // (`docs/prawne/PYTANIA-DO-PRAWNIKA.md` → pytanie 1, warianty A/B).
    // Konsekwencja operacyjna: część leadów przyjdzie bez zgody na telefon i wolno nam wtedy
    // pisać wyłącznie mailem — panel pokazuje to wprost jako „brak, nie dzwonić".
    // Gdy padnie odpowiedź na wariant A, przywrócenie wymogu to JEDNA linia tutaj.
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

  function goNext() {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
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
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const employmentOption = EMPLOYMENT_FORM_OPTIONS.find((o) => o.label === form.employmentForm);
    const eligibleGroupLabel =
      form.eligibleGroup === "tak" ? "tak" : form.eligibleGroup === "nie" ? "nie" : form.eligibleGroup === "nie_wiem" ? "nie wiem — sprawdźcie za mnie" : "";

    const messageParts: string[] = [];
    if (form.employmentForm) messageParts.push(`Forma zatrudnienia (dosłownie): ${form.employmentForm}`);
    if (form.education) messageParts.push(`Wykształcenie: ${form.education}`);
    if (eligibleGroupLabel) messageParts.push(`Grupa uprawniona do wyższego dofinansowania: ${eligibleGroupLabel}`);
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
      hasBusinessActivity:
        form.hasBusinessActivity === "tak" ? true : form.hasBusinessActivity === "nie" ? false : undefined,
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
            Krok {step} z {TOTAL_STEPS}
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
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold outline-none">
            Zacznijmy od podstaw
          </h2>
          <p className="text-sm text-muted">
            Sprawdzimy, jakie dofinansowanie Ci przysługuje. Zajmie to około dwóch minut.
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
              Na ten adres wyślemy podsumowanie tego, co Ci przysługuje.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-sand-50 p-3 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-sand-700"
              checked={form.marketingConsent}
              onChange={(e) => set("marketingConsent", e.target.checked)}
            />
            <span>
              Chcę dostawać e-mailem informacje o naborach i terminach szkoleń z dofinansowaniem.
              Zgoda jest dobrowolna i mogę ją wycofać w każdej chwili.
            </span>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold outline-none">
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
        </div>
      )}

      {/* KROK 3 — sytuacja zawodowa i uprawnienia do dofinansowania */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold outline-none">
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
            <legend className="label">Czy prowadzisz działalność gospodarczą (także zawieszoną)?</legend>
            <div className="flex flex-wrap gap-3">
              {(["tak", "nie", "nie_wiem"] as const).map((v) => (
                <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-sand-600 px-4 py-2 text-sm font-semibold text-ink has-[:checked]:bg-sand-400 has-[:checked]:text-ink-soft">
                  <input
                    type="radio"
                    name="q-business"
                    className="sr-only"
                    checked={form.hasBusinessActivity === v}
                    onChange={() => set("hasBusinessActivity", v)}
                  />
                  {v === "tak" ? "Tak" : v === "nie" ? "Nie" : "Nie wiem"}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="label" htmlFor="q-education">Wykształcenie</label>
            <select id="q-education" className="input" value={form.education} onChange={(e) => set("education", e.target.value)}>
              <option value="">Wolę nie podawać</option>
              {EDUCATION_OPTIONS.map((ed) => (
                <option key={ed} value={ed}>{ed}</option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="label">Czy należysz do grupy uprawnionej do wyższego poziomu dofinansowania?</legend>
            <div className="flex flex-wrap gap-3">
              {([
                ["tak", "Tak"],
                ["nie", "Nie"],
                ["nie_wiem", "Nie wiem — sprawdźcie za mnie"],
              ] as const).map(([v, label]) => (
                <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-sand-600 px-4 py-2 text-sm font-semibold text-ink has-[:checked]:bg-sand-400 has-[:checked]:text-ink-soft">
                  <input
                    type="radio"
                    name="q-eligible"
                    className="sr-only"
                    checked={form.eligibleGroup === v}
                    onChange={() => set("eligibleGroup", v)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* KROK 4 — cel i doświadczenie */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold outline-none">
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
        </div>
      )}

      {/* KROK 5 — o Tobie */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold outline-none">
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
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold outline-none">
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
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-bold outline-none">
            Ostatni krok
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

            <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-sand-700"
                checked={form.contactConsent}
                onChange={(e) => set("contactConsent", e.target.checked)}
                {...err("contactConsent")}
              />
              <span>
                Wyrażam zgodę na kontakt telefoniczny i SMS — ze strony Uniwersytetu Beauty oraz dopasowanych
                trenerek — w celu omówienia szkolenia i dofinansowania. *
              </span>
            </label>
            {errors.contactConsent && <p id="quiz-err-contactConsent" role="alert" className="field-error">{errors.contactConsent}</p>}

            {/* Zgoda marketingowa przeniesiona na KROK 1 (obok e-maila) — musi być zebrana
                zanim ktokolwiek porzuci quiz, bo inaczej do osoby, która go nie dokończyła,
                nie wolno napisać maila. Tutaj tylko przypominamy stan, bez drugiego checkboxa:
                dwa pola sterujące tą samą wartością to prosta droga do przypadkowego odznaczenia. */}
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
        <p className="text-center text-xs text-muted">Skontaktujemy się z Tobą w ciągu 24h. Zero spamu.</p>
      )}
    </form>
  );
}
