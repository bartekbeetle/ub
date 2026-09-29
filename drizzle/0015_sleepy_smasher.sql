ALTER TABLE "settings" ALTER COLUMN "confirm_email_template" SET DEFAULT 'Dzień dobry {{imie_wolacz}},

potwierdzamy, że otrzymaliśmy Twoje zgłoszenie na szkolenie z zakresu: {{kategoria}} ({{wojewodztwo}}).

Co dzieje się dalej:

1. Dobieramy akademię w Twoim regionie, która prowadzi ten kurs i ma wpis do Bazy Usług Rozwojowych.
2. Osoba z akademii kontaktuje się z Tobą telefonicznie — zwykle w ciągu 1-2 dni roboczych.
3. Podczas rozmowy ustalacie termin, zakres szkolenia i to, jakie dofinansowanie możesz uzyskać.

O dofinansowaniu: wsparcie z Bazy Usług Rozwojowych sięga nawet 95% ceny szkolenia, a jego wysokość zależy od województwa, aktualnego naboru i Twojej sytuacji zawodowej. Dokładną kwotę poznasz po weryfikacji — akademia przeprowadzi Cię przez formalności.

Jeśli zgłoszenie było pomyłką albo chcesz wycofać zgodę na kontakt, po prostu odpisz na tę wiadomość.

Pozdrawiamy,
Zespół Uniwersytet Beauty
biuro@uniwersytetbeauty.pl · uniwersytetbeauty.pl';--> statement-breakpoint
UPDATE "settings" SET "confirm_email_template" = replace("confirm_email_template", 'sięga 90% ceny szkolenia', 'sięga nawet 95% ceny szkolenia') WHERE "confirm_email_template" LIKE '%sięga 90% ceny szkolenia%';
