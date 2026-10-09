"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { CATEGORIES, SUBSIDY_RANGE, VOIVODESHIPS } from "@/lib/constants";
import { LEAD_SEGMENT_KEY } from "@/components/LeadConversion";
import { CONSENT_EVENT, readConsent } from "@/lib/consent";
import { trackEvent } from "@/lib/tracking-events";
import {
  AGE_OPTIONS,
  ELIGIBILITY_NONE,
  ELIGIBILITY_OPTIONS,
  EMPLOYMENT_FORM_OPTIONS,
  GOAL_OPTIONS,
  HEARD_FROM_OPTIONS,
  INITIAL,
  TRAVEL_OPTIONS,
  buildLeadPayload,
  saveQuizProgress,
  validateStep,
  type FormState,
} from "@/lib/quiz-form";

/**
 * CZAT „DORADCA" — ta sama aplikacja o dofinansowanie co `/aplikacja`, tylko w formie rozmowy
 * w prawym dolnym rogu strony (decyzja Bartka 09.10.2026: „przechwycić więcej kontaktów").
 *
 * 🔴 Świadomie BEZ modelu AI. Pytania mają zamknięte odpowiedzi, a każde zdanie o dofinansowaniu
 * musi trzymać kanon (`SUBSIDY_RANGE`, nigdy „0 zł" ani procent dla konkretnego województwa).
 * Model językowy prędzej czy później obiecałby kwotę — skrypt nie obieca.
 *
 * Opcje, walidacja i payload pochodzą z `lib/quiz-form.ts` (wspólne z `Quiz.tsx`), lead idzie
 * do `/api/lead` z `source: "quiz"` i pierwszą linią `message` „Kanał: czat na stronie".
 *
 * KOLEJNOŚĆ INNA NIŻ W QUIZIE, celowo: quiz zaczyna od imienia i e-maila, bo stoi na stronie,
 * na którą ktoś już przyszedł aplikować. Czat zaczepia osobę, która tylko czyta — otwarcie
 * rozmowy prośbą o e-mail zabiłoby ją na wejściu. Najpierw pytania kwalifikujące („czy mi się
 * należy?"), potem kontakt + zgoda na kontakt (od tej chwili porzucona rozmowa jest w panelu
 * „porzucone" i można przypomnieć o dokończeniu), na końcu pytania dodatkowe i zgoda RODO.
 */

type Option = { label: string; value: string };

type Question =
  | {
      id: string;
      kind: "chips";
      /** Numer kroku w quizie, pod którym ten sam zestaw pól siedzi w `/aplikacja` — zapis postępu. */
      quizStep: number;
      ask: (f: FormState) => string[];
      options: (f: FormState) => Option[];
      skippable?: boolean;
      apply: (f: FormState, value: string) => FormState;
    }
  | {
      id: string;
      kind: "multi";
      quizStep: number;
      ask: (f: FormState) => string[];
      options: (f: FormState) => Option[];
      /** Opcja wykluczająca resztę — wybrana od razu kończy pytanie. */
      exclusive?: Option;
      skippable?: boolean;
      required?: boolean;
      apply: (f: FormState, values: string[]) => FormState;
    }
  | {
      id: string;
      kind: "text";
      quizStep: number;
      ask: (f: FormState) => string[];
      field: "city" | "postalCode" | "preferredDate" | "name" | "email" | "phone";
      placeholder: string;
      inputType?: "text" | "email" | "tel";
      inputMode?: "text" | "numeric" | "email" | "tel";
      autoComplete?: string;
      skippable?: boolean;
    }
  | {
      id: string;
      kind: "consent";
      quizStep: number;
      ask: (f: FormState) => string[];
      /** Treść zgody — wyświetlana w całości nad przyciskiem, nie schowana za linkiem. */
      consent: React.ReactNode;
      agreeLabel: string;
      field: "contactConsent" | "rodoConsent";
    };

const yesNo: Option[] = [
  { label: "Tak", value: "tak" },
  { label: "Nie", value: "nie" },
];

const QUESTIONS: Question[] = [
  {
    id: "category",
    kind: "chips",
    quizStep: 2,
    ask: () => ["Jakiego szkolenia szukasz?"],
    options: () => CATEGORIES.map((c) => ({ label: c, value: c })),
    apply: (f, v) => ({ ...f, category: v, alsoInterestedIn: f.alsoInterestedIn.filter((c) => c !== v) }),
  },
  {
    id: "voivodeship",
    kind: "chips",
    quizStep: 2,
    ask: () => ["W jakim województwie mieszkasz? Od tego zależy, kto przyznaje dofinansowanie."],
    options: () => VOIVODESHIPS.map((v) => ({ label: v.name, value: v.slug })),
    apply: (f, v) => ({ ...f, voivodeship: v }),
  },
  {
    id: "city",
    kind: "text",
    quizStep: 2,
    ask: () => ["A miasto? Dobierzemy akademię w rozsądnym dojeździe."],
    field: "city",
    placeholder: "np. Katowice",
    autoComplete: "address-level2",
  },
  {
    id: "postalCode",
    kind: "text",
    quizStep: 2,
    ask: () => ["Podasz kod pocztowy? Nazwy miejscowości się powtarzają, kod nie."],
    field: "postalCode",
    placeholder: "np. 43-100",
    inputMode: "numeric",
    autoComplete: "postal-code",
    skippable: true,
  },
  {
    id: "employmentForm",
    kind: "chips",
    quizStep: 3,
    ask: () => ["Teraz Twoja sytuacja — od niej zależy poziom dofinansowania.", "Jaka jest Twoja forma zatrudnienia?"],
    options: () => EMPLOYMENT_FORM_OPTIONS.map((o) => ({ label: o.label, value: o.label })),
    apply: (f, v) => ({ ...f, employmentForm: v }),
  },
  {
    id: "hasBusinessActivity",
    kind: "chips",
    quizStep: 3,
    ask: () => [
      "Czy prowadzisz działalność gospodarczą? Liczy się też jednoosobowa, wspólniczka spółki cywilnej i działalność zawieszona.",
    ],
    options: () => yesNo,
    apply: (f, v) => ({ ...f, hasBusinessActivity: v as FormState["hasBusinessActivity"] }),
  },
  {
    id: "eligibility",
    kind: "multi",
    quizStep: 3,
    ask: () => ["Czy któreś z tych zdań jest o Tobie? Każde może podnieść dofinansowanie — zaznacz wszystkie pasujące."],
    options: () => ELIGIBILITY_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
    exclusive: { label: "Żadne z powyższych", value: ELIGIBILITY_NONE },
    required: true,
    apply: (f, vs) => ({ ...f, eligibility: vs }),
  },
  {
    id: "name",
    kind: "text",
    quizStep: 1,
    ask: () => [
      // Kanon dofinansowania: tylko `SUBSIDY_RANGE`, bez procentu dla konkretnego województwa
      // (wielkopolskie/dolnośląskie mają max 90% — „95%” byłoby tam nieprawdą).
      `Mam wszystko, żeby sprawdzić Twoje dofinansowanie. Przy szkoleniach z Bazy Usług Rozwojowych może ono pokryć ${SUBSIDY_RANGE} ceny kursu — dokładny poziom i limit na osobę ustala operator w Twoim województwie.`,
      "Zapiszę Twoje zgłoszenie. Jak masz na imię i nazwisko?",
    ],
    field: "name",
    placeholder: "np. Anna Kowalska",
    autoComplete: "name",
  },
  {
    id: "email",
    kind: "text",
    quizStep: 1,
    ask: (f) => [`Dzięki, ${f.name.trim().split(/\s+/)[0]}! Na jaki e-mail wysłać decyzję w sprawie aplikacji?`],
    field: "email",
    placeholder: "np. anna@email.pl",
    inputType: "email",
    inputMode: "email",
    autoComplete: "email",
  },
  {
    id: "contactConsent",
    kind: "consent",
    quizStep: 1,
    ask: () => ["Potrzebuję jeszcze Twojej zgody na kontakt w tej sprawie:"],
    consent: (
      <>
        Zgadzam się na kontakt w sprawie mojej aplikacji — e-mailem, telefonicznie lub SMS-em — ze strony
        Uniwersytetu Beauty oraz dopasowanych trenerek. Obejmuje to przypomnienie o dokończeniu aplikacji,
        jeśli jej nie złożę.
      </>
    ),
    agreeLabel: "Zgadzam się",
    field: "contactConsent",
  },
  {
    id: "marketingConsent",
    kind: "chips",
    quizStep: 1,
    ask: () => [
      "Chcesz dostawać e-mailem informacje o nowych naborach i terminach szkoleń z dofinansowaniem? To dobrowolne — aplikacja działa bez tego.",
    ],
    options: () => [
      { label: "Tak, chcę", value: "tak" },
      { label: "Nie, dziękuję", value: "nie" },
    ],
    apply: (f, v) => ({ ...f, marketingConsent: v === "tak" }),
  },
  {
    id: "phone",
    kind: "text",
    quizStep: 6,
    ask: () => ["Pod jaki numer może zadzwonić trenerka?"],
    field: "phone",
    placeholder: "np. 512 345 678",
    inputType: "tel",
    inputMode: "tel",
    autoComplete: "tel",
  },
  {
    id: "goal",
    kind: "chips",
    quizStep: 4,
    ask: () => ["Jeszcze kilka krótkich pytań, żeby trenerka lepiej dopasowała ofertę.", "Co jest dla Ciebie najważniejsze?"],
    options: () => GOAL_OPTIONS.map((g) => ({ label: g, value: g })),
    apply: (f, v) => ({ ...f, goal: v }),
  },
  {
    id: "worksInBeauty",
    kind: "chips",
    quizStep: 4,
    ask: () => ["Pracujesz już w branży beauty?"],
    options: () => yesNo,
    skippable: true,
    apply: (f, v) => ({ ...f, worksInBeauty: v as FormState["worksInBeauty"] }),
  },
  {
    id: "alsoInterestedIn",
    kind: "multi",
    quizStep: 4,
    ask: () => ["Interesują Cię jeszcze inne szkolenia? Możesz zaznaczyć kilka."],
    options: (f) => CATEGORIES.filter((c) => c !== f.category).map((c) => ({ label: c, value: c })),
    skippable: true,
    apply: (f, vs) => ({ ...f, alsoInterestedIn: vs }),
  },
  {
    id: "ageRange",
    kind: "chips",
    quizStep: 5,
    ask: () => ["W jakim jesteś wieku?"],
    options: () => [...AGE_OPTIONS.map((a) => ({ label: a, value: a })), { label: "Wolę nie podawać", value: "" }],
    apply: (f, v) => ({ ...f, ageRange: v }),
  },
  {
    id: "preferredDate",
    kind: "text",
    quizStep: 5,
    ask: () => ["Kiedy chciałabyś się szkolić?"],
    field: "preferredDate",
    placeholder: "np. weekendy, od marca",
    skippable: true,
  },
  {
    id: "travelKm",
    kind: "chips",
    quizStep: 5,
    ask: () => ["Jak daleko możesz dojeżdżać na szkolenie?"],
    options: () => TRAVEL_OPTIONS.map((t) => ({ label: t.label, value: String(t.km) })),
    skippable: true,
    apply: (f, v) => ({ ...f, travelKm: v }),
  },
  {
    id: "heardFrom",
    kind: "chips",
    quizStep: 6,
    ask: () => ["Ostatnie: skąd o nas wiesz?"],
    options: () => HEARD_FROM_OPTIONS.map((h) => ({ label: h, value: h })),
    skippable: true,
    apply: (f, v) => ({ ...f, heardFrom: v }),
  },
  {
    id: "rodoConsent",
    kind: "consent",
    quizStep: 7,
    ask: () => ["Gotowe. Żeby przekazać zgłoszenie trenerce, potrzebuję tej zgody:"],
    consent: (
      <>
        Wyrażam zgodę na przetwarzanie moich danych osobowych i przekazanie ich maksymalnie trzem trenerkom
        współpracującym z Uniwersytetem Beauty, dopasowanym do wybranej kategorii szkolenia i województwa, w celu
        przedstawienia mi oferty, zgodnie z{" "}
        <a href="/polityka-prywatnosci" target="_blank" rel="noopener" className="font-semibold text-sand-700 underline">
          polityką prywatności
        </a>
        . Każdą zgodę mogę wycofać, pisząc na biuro@uniwersytetbeauty.pl.
      </>
    ),
    agreeLabel: "Zgadzam się i wysyłam",
    field: "rodoConsent",
  },
];

/**
 * Persona: „Hania — wirtualna recepcjonistka". Zdjęcie wygenerowane (Ideogram, 09.10.2026; kandydatki
 * w `Sejf/Marketing/studio/photos/ub-czat/`), więc rozmowa MÓWI WPROST, że to automat — w nagłówku
 * i w pierwszym zdaniu. Twarz + imię podnoszą klikalność, ale udawanie człowieka podcięłoby
 * zaufanie przy pierwszym telefonie („to z kim ja pisałam?") i kłóciłoby się z jawnością
 * wobec użytkownika, której wymaga art. 50 AI Act przy botach.
 */
const PERSONA = { name: "Hania", role: "wirtualna recepcjonistka", avatar: "/images/czat/hania-192.jpg" };

const GREETING = [
  `Cześć! Jestem ${PERSONA.name}, wirtualna recepcjonistka Uniwersytetu Beauty. Nie jestem człowiekiem — zbieram Twoje odpowiedzi, a oddzwania prawdziwa osoba.`,
  "W 2 minuty sprawdzę, czy przysługuje Ci dofinansowanie do szkolenia, i dobiorę certyfikowaną akademię. Zaczynamy?",
];

/** Strony, na których czat przeszkadza: własny formularz, zakup, podziękowanie, strefa B2B dla akademii. */
const HIDDEN_PREFIXES = ["/aplikacja", "/poradnik-wlasny-salon", "/dziekujemy", "/wypisz", "/dla-akademii"];

const SESSION_KEY = "ub_czat_session";
const TEASER_KEY = "ub_czat_teaser"; // localStorage: dymek pokazany/zamknięty — nie wracamy z nim co wizytę
const CHANNEL_NOTE = "Kanał: czat na stronie (doradca)";

type Msg = { from: "bot" | "me"; text: React.ReactNode };

type Snapshot = { index: number; form: FormState; msgCount: number };

function safeGet(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* brak storage — dymek pokaże się ponownie, nic poza tym */
  }
}

export function ChatDoradca() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  /** -1 = powitanie przed pierwszym pytaniem; QUESTIONS.length = wysyłka/koniec. */
  const [index, setIndex] = useState(-1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [messages, setMessages] = useState<Msg[]>(GREETING.map((text) => ({ from: "bot", text })));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [draft, setDraft] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [typing, setTyping] = useState(false);
  const sessionKey = useRef("");
  const started = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const hidden = HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p));
  const question = index >= 0 && index < QUESTIONS.length ? QUESTIONS[index] : null;

  // Dymek zachęty: od razu po wejściu (decyzja Bartka 09.10). Wyjątek: telefon z nierozstrzygniętym
  // banerem cookies — tam oba elementy wchodzą na siebie, więc dymek czeka na kliknięcie w banerze.
  // Zamknięty krzyżykiem albo po otwarciu czatu nie wraca (`TEASER_KEY`).
  useEffect(() => {
    if (hidden || open || safeGet("local", TEASER_KEY)) return;
    const show = () => {
      if (!safeGet("local", TEASER_KEY)) setTeaser(true);
    };
    if (readConsent() !== null || window.matchMedia("(min-width: 768px)").matches) {
      show();
      return;
    }
    window.addEventListener(CONSENT_EVENT, show);
    return () => window.removeEventListener(CONSENT_EVENT, show);
  }, [hidden, open, pathname]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (open && question?.kind === "text") inputRef.current?.focus();
  }, [open, question]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (hidden) return null;

  function dismissTeaser() {
    setTeaser(false);
    safeSet("local", TEASER_KEY, "1");
  }

  function openChat() {
    dismissTeaser();
    setOpen(true);
  }

  function closeChat() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  function ensureSession() {
    if (sessionKey.current) return;
    sessionKey.current = safeGet("session", SESSION_KEY) ?? crypto.randomUUID();
    safeSet("session", SESSION_KEY, sessionKey.current);
  }

  /** Przejście do pytania `next` — bot „pisze" chwilę, żeby rozmowa nie wyglądała na formularz. */
  function goTo(next: number, f: FormState, mine: string | null) {
    setHistory((h) => [...h, { index, form, msgCount: messages.length }]);
    if (mine !== null) setMessages((m) => [...m, { from: "me", text: mine }]);
    setForm(f);
    setDraft("");
    setMulti([]);
    setError(null);
    setIndex(next);
    const q = QUESTIONS[next];
    if (!q) return;
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, ...q.ask(f).map((text) => ({ from: "bot" as const, text }))]);
    }, 450);
  }

  /** Odpowiedź na bieżące pytanie: zapis postępu i dalej. Ostatnie pytanie = wysyłka. */
  function answer(f: FormState, mine: string) {
    if (!question) return;
    if (!started.current) {
      started.current = true;
      trackEvent("quiz_start", { content_name: "czat-doradca" });
    }
    saveQuizProgress(sessionKey.current, question.quizStep, f, { answersExtra: { kanal: "czat" } });
    if (index === QUESTIONS.length - 1) {
      // Ponowna próba po błędzie wysyłki — zgoda już jest w rozmowie, nie dublujemy dymka.
      if (!form.rodoConsent) {
        setHistory((h) => [...h, { index, form, msgCount: messages.length }]);
        setMessages((m) => [...m, { from: "me", text: mine }]);
      }
      setForm(f);
      void submit(f);
      return;
    }
    goTo(index + 1, f, mine);
  }

  function start() {
    ensureSession();
    goTo(0, form, "Sprawdźmy");
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last || submitting) return;
    setHistory((h) => h.slice(0, -1));
    setIndex(last.index);
    setForm(last.form);
    setMessages((m) => m.slice(0, last.msgCount));
    setDraft("");
    setMulti([]);
    setError(null);
    setTyping(false);
  }

  function onChip(q: Extract<Question, { kind: "chips" }>, o: Option) {
    answer(q.apply(form, o.value), o.label);
  }

  function onMultiDone(q: Extract<Question, { kind: "multi" }>, values: string[]) {
    if (q.required && values.length === 0) {
      setError("Zaznacz, co Cię dotyczy — albo „Żadne z powyższych”.");
      return;
    }
    const all = [...q.options(form), ...(q.exclusive ? [q.exclusive] : [])];
    const label = values.length ? all.filter((o) => values.includes(o.value)).map((o) => o.label).join(", ") : "Pomijam";
    answer(q.apply(form, values), label);
  }

  function onText(q: Extract<Question, { kind: "text" }>, skip = false) {
    const value = skip ? "" : draft.trim();
    const f = { ...form, [q.field]: value };
    if (!skip) {
      // Walidacja z quizu — te same reguły i te same komunikaty co w `/aplikacja`.
      const e = validateStep(q.quizStep, f)[q.field];
      if (e) {
        setError(e);
        return;
      }
      if (!value) return;
    }
    answer(f, skip ? "Pomijam" : value);
  }

  async function submit(f: FormState) {
    setSubmitting(true);
    setError(null);
    const eventId = crypto.randomUUID();
    const adConsent = readConsent()?.marketing === true;
    const payload = buildLeadPayload(f, { eventId, adConsent, channelNote: CHANNEL_NOTE });
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Coś poszło nie tak. Spróbuj ponownie albo napisz do nas.");
        setSubmitting(false);
        return;
      }
      try {
        sessionStorage.setItem(
          LEAD_SEGMENT_KEY,
          JSON.stringify({
            voivodeship: payload.voivodeship,
            category: payload.category,
            source: "quiz",
            eventId,
            // Tylko ze zgodą marketingową — patrz komentarz w `LeadConversion.tsx`.
            ...(adConsent ? { email: payload.email, phone: payload.phone } : {}),
          })
        );
      } catch {
        /* brak storage = konwersja bez segmentacji, ale nadal się liczy */
      }
      saveQuizProgress(sessionKey.current, 7, f, {
        completed: true,
        leadId: typeof data?.id === "number" ? data.id : undefined,
        answersExtra: { kanal: "czat" },
      });
      setIndex(QUESTIONS.length);
      setOpen(false);
      router.push("/dziekujemy");
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
      setSubmitting(false);
    }
  }

  const progress = Math.round((Math.max(index, 0) / QUESTIONS.length) * 100);

  return (
    <>
      {/* PANEL ROZMOWY — na telefonie pełny ekran, na desktopie okno w rogu */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`Czat: ${PERSONA.name}, ${PERSONA.role} Uniwersytetu Beauty`}
          className="fixed inset-0 z-[60] flex flex-col bg-cream md:inset-auto md:bottom-6 md:right-6 md:h-[min(640px,calc(100vh-8rem))] md:w-[380px] md:overflow-hidden md:rounded-2xl md:border md:border-sand-200 md:shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-sand-200 bg-white px-4 py-3">
            <span className="relative shrink-0">
              <Image src={PERSONA.avatar} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-money-bright" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                {PERSONA.name} <span className="font-normal text-muted">· {PERSONA.role}</span>
              </p>
              <p className="text-xs text-muted">Uniwersytet Beauty · człowiek oddzwania w 24 h</p>
            </div>
            <button
              type="button"
              onClick={closeChat}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sand-100"
              aria-label="Zamknij czat"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="h-1 bg-sand-100" aria-hidden>
            <div className="h-full bg-sand-400 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={m.from === "bot" ? "flex justify-start" : "flex justify-end"}>
                <p
                  className={
                    m.from === "bot"
                      ? "max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm"
                      : "max-w-[85%] rounded-2xl rounded-tr-sm bg-sand-400 px-3.5 py-2.5 text-sm font-medium text-ink-soft"
                  }
                >
                  {m.text}
                </p>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start" aria-label={`${PERSONA.name} pisze`}>
                <span className="flex gap-1 rounded-2xl rounded-tl-sm bg-white px-3.5 py-3 shadow-sm">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-sand-600" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </span>
              </div>
            )}
            {question?.kind === "consent" && !typing && (
              <div className="rounded-xl border border-sand-200 bg-white p-3 text-xs leading-relaxed text-muted">
                {question.consent}
              </div>
            )}
          </div>

          {/* POLE ODPOWIEDZI — zależnie od rodzaju pytania */}
          <div className="border-t border-sand-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {/* honeypot — ten sam co w quizie; ludzie go nie widzą */}
            <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
              <label>
                Nie wypełniaj tego pola
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                />
              </label>
            </div>

            {error && (
              <p role="alert" className="mb-2 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            {!typing && index === -1 && (
              <button type="button" onClick={start} className="btn-primary w-full !py-3">
                Sprawdźmy
              </button>
            )}

            {!typing && question?.kind === "chips" && (
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {question.options(form).map((o) => (
                  <button key={o.label} type="button" onClick={() => onChip(question, o)} className="chat-chip">
                    {o.label}
                  </button>
                ))}
                {question.skippable && (
                  <button type="button" onClick={() => answer(form, "Pomijam")} className="chat-chip border-dashed">
                    Pomiń
                  </button>
                )}
              </div>
            )}

            {!typing && question?.kind === "multi" && (
              <div className="space-y-2">
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {question.options(form).map((o) => {
                    const on = multi.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setError(null);
                          setMulti((m) => (on ? m.filter((v) => v !== o.value) : [...m, o.value]));
                        }}
                        className={`chat-chip ${on ? "!bg-sand-400 !text-ink-soft" : ""}`}
                      >
                        {on ? "✓ " : ""}
                        {o.label}
                      </button>
                    );
                  })}
                  {question.exclusive && (
                    <button type="button" onClick={() => onMultiDone(question, [question.exclusive!.value])} className="chat-chip border-dashed">
                      {question.exclusive.label}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  {question.skippable && multi.length === 0 ? (
                    <button type="button" onClick={() => onMultiDone(question, [])} className="btn-outline flex-1 !py-2.5">
                      Pomiń
                    </button>
                  ) : (
                    <button type="button" onClick={() => onMultiDone(question, multi)} className="btn-primary flex-1 !py-2.5">
                      Gotowe{multi.length ? ` (${multi.length})` : ""}
                    </button>
                  )}
                </div>
              </div>
            )}

            {!typing && question?.kind === "text" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onText(question);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type={question.inputType ?? "text"}
                  inputMode={question.inputMode}
                  autoComplete={question.autoComplete}
                  aria-label={question.ask(form)[question.ask(form).length - 1]}
                  aria-invalid={error ? true : undefined}
                  className="input !py-2.5"
                  placeholder={question.placeholder}
                  value={draft}
                  maxLength={question.field === "postalCode" ? 6 : 160}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (error) setError(null);
                  }}
                />
                {question.skippable && !draft.trim() ? (
                  <button type="button" onClick={() => onText(question, true)} className="btn-outline shrink-0 !px-4 !py-2.5">
                    Pomiń
                  </button>
                ) : (
                  <button type="submit" className="btn-primary shrink-0 !px-4 !py-2.5" aria-label="Wyślij odpowiedź">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                )}
              </form>
            )}

            {!typing && question?.kind === "consent" && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => answer({ ...form, [question.field]: true }, question.agreeLabel)}
                className="btn-primary w-full !py-3 disabled:opacity-60"
              >
                {submitting ? "Wysyłanie..." : question.agreeLabel}
              </button>
            )}

            {history.length > 1 && !submitting && !typing && (
              <button type="button" onClick={undo} className="mt-2 text-xs font-semibold text-sand-700 underline">
                Cofnij ostatnią odpowiedź
              </button>
            )}
          </div>
        </div>
      )}

      {/* DYMEK ZACHĘTY */}
      {teaser && !open && (
        <div className="fixed bottom-[11.5rem] right-4 z-40 w-72 rounded-2xl rounded-br-sm border border-sand-200 bg-white p-3.5 pr-9 text-sm text-ink shadow-xl md:bottom-28 md:right-6">
          <button type="button" onClick={openChat} className="text-left">
            <span className="mb-1 block text-xs font-semibold text-muted">
              {PERSONA.name} · {PERSONA.role}
            </span>
            <span className="font-semibold">Masz pytanie o dofinansowanie?</span>{" "}
            Sprawdzę w 2 minuty, ile możesz dostać na szkolenie.
          </button>
          <button
            type="button"
            onClick={dismissTeaser}
            className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sand-100"
            aria-label="Zamknij zachętę"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}

      {/* IKONKA — zdjęcie Hani zamiast generycznego dymka: twarz wyróżnia się na beżowej stronie.
          Na telefonie nad paskiem „Bezpłatna Konsultacja" (StickyConsultationCta). */}
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={openChat}
          aria-label={`Otwórz czat: ${PERSONA.name}, ${PERSONA.role}`}
          className="group fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sand-700 md:bottom-6 md:right-6"
        >
          {/* Pigułka z tekstem tylko na desktopie i nie razem z dymkiem — ten sam komunikat dwa razy to szum */}
          {!teaser && (
            <span className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lg ring-1 ring-sand-200 md:block">
              Zapytaj o dofinansowanie
            </span>
          )}
          <span className="relative block h-16 w-16 shrink-0">
            {/* Pulsujący pierścień tylko dopóki nikt nie otworzył czatu i bez prefers-reduced-motion */}
            {index === -1 && (
              <span className="absolute inset-0 animate-ping rounded-full bg-sand-400 opacity-40 motion-reduce:hidden" aria-hidden />
            )}
            <Image
              src={PERSONA.avatar}
              alt=""
              width={64}
              height={64}
              className="relative h-16 w-16 rounded-full object-cover shadow-xl ring-[3px] ring-sand-400 transition-transform group-hover:scale-105 motion-reduce:transition-none"
            />
            <span className="absolute -bottom-0.5 -left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-sand-700 text-white ring-2 ring-white" aria-hidden>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
            </span>
            <span className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-white bg-money-bright" aria-hidden />
          </span>
        </button>
      )}
    </>
  );
}
