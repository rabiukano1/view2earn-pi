import { MetadataRoute } from 'next';

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/contact',
    '/partner',
    '/privacy',
    '/terms',
    '/cookies',
    '/anti-fraud',
    '/rewards-redemption',
    '/child-safety',
    '/delete-account',
  ];

  return routes.map((route) => ({
    url: `https://view2earn.org${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));
}
