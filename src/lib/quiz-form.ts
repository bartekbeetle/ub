import { getUtm } from "@/lib/utm";

/**
 * WSPÓLNY RDZEŃ APLIKACJI O DOFINANSOWANIE — pytania, opcje, walidacja i składanie leada.
 *
 * Wydzielone z `Quiz.tsx` 09.10.2026, kiedy doszedł drugi interfejs tej samej aplikacji:
 * czat „doradca" w rogu strony (`components/chat/ChatDoradca.tsx`). Oba zadają TE SAME pytania
 * i wysyłają TEN SAM payload do `/api/lead` — gdyby każdy trzymał własną kopię opcji i
 * składania `message`, pierwsza zmiana w formularzu rozjechałaby je po cichu, a trenerka
 * dostawałaby leady w dwóch różnych formatach.
 */

/**
 * Forma zatrudnienia — pięć opcji z realnego formularza konkurencji (BIAR Academy),
 * podpatrzonych 13.09.2026. Mapujemy je na `EMPLOYMENT_STATUSES`, bo TEN enum żyje
 * w bazie i w matchingu — nie dokładamy nowej kolumny ani nowej wartości enuma.
 * Pełny, niezredukowany wybór trafia do `message`, żeby trenerka/admin widzieli
 * dokładnie to, co kandydatka zaznaczyła, nie tylko uproszczoną kategorię.
 */
export const EMPLOYMENT_FORM_OPTIONS = [
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
export const ELIGIBILITY_OPTIONS = [
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
export const ELIGIBILITY_NONE = "zadne";

export const GOAL_OPTIONS = [
  "Zmiana zawodu",
  "Rozwój obecnych umiejętności",
  "Otwarcie własnego salonu lub gabinetu",
  "Jeszcze się zastanawiam",
] as const;

export const AGE_OPTIONS = ["18–24", "25–34", "35–44", "45–54", "55+"] as const;

export const TRAVEL_OPTIONS = [
  { label: "Wolę szkolenie online", km: 0 },
  { label: "Do 10 km", km: 10 },
  { label: "Do 30 km", km: 30 },
  { label: "Do 50 km", km: 50 },
  { label: "Nie mam ograniczeń", km: 999 },
] as const;

export const HEARD_FROM_OPTIONS = [
  "Google / wyszukiwarka",
  "Facebook",
  "Instagram",
  "Polecenie od znajomej",
  "Inne",
] as const;

export type FormState = {
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

export const INITIAL: FormState = {
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

export type Errors = Partial<Record<keyof FormState, string>>;

export const TOTAL_STEPS = 7;

/** Walidacja pojedynczego kroku — blokuje „Dalej", dopóki krok nie jest kompletny. */
export function validateStep(step: number, f: FormState): Errors {
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

/**
 * Payload dla `/api/lead` z odpowiedzi aplikacji. `eventId` i `adConsent` liczy wołający,
 * bo to stan przeglądarki w chwili wysyłki (deduplikacja Pixel/CAPI, baner cookies).
 * `channelNote` dopisuje pierwszą linię `message` — np. „Kanał: czat na stronie", żeby przy
 * telefonie było widać, którędy przyszła (`source` zostaje `quiz`: to ta sama aplikacja).
 */
export function buildLeadPayload(
  form: FormState,
  opts: { courseId?: number | null; eventId: string; adConsent: boolean; channelNote?: string }
) {
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
  if (opts.channelNote) messageParts.push(opts.channelNote);
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

  return {
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
    courseId: opts.courseId ?? null,
    source: "quiz" as const,
    eventId: opts.eventId,
    adConsent: opts.adConsent,
    ...getUtm(),
  };
}

/**
 * Zapis postępu — „kto i gdzie przerwał". Celowo `void` i bez `await`: to jest telemetria,
 * która NIGDY nie może opóźnić ani zablokować przejścia do kolejnego kroku.
 * `answers` to pełny `FormState` — dzięki temu link „dokończ aplikację" z maila
 * (`/aplikacja?wznow=`) odtwarza odpowiedzi niezależnie od tego, czy zaczęła w quizie, czy w czacie.
 */
export function saveQuizProgress(
  sessionKey: string,
  step: number,
  f: FormState,
  extra?: { completed?: boolean; leadId?: number; answersExtra?: Record<string, unknown> }
) {
  if (!sessionKey) return;
  const { answersExtra, ...rest } = extra ?? {};
  void fetch("/api/quiz-progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true, // dolatuje nawet gdy użytkowniczka zamyka kartę
    body: JSON.stringify({
      sessionKey,
      step,
      name: f.name,
      email: f.email,
      phone: f.phone,
      category: f.category,
      voivodeship: f.voivodeship,
      city: f.city,
      contactConsent: f.contactConsent,
      marketingConsent: f.marketingConsent,
      answers: { ...(f as unknown as Record<string, unknown>), ...answersExtra },
      ...getUtm(),
      ...rest,
    }),
  }).catch(() => {});
}
