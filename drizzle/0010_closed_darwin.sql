ALTER TABLE "settings" ALTER COLUMN "confirm_email_template" SET DEFAULT 'Dzień dobry {{imie_wolacz}},

potwierdzamy, że otrzymaliśmy Twoje zgłoszenie na szkolenie z zakresu: {{kategoria}} ({{wojewodztwo}}).

Co dzieje się dalej:

1. Dobieramy akademię w Twoim regionie, która prowadzi ten kurs i ma wpis do Bazy Usług Rozwojowych.
2. Osoba z akademii kontaktuje się z Tobą telefonicznie — zwykle w ciągu 1-2 dni roboczych.
3. Podczas rozmowy ustalacie termin, zakres szkolenia i to, jakie dofinansowanie możesz uzyskać.

O dofinansowaniu: wsparcie z Bazy Usług Rozwojowych sięga 90% ceny szkolenia, a jego wysokość zależy od województwa, aktualnego naboru i Twojej sytuacji zawodowej. Dokładną kwotę poznasz po weryfikacji — akademia przeprowadzi Cię przez formalności.

Jeśli zgłoszenie było pomyłką albo chcesz wycofać zgodę na kontakt, po prostu odpisz na tę wiadomość.

Pozdrawiamy,
Zespół Uniwersytet Beauty
biuro@uniwersytetbeauty.pl · uniwersytetbeauty.pl';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "signup_email_template" SET DEFAULT 'Dzień dobry {{imie_wolacz}},

akademia {{trenerka}} potwierdziła Twój zapis na szkolenie z zakresu: {{kategoria}}.

Od tej chwili wszystkie sprawy organizacyjne — termin, miejsce, materiały i formalności dofinansowania — ustalasz bezpośrednio z akademią. To ona prowadzi szkolenie i wystawia dokumenty.

Gdyby coś poszło nie tak albo szkolenie nie doszło do skutku, daj nam znać na biuro@uniwersytetbeauty.pl. Chcemy o tym wiedzieć.

Powodzenia na kursie,
Zespół Uniwersytet Beauty';--> statement-breakpoint
-- Powyższe ALTER-y zmieniają tylko DEFAULT dla nowych wierszy. Wiersz ustawień (id=1)
-- istnieje od dawna i ma w treści stare {{imie}}, czyli pełne „imię i nazwisko" tuż po
-- „Dzień dobry" — a to daje „Dzień dobry Gabriela Nowak,". Podmieniamy w miejscu.
-- Warunkowo (WHERE ... LIKE), żeby nie nadpisać treści, którą ktoś zdążył zmienić w panelu.
UPDATE "settings"
   SET "confirm_email_template" = replace("confirm_email_template", '{{imie}},', '{{imie_wolacz}},')
 WHERE "confirm_email_template" LIKE 'Dzień dobry {{imie}},%';--> statement-breakpoint
UPDATE "settings"
   SET "signup_email_template" = replace("signup_email_template", '{{imie}},', '{{imie_wolacz}},')
 WHERE "signup_email_template" LIKE 'Dzień dobry {{imie}},%';
