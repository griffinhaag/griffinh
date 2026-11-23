import type { APIRoute } from 'astro';

// Pages listed for search engines, by their clean URLs. The 404 page is left out on purpose.
const pages = [
  { path: '/', priority: '1.0' },
  { path: '/projects/griffingames', priority: '0.8' },
  { path: '/projects/dayone', priority: '0.8' },
];

export const GET: APIRoute = ({ site }) => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = pages
    .map((p) => `  <url><loc>${new URL(p.path, site)}</loc><lastmod>${lastmod}</lastmod><priority>${p.priority}</priority></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
