import { openUrl } from '../lib/openUrl';

export async function openTaskLink(url: string): Promise<void> {
  if (!url) return;
  let normalized = url.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(normalized) && normalized.includes('.')) {
    normalized = `https://${normalized}`;
  }
  await openUrl(normalized);
}
