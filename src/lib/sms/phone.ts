/**
 * Numery i długość SMS — czysty moduł (bez `server-only`), bo importuje go też formularz
 * kliencki (licznik znaków) i test.
 */

export type NormalizedPhone = { ok: true; e164: string } | { ok: false; error: string };

/**
 * Normalizuje polski numer komórkowy do `+48XXXXXXXXX`.
 * Przyjmuje: `500 600 700`, `500-600-700`, `48500600700`, `+48 500 600 700`, `0048500600700`.
 * Odrzuca numery zagraniczne (CRM wysyła tylko w PL) i stacjonarne (SMS na stacjonarny
 * nie dojdzie, a kosztuje). Polskie komórki zaczynają się od cyfr 4–8.
 */
export function normalizePlPhone(raw: string | null | undefined): NormalizedPhone {
  if (!raw) return { ok: false, error: "Brak numeru telefonu." };
  let digits = raw.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return { ok: false, error: "Numer zawiera niedozwolone znaki." };
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 11 && digits.startsWith("48")) digits = digits.slice(2);
  else if (digits.length !== 9) return { ok: false, error: "To nie jest polski numer (9 cyfr, kierunkowy +48)." };

  if (!/^[4-8]/.test(digits)) return { ok: false, error: "To nie wygląda na numer komórkowy." };
  return { ok: true, e164: `+48${digits}` };
}

// Alfabet GSM 03.38 (podstawowy) i rozszerzenie (znak liczy się za 2).
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export type SmsLength = {
  /** Liczba znaków (w GSM znaki rozszerzone liczą się za 2). */
  length: number;
  /** Czy wiadomość ma znak spoza GSM (np. polskie ą, ę, ł) — wtedy limity spadają do 70/67. */
  unicode: boolean;
  /** Limit jednej części i liczba części. */
  perSegment: number;
  segments: number;
};

/**
 * Długość SMS wg zasad SMSAPI: 160 znaków albo 70, gdy jest choć jeden znak „specjalny"
 * (polskie litery też). Wiadomość dłuższa dzieli się na części po 153 / 67 znaków.
 */
export function smsLength(text: string): SmsLength {
  let unicode = false;
  let gsmLen = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsmLen += 1;
    else if (GSM_EXT.includes(ch)) gsmLen += 2;
    else {
      unicode = true;
      break;
    }
  }
  if (unicode) {
    const length = Array.from(text).length;
    const segments = length === 0 ? 0 : length <= 70 ? 1 : Math.ceil(length / 67);
    return { length, unicode: true, perSegment: length <= 70 ? 70 : 67, segments };
  }
  const segments = gsmLen === 0 ? 0 : gsmLen <= 160 ? 1 : Math.ceil(gsmLen / 153);
  return { length: gsmLen, unicode: false, perSegment: gsmLen <= 160 ? 160 : 153, segments };
}

/** Twardy limit wiadomości po naszej stronie: 3 części (≈ 201 znaków z polskimi literami). */
export const SMS_MAX_SEGMENTS = 3;
