import { SITE_NAME, SITE_URL } from "./constants";
import type { Course, Trainer, BlogPost } from "@/db/schema";

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
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.shortDescription || course.description?.slice(0, 300) || course.title,
    url: `${SITE_URL}/kurs/${course.slug}`,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    ...(trainerName ? { instructor: { "@type": "Person", name: trainerName } } : {}),
    offers: {
      "@type": "Offer",
      price: course.price,
      priceCurrency: "PLN",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/kurs/${course.slug}`,
    },
    ...(course.city
      ? {
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: course.mode,
            location: { "@type": "Place", name: course.city },
            ...(course.nextDate ? { startDate: course.nextDate } : {}),
          },
        }
      : {}),
  };
}

export function personJsonLd(trainer: Trainer) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: trainer.name,
    url: `${SITE_URL}/trenerka/${trainer.slug}`,
    jobTitle: "Trenerka beauty",
    ...(trainer.bio ? { description: trainer.bio.slice(0, 300) } : {}),
    ...(trainer.city ? { address: { "@type": "PostalAddress", addressLocality: trainer.city } } : {}),
    ...(trainer.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (trainer.rating / 10).toFixed(1),
            reviewCount: trainer.reviewCount,
            bestRating: 5,
          },
        }
      : {}),
  };
}

export function articleJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription || post.excerpt,
    url: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(post.publishedAt ? { datePublished: new Date(post.publishedAt).toISOString() } : {}),
    ...(post.imageUrl ? { image: SITE_URL + post.imageUrl } : {}),
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
