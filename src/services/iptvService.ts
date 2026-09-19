// Stream channel shape used by the Watch screens. Channels come ONLY from the
// admin-managed Convex `iptvChannels` table (see convex/iptv.ts) — no bundled
// or scraped stream lists, so every URL in the app was approved by an admin.

export interface IPTVChannel {
  id: string;
  name: string;
  logo: string;
  country: string;
  category: 'Football' | 'Sports' | 'News' | 'Entertainment';
  type?: 'football' | 'youtube' | 'other' | 'movies';
  isLive: boolean;
  streamUrl: string;
  backupStreamUrls?: string[];
  quality: '1080p HD' | '720p HD' | 'SD';
  currentMatch?: string;
}
