import { DryRunSmsProvider } from "./dryrun";
import { SmsapiProvider } from "./smsapi";
import type { SmsProvider } from "./types";

export type { SmsProvider, SmsSendResult, SmsSendStatus } from "./types";
export { normalizePlPhone, smsLength, SMS_MAX_SEGMENTS } from "./phone";

/**
 * Wybór dostawcy po środowisku:
 *  - `SMSAPI_TOKEN` ustawiony → SMSAPI.pl (opcjonalnie `SMS_SENDER_NAME`, max 11 znaków,
 *    musi być zweryfikowane w panelu SMSAPI → Pola nadawcy),
 *  - brak tokenu → `dryrun` (nic nie wychodzi, historia i plakietka w UI mówią to wprost).
 */
export function getSmsProvider(env: Record<string, string | undefined> = process.env): SmsProvider {
  const token = env.SMSAPI_TOKEN?.trim();
  if (!token) return new DryRunSmsProvider();
  const sender = env.SMS_SENDER_NAME?.trim() || undefined;
  return new SmsapiProvider(token, sender);
}

/** Czy SMS-y realnie wychodzą (jest token). UI pokazuje plakietkę „tryb testowy" przy `false`. */
export function isSmsLive(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.SMSAPI_TOKEN?.trim());
}
