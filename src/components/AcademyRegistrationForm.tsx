"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CATEGORIES, VOIVODESHIPS } from "@/lib/constants";

type Field =
  | "name"
  | "contactPerson"
  | "email"
  | "phone"
  | "city"
  | "voivodeship"
  | "categories"
  | "password"
  | "passwordRepeat"
  | "termsAccepted"
  | "contactConsent";

type Errors = Partial<Record<Field, string>>;

type Form = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  voivodeship: string;
  categories: string[];
  nip: string;
  burSegment: "A" | "B" | "nieznany";
  burProviderId: string;
  academyWebsite: string;
  instagram: string;
  password: string;
  passwordRepeat: string;
  termsAccepted: boolean;
  contactConsent: boolean;
  fax: string;
};

const EMPTY: Form = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  city: "",
  voivodeship: "",
  categories: [],
  nip: "",
  burSegment: "nieznany",
  burProviderId: "",
  academyWebsite: "",
  instagram: "",
  password: "",
  passwordRepeat: "",
  termsAccepted: false,
  contactConsent: false,
  fax: "",
};

/** Walidacja lustrzana wobec `academyRegistrationSchema` — plus powtórzenie hasła, którego serwer nie widzi. */
function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 3) e.name = "Podaj nazwę akademii albo swoje imię i nazwisko.";
  if (f.contactPerson.trim().length < 3) e.contactPerson = "Podaj imię i nazwisko osoby do kontaktu.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Ten adres e-mail wygląda na niepełny.";
  if (f.phone.replace(/\D/g, "").length < 9) e.phone = "Podaj numer telefonu — na niego zadzwonimy.";
  if (f.city.trim().length < 2) e.city = "Podaj miasto.";
  if (!f.voivodeship) e.voivodeship = "Wybierz województwo.";
  if (f.categories.length === 0) e.categories = "Zaznacz przynajmniej jedną kategorię szkoleń.";
  if (f.password.length < 10) e.password = "Hasło musi mieć min. 10 znaków.";
  else if (f.password !== f.passwordRepeat) e.passwordRepeat = "Hasła się różnią.";
  if (!f.termsAccepted) e.termsAccepted = "Bez akceptacji regulaminu i polityki prywatności nie założymy konta.";
  if (!f.contactConsent) e.contactConsent = "Potrzebujemy zgody na kontakt — inaczej nie mamy jak się odezwać.";
  return e;
}

export function AcademyRegistrationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState<string>("");

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const err = (field: Field) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `reg-err-${field}` } : {};

  function toggleCategory(cat: string) {
    setF((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return; // blokada podwójnego submitu — drugi zapis to drugi wiersz w CRM
    setServerError("");

    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/akademia/rejestracja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          contactPerson: f.contactPerson.trim(),
          email: f.email.trim(),
          phone: f.phone.trim(),
          city: f.city.trim(),
          voivodeship: f.voivodeship,
          categories: f.categories,
          nip: f.nip.trim(),
          burSegment: f.burSegment,
          burProviderId: f.burProviderId.trim(),
          academyWebsite: f.academyWebsite.trim(),
          instagram: f.instagram.trim(),
          password: f.password,
          termsAccepted: f.termsAccepted,
          contactConsent: f.contactConsent,
          fax: f.fax,
        }),
      });
      if (res.ok) {
        setState("sent");
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string; field?: string } | null;
      setServerError(data?.error ?? "Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.");
      if (data?.field) setErrors({ [data.field as Field]: data.error ?? "" } as Errors);
      setState("error");
    } catch {
      setServerError("Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-[12px] bg-money-bg p-8" role="status">
        <h2 className="font-serif text-2xl font-bold text-money-dark">Konto założone.</h2>
        <p className="mt-3 text-ink">
          Logujesz się adresem <strong>{f.email.trim()}</strong> i hasłem, które przed chwilą ustawiłaś.
        </p>
        <ol className="mt-6 space-y-3 text-sm text-ink">
          <li>
            <strong>1.</strong> Sprawdzamy Twój wpis w Bazie Usług Rozwojowych — bez niego kursantka nie rozliczy
            dofinansowania, dlatego robimy to przed przekazaniem pierwszego kontaktu.
          </li>
          <li>
            <strong>2.</strong> Dzwonimy na numer {f.phone.trim()} — zwykle w ciągu 1–2 dni roboczych. Ustalamy zakres
            szkoleń, region i zasady rozliczenia.
          </li>
          <li>
            <strong>3.</strong> Podpisujemy umowę partnerską. Dopiero od tego momentu wolno nam przekazać Ci dane
            kontaktowe kursantki.
          </li>
        </ol>
        <p className="mt-6 text-sm text-muted">
          W międzyczasie możesz uzupełnić profil akademii — to z niego korzystamy, dobierając kursantki.
        </p>
        <Link href="/panel/login" className="btn-primary mt-6 inline-block">
          Zaloguj się do panelu
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6" noValidate aria-busy={state === "sending"}>
      {/* honeypot */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Nie wypełniaj
          <input
            type="text"
            name="fax"
            tabIndex={-1}
            autoComplete="off"
            value={f.fax}
            onChange={(e) => set("fax", e.target.value)}
          />
        </label>
      </div>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg font-semibold">Akademia</legend>

        <div>
          <label className="label" htmlFor="reg-name">
            Nazwa akademii *
          </label>
          <input
            id="reg-name"
            name="name"
            className="input"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="organization"
            {...err("name")}
          />
          {errors.name && (
            <p id="reg-err-name" role="alert" className="field-error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reg-city">
              Miasto *
            </label>
            <input
              id="reg-city"
              name="city"
              className="input"
              value={f.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="address-level2"
              {...err("city")}
            />
            {errors.city && (
              <p id="reg-err-city" role="alert" className="field-error">
                {errors.city}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="reg-voiv">
              Województwo *
            </label>
            <select
              id="reg-voiv"
              name="voivodeship"
              className="input"
              value={f.voivodeship}
              onChange={(e) => set("voivodeship", e.target.value)}
              {...err("voivodeship")}
            >
              <option value="">Wybierz…</option>
              {VOIVODESHIPS.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.name}
                </option>
              ))}
            </select>
            {errors.voivodeship && (
              <p id="reg-err-voivodeship" role="alert" className="field-error">
                {errors.voivodeship}
              </p>
            )}
          </div>
        </div>

        <div>
          <span className="label">Jakie szkolenia prowadzisz? *</span>
          <p className="mb-2 text-xs text-muted">
            Zaznacz wszystkie pasujące — po tym dobieramy zgłoszenia kursantek.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-sand-300 px-3 py-2 text-sm hover:bg-sand-100"
              >
                <input
                  type="checkbox"
                  name="categories"
                  className="h-4 w-4 accent-sand-500"
                  checked={f.categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                />
                {cat}
              </label>
            ))}
          </div>
          {errors.categories && (
            <p id="reg-err-categories" role="alert" className="field-error">
              {errors.categories}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg font-semibold">Dofinansowanie</legend>
        <div>
          <span className="label">Masz wpis do Bazy Usług Rozwojowych (BUR)? *</span>
          <p className="mb-2 text-xs text-muted">
            To jedyny warunek, którego nie da się obejść: bez wpisu kursantka nie rozliczy dofinansowania. Nie masz
            wpisu? Zgłoś się mimo to — mamy dla takich akademii osobną ścieżkę.
          </p>
          <div className="space-y-2">
            {(
              [
                ["A", "Tak, mamy wpis"],
                ["nieznany", "Jesteśmy w trakcie / nie wiem"],
                ["B", "Nie, nie mamy wpisu"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="burSegment"
                  className="h-4 w-4 accent-sand-500"
                  checked={f.burSegment === value}
                  onChange={() => set("burSegment", value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {f.burSegment === "A" && (
          <div>
            <label className="label" htmlFor="reg-bur">
              ID dostawcy usług w BUR (jeśli znasz)
            </label>
            <input
              id="reg-bur"
              name="burProviderId"
              className="input"
              value={f.burProviderId}
              onChange={(e) => set("burProviderId", e.target.value)}
              placeholder="np. 12345"
            />
            <p className="mt-1 text-xs text-muted">Przyspiesza weryfikację. Jak nie masz pod ręką — zostaw puste.</p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="reg-nip">
            NIP (opcjonalnie)
          </label>
          <input
            id="reg-nip"
            name="nip"
            className="input"
            value={f.nip}
            onChange={(e) => set("nip", e.target.value)}
            inputMode="numeric"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg font-semibold">Kontakt</legend>

        <div>
          <label className="label" htmlFor="reg-person">
            Imię i nazwisko osoby do kontaktu *
          </label>
          <input
            id="reg-person"
            name="contactPerson"
            className="input"
            value={f.contactPerson}
            onChange={(e) => set("contactPerson", e.target.value)}
            autoComplete="name"
            {...err("contactPerson")}
          />
          {errors.contactPerson && (
            <p id="reg-err-contactPerson" role="alert" className="field-error">
              {errors.contactPerson}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reg-phone">
              Telefon *
            </label>
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              className="input"
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="tel"
              {...err("phone")}
            />
            {errors.phone && (
              <p id="reg-err-phone" role="alert" className="field-error">
                {errors.phone}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="reg-email">
              E-mail * <span className="font-normal text-muted">(to będzie Twój login)</span>
            </label>
            <input
              id="reg-email"
              name="email"
              type="email"
              className="input"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
              {...err("email")}
            />
            {errors.email && (
              <p id="reg-err-email" role="alert" className="field-error">
                {errors.email}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reg-www">
              Strona WWW (opcjonalnie)
            </label>
            <input
              id="reg-www"
              name="academyWebsite"
              className="input"
              value={f.academyWebsite}
              onChange={(e) => set("academyWebsite", e.target.value)}
              placeholder="akademia.pl"
            />
          </div>
          <div>
            <label className="label" htmlFor="reg-ig">
              Instagram (opcjonalnie)
            </label>
            <input
              id="reg-ig"
              name="instagram"
              className="input"
              value={f.instagram}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="@twoja_akademia"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-serif text-lg font-semibold">Hasło do panelu</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reg-pass">
              Hasło * <span className="font-normal text-muted">(min. 10 znaków)</span>
            </label>
            <input
              id="reg-pass"
              name="password"
              type="password"
              className="input"
              value={f.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              {...err("password")}
            />
            {errors.password && (
              <p id="reg-err-password" role="alert" className="field-error">
                {errors.password}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="reg-pass2">
              Powtórz hasło *
            </label>
            <input
              id="reg-pass2"
              name="passwordRepeat"
              type="password"
              className="input"
              value={f.passwordRepeat}
              onChange={(e) => set("passwordRepeat", e.target.value)}
              autoComplete="new-password"
              {...err("passwordRepeat")}
            />
            {errors.passwordRepeat && (
              <p id="reg-err-passwordRepeat" role="alert" className="field-error">
                {errors.passwordRepeat}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <div className="space-y-3 rounded-[12px] bg-sand-100 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="termsAccepted"
            className="mt-0.5 h-5 w-5 shrink-0 accent-sand-500"
            checked={f.termsAccepted}
            onChange={(e) => set("termsAccepted", e.target.checked)}
            {...err("termsAccepted")}
          />
          <span>
            Akceptuję{" "}
            <Link href="/regulamin" className="underline" target="_blank">
              regulamin serwisu
            </Link>{" "}
            i{" "}
            <Link href="/polityka-prywatnosci" className="underline" target="_blank">
              politykę prywatności
            </Link>
            . Oświadczam, że jestem uprawniona do reprezentowania zgłaszanego podmiotu. *
          </span>
        </label>
        {errors.termsAccepted && (
          <p id="reg-err-termsAccepted" role="alert" className="field-error">
            {errors.termsAccepted}
          </p>
        )}

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="contactConsent"
            className="mt-0.5 h-5 w-5 shrink-0 accent-sand-500"
            checked={f.contactConsent}
            onChange={(e) => set("contactConsent", e.target.checked)}
            {...err("contactConsent")}
          />
          <span>
            Zgadzam się na kontakt telefoniczny i e-mailowy w sprawie współpracy z Uniwersytetem Beauty. *
          </span>
        </label>
        {errors.contactConsent && (
          <p id="reg-err-contactConsent" role="alert" className="field-error">
            {errors.contactConsent}
          </p>
        )}

        {/* Klauzula informacyjna w punkcie zbierania danych (art. 13 RODO) — krócej niż polityka,
            ale z kompletem: kto, po co, na jakiej podstawie, jak długo, jakie masz prawa. */}
        <details className="text-xs text-muted">
          <summary className="cursor-pointer underline">Kto przetwarza Twoje dane i po co</summary>
          <p className="mt-2">
            Administratorem danych podanych w formularzu jest Bartosz Chrząszcz — Niezależny Przedsiębiorca (marka
            Uniwersytet Beauty), NIP 8883009310. Dane przetwarzamy, żeby założyć i prowadzić konto w panelu oraz
            podjąć kroki przed zawarciem umowy partnerskiej (art. 6 ust. 1 lit. b RODO), a kontakt telefoniczny i
            e-mailowy realizujemy na podstawie Twojej zgody (art. 6 ust. 1 lit. a RODO w zw. z art. 398 Prawa
            komunikacji elektronicznej). Zgodę możesz wycofać w każdej chwili, pisząc na
            biuro@uniwersytetbeauty.pl — nie wpływa to na zgodność z prawem działań podjętych wcześniej. Dane
            przechowujemy przez czas prowadzenia konta, a po jego zamknięciu przez okres przedawnienia roszczeń.
            Masz prawo dostępu do danych, sprostowania, usunięcia, ograniczenia i sprzeciwu, a także skargi do
            Prezesa UODO. Szczegóły w polityce prywatności.
          </p>
        </details>
      </div>

      {serverError && (
        <p role="alert" className="rounded-[12px] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {serverError}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={state === "sending"}>
        {state === "sending" ? "Zakładam konto…" : "Załóż konto"}
      </button>
      <p className="text-center text-sm text-muted">
        Masz już konto?{" "}
        <Link href="/panel/login" className="underline">
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}
