import { getAllPosts } from "../lib/blog";
import { getSitemapBaseUrl, toSitemapUrl } from "../lib/siteUrl";

export default async function sitemap() {
  const baseUrl = getSitemapBaseUrl();
  const posts = getAllPosts();

  const postUrls = posts.map((post) => ({
    url: toSitemapUrl(`/blog/${post.slug}`),
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const staticUrls = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: toSitemapUrl("/blog"),
      lastModified: posts[0]?.date ? new Date(posts[0].date) : new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: toSitemapUrl("/espia-competencia"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: toSitemapUrl("/precios"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: toSitemapUrl("/terminos"),
      lastModified: new Date("2026-06-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: toSitemapUrl("/privacidad"),
      lastModified: new Date("2026-06-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const entries = [...staticUrls, ...postUrls];

  // Garantía final: ningún <loc> fuera del dominio canónico.
  for (const entry of entries) {
    if (!entry.url.startsWith(`${baseUrl}/`) && entry.url !== baseUrl) {
      throw new Error(`Sitemap URL fuera de dominio canónico: ${entry.url}`);
    }
  }

  return entries;
}
