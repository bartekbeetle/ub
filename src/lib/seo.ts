import { CONTACT_EMAIL, OPERATOR, ORG_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_URLS } from "./constants";
import type { Course, Trainer, BlogPost } from "@/db/schema";

/** Stały identyfikator encji organizacji — pozwala spinać wszystkie schematy w jeden graf. */
export const ORG_ID = `${SITE_URL}/#organizacja`;
const WEBSITE_ID = `${SITE_URL}/#strona`;

const BRAND_SUFFIX = ` | ${SITE_NAME}`;

/**
 * Ucina tekst do `max` znaków po granicy słowa — bez wielokropka i bez rozjechanych wyrazów.
 * Google obcina snippet w SERP-ie; lepiej sterować tym u siebie niż oddawać decyzję wyszukiwarce.
 */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, "");
}

/**
 * Tytuł ≤60 znaków. Marka doklejana TYLKO wtedy, gdy się mieści — inaczej zjada
 * miejsce na frazę i Google ucina tytuł w połowie zdania. Zwraca `absolute`,
 * żeby ominąć `title.template` z root layoutu (który dokleja markę bezwarunkowo).
 */
export function pageTitle(base: string, max = 60): { absolute: string } {
  const clean = base.replace(/\s+/g, " ").trim();
  if (clean.length + BRAND_SUFFIX.length <= max) return { absolute: clean + BRAND_SUFFIX };
  return { absolute: clampText(clean, max) };
}

/** Meta description ≤158 znaków (limit snippetu Google ~160). */
export function metaDescription(text: string, max = 158): string {
  return clampText(text, max);
}

/**
 * Unikalny opis kursu składany z danych kursu.
 * Powód: wszystkie kursy w bazie mają identyczny `shortDescription`, więc 12 stron kursów
 * dostawało jeden i ten sam meta description (duplikat = Google ignoruje i pisze snippet sam).
 * Guardrail ceny: NIE piszemy „0 zł" ani „darmowe" — przy dofinansowaniu 100% podajemy
 * sam procent, bez kwoty dopłaty.
 */
export function courseMetaDescription(course: Course, trainerName?: string | null): string {
  const priceAfter = Math.round(course.price * (1 - course.subsidyPercent / 100));
  // Miasto po przecinku, nie „w {miasto}" — nazwy miast wymagałyby odmiany
  // przez przypadki („w Katowicach", nie „w Katowice"), a tego z bazy nie wyliczymy.
  const base = [
    `${course.title}${course.city ? `, ${course.city}` : ""} — dofinansowanie do ${course.subsidyPercent}% z BUR.`,
    priceAfter > 0
      ? `Dopłacasz ${priceAfter} zł zamiast ${course.price} zł.`
      : `Wysokość dopłaty ustalasz z operatorem dofinansowania.`,
    `${course.durationHours} h praktyki.`,
  ].join(" ");
  // Trenerkę dopisujemy tylko wtedy, gdy zmieści się CAŁA — ucięte nazwisko
  // w snippetcie wygląda na błąd strony, a nie na skrót.
  const withTrainer = trainerName ? `${base} Prowadzi ${trainerName}.` : base;
  return metaDescription(withTrainer.length <= 158 ? withTrainer : base);
}

/**
 * Organizacja + WebSite — wstrzykiwane na KAŻDEJ stronie publicznej.
 * To jest fundament pod Knowledge Panel w Google i pod rozpoznanie marki przez modele AI:
 * jedna, powtarzalna definicja „czym jest Uniwersytet Beauty".
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "EducationalOrganization"],
    "@id": ORG_ID,
    name: SITE_NAME,
    alternateName: "UB — Uniwersytet Beauty",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
    image: `${SITE_URL}/og-default.png`,
    description: ORG_DESCRIPTION,
    email: CONTACT_EMAIL,
    // Dane rejestrowe podmiotu — Google traktuje je jako sygnał wiarygodności (E-E-A-T),
    // a modele AI jako potwierdzenie, że za marką stoi realny, identyfikowalny podmiot.
    legalName: `${OPERATOR.legalName} ${OPERATOR.tradeName}`,
    taxID: OPERATOR.nip,
    identifier: [
      { "@type": "PropertyValue", propertyID: "NIP", value: OPERATOR.nip },
      { "@type": "PropertyValue", propertyID: "REGON", value: OPERATOR.regon },
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: OPERATOR.street,
      postalCode: OPERATOR.postalCode,
      addressLocality: OPERATOR.city,
      addressCountry: OPERATOR.country,
    },
    areaServed: { "@type": "Country", name: "Polska" },
    knowsLanguage: "pl-PL",
    knowsAbout: [
      "Baza Usług Rozwojowych (BUR)",
      "dofinansowania na szkolenia zawodowe",
      "makijaż permanentny (PMU)",
      "stylizacja rzęs",
      "stylizacja brwi",
      "stylizacja paznokci",
      "medycyna estetyczna",
      "przekwalifikowanie zawodowe kobiet",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "obsługa klienta",
      email: CONTACT_EMAIL,
      availableLanguage: ["pl"],
      areaServed: "PL",
    },
    ...(SOCIAL_URLS.length ? { sameAs: SOCIAL_URLS } : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: ORG_DESCRIPTION,
    inLanguage: "pl-PL",
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/kursy?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Lista pozycji (kursy / trenerki / artykuły) — modele AI i Google czytają z niej
 * strukturę oferty zamiast zgadywać z HTML-a.
 */
export function itemListJsonLd(name: string, items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: SITE_URL + item.url,
    })),
  };
}

/** Mapowanie polskich trybów na wartości schema.org wymagane przez Google (Course Info). */
function schemaCourseMode(mode: string): string {
  const m = mode.toLowerCase();
  if (m.startsWith("online")) return "online";
  if (m.startsWith("hybryd")) return "blended";
  return "onsite";
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: SITE_URL + item.url,
    })),
  };
}

export function courseJsonLd(course: Course, trainerName?: string | null) {
  const url = `${SITE_URL}/kurs/${course.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.shortDescription || course.description?.slice(0, 300) || course.title,
    url,
    inLanguage: "pl-PL",
    provider: { "@type": "Organization", "@id": ORG_ID, name: SITE_NAME, url: SITE_URL },
    ...(course.imageUrl
      ? { image: course.imageUrl.startsWith("http") ? course.imageUrl : SITE_URL + course.imageUrl }
      : {}),
    ...(course.program.length ? { teaches: course.program.slice(0, 12) } : {}),
    educationalLevel: course.level,
    educationalCredentialAwarded: "Certyfikat ukończenia szkolenia",
    // Google (Course Info) wymaga hasCourseInstance z courseMode + courseWorkload — bez tego
    // kurs nie kwalifikuje się do wyników rozszerzonych.
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: schemaCourseMode(course.mode),
      courseWorkload: `PT${course.durationHours}H`,
      inLanguage: "pl-PL",
      ...(trainerName ? { instructor: { "@type": "Person", name: trainerName } } : {}),
      ...(course.city
        ? {
            location: {
              "@type": "Place",
              name: course.city,
              address: { "@type": "PostalAddress", addressLocality: course.city, addressCountry: "PL" },
            },
          }
        : {}),
      ...(course.nextDate ? { startDate: course.nextDate } : {}),
      offers: {
        "@type": "Offer",
        price: course.price,
        priceCurrency: "PLN",
        category: "Paid",
        availability: "https://schema.org/InStock",
        url,
      },
    },
    offers: {
      "@type": "Offer",
      price: course.price,
      priceCurrency: "PLN",
      category: "Paid",
      availability: "https://schema.org/InStock",
      url,
    },
  };
}

/**
 * UWAGA: świadomie BEZ `aggregateRating`. Oceny trenerek pochodzą z ich wizytówek Google,
 * nie z opinii zebranych w tym serwisie — oznaczanie ich jako własnych ocen to
 * self-serving review markup (ryzyko ręcznej kary). Na stronie pokazujemy je z etykietą
 * „opinie z Google", ale nie deklarujemy w danych strukturalnych.
 */
export function personJsonLd(trainer: Trainer) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: trainer.name,
    url: `${SITE_URL}/trenerka/${trainer.slug}`,
    jobTitle: "Trenerka beauty",
    worksFor: { "@id": ORG_ID },
    ...(trainer.bio ? { description: trainer.bio.slice(0, 300) } : {}),
    ...(trainer.avatarUrl ? { image: trainer.avatarUrl.startsWith("http") ? trainer.avatarUrl : SITE_URL + trainer.avatarUrl } : {}),
    ...(trainer.specializations.length ? { knowsAbout: trainer.specializations } : {}),
    ...(trainer.city
      ? { address: { "@type": "PostalAddress", addressLocality: trainer.city, addressCountry: "PL" } }
      : {}),
  };
}

export function articleJsonLd(post: BlogPost) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const published = post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined;
  return {
    "@context": "https://schema.org",
    // BlogPosting (subtyp Article) — dokładniejsza kategoryzacja dla Google i modeli AI.
    "@type": ["Article", "BlogPosting"],
    headline: post.title.slice(0, 110),
    description: post.metaDescription || post.excerpt,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: post.category,
    author: { "@type": "Organization", name: post.author, url: SITE_URL },
    publisher: { "@id": ORG_ID },
    ...(published ? { datePublished: published, dateModified: published } : {}),
    ...(post.imageUrl
      ? { image: [post.imageUrl.startsWith("http") ? post.imageUrl : SITE_URL + post.imageUrl] }
      : { image: [`${SITE_URL}/og-default.png`] }),
    timeRequired: `PT${post.readingMinutes}M`,
    isAccessibleForFree: true,
    inLanguage: "pl-PL",
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
