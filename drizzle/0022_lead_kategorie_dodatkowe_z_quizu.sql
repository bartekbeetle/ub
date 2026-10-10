-- Kategorie dodatkowe wstecz: linia „Interesuje ją też (multi-sell): A, B” z leads.message
-- (składana w buildLeadPayload, src/lib/quiz-form.ts) → leads.extra_categories.
-- Tylko kategorie z CATEGORIES (src/lib/constants.ts). Tylko tam, gdzie dodatkowych jeszcze nie ma; bez kategorii głównej; idempotentne.
UPDATE "leads" AS l
SET "extra_categories" = sub.cats
FROM (
  SELECT id, COALESCE(jsonb_agg(DISTINCT trim(x)) FILTER (WHERE trim(x) <> category AND trim(x) = ANY (ARRAY['PMU / Makijaż permanentny', 'Stylizacja rzęs', 'Stylizacja brwi', 'Stylizacja paznokci', 'Medycyna estetyczna', 'Kosmetologia', 'Manicure & Pedicure', 'Fryzjerstwo', 'Masaż', 'Depilacja', 'Inne'])), '[]'::jsonb) AS cats
  FROM "leads",
       LATERAL unnest(string_to_array(substring(message FROM 'Interesuje ją też \(multi-sell\): ([^' || chr(10) || ']+)'), ',')) AS x
  WHERE message LIKE '%Interesuje ją też (multi-sell): %'
  GROUP BY id
) AS sub
WHERE l.id = sub.id AND l."extra_categories" = '[]'::jsonb;
