"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BlogPost } from "@/db/schema";
import { BLOG_CATEGORIES } from "@/lib/constants";
import { slugify } from "@/lib/utils";

export function BlogForm({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      title,
      slug,
      category: String(fd.get("category")),
      excerpt: String(fd.get("excerpt") ?? ""),
      content: String(fd.get("content") ?? ""),
      imageUrl: String(fd.get("imageUrl") ?? ""),
      metaTitle: String(fd.get("metaTitle") ?? ""),
      metaDescription: String(fd.get("metaDescription") ?? ""),
      author: String(fd.get("author") ?? "Redakcja Uniwersytet Beauty"),
      readingMinutes: Number(fd.get("readingMinutes") ?? 5),
      status: String(fd.get("status")) as "szkic" | "opublikowane",
    };
    const res = await fetch(post ? `/api/admin/blog/${post.id}` : "/api/admin/blog", {
      method: post ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/admin/blog");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Błąd zapisu.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <div>
        <label className="label" htmlFor="b-title">Tytuł *</label>
        <input
          id="b-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!post) setSlug(slugify(e.target.value));
          }}
          required
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="b-slug">Slug *</label>
          <input id="b-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]+" className="input font-mono text-sm" />
        </div>
        <div>
          <label className="label" htmlFor="b-cat">Kategoria</label>
          <select id="b-cat" name="category" defaultValue={post?.category ?? BLOG_CATEGORIES[0]} className="input">
            {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="b-excerpt">Zajawka (excerpt) *</label>
        <textarea id="b-excerpt" name="excerpt" rows={3} required defaultValue={post?.excerpt ?? ""} className="input resize-y" />
      </div>
      <div>
        <label className="label" htmlFor="b-content">Treść (Markdown) *</label>
        <textarea id="b-content" name="content" rows={16} required defaultValue={post?.content ?? ""} className="input resize-y font-mono text-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="b-img">Zdjęcie (URL)</label>
          <input id="b-img" name="imageUrl" defaultValue={post?.imageUrl ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="b-author">Autor</label>
          <input id="b-author" name="author" defaultValue={post?.author ?? "Redakcja Uniwersytet Beauty"} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="b-min">Czas czytania (min)</label>
          <input id="b-min" name="readingMinutes" type="number" min={1} defaultValue={post?.readingMinutes ?? 5} className="input" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="b-mtitle">Meta title (SEO)</label>
          <input id="b-mtitle" name="metaTitle" defaultValue={post?.metaTitle ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="b-mdesc">Meta description (SEO)</label>
          <input id="b-mdesc" name="metaDescription" defaultValue={post?.metaDescription ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="b-status">Status</label>
        <select id="b-status" name="status" defaultValue={post?.status ?? "szkic"} className="input max-w-xs">
          <option value="szkic">Szkic</option>
          <option value="opublikowane">Opublikowane</option>
        </select>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? "Zapisywanie…" : post ? "Zapisz zmiany" : "Utwórz post"}
        </button>
        {post && (
          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="btn-outline">
            Podgląd {post.status === "szkic" ? "(opublikuj, by zobaczyć)" : "→"}
          </a>
        )}
        <button type="button" onClick={() => router.back()} className="btn-outline">Anuluj</button>
      </div>
    </form>
  );
}
