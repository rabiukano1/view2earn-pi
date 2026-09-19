# View2Earn — Movies & Stream Content: Setup + AdMob-Safe Content Policy

> **Last updated:** September 19, 2026
> **Scope:** Watch hub (Football / YouTube / Live Streams / Movies), the HLS player, admin Channels page, and what content is allowed to be monetised with AdMob.

---

## 1. What changed (September 2026)

### Added — Movies section with interstitial ads
| File | Change |
| :--- | :--- |
| `convex/schema.ts`, `convex/iptv.ts` | New channel `type: "movies"` |
| `src/screens/WatchHubScreen.tsx` | 🎥 **Movies** tile |
| `src/screens/LiveStreamsScreen.tsx` | Handles `kind: 'football' \| 'youtube' \| 'other' \| 'movies'`; calls `showInterstitial()` on channel pick — **except YouTube** |
| `apps/admin-panel/src/app/channels/page.tsx` | "Movies" in the type dropdown |

The interstitial reuses `src/services/interstitialService.ts`, which already enforces AdMob best practice: ≥30 s between ads, max 10 per session, UMP consent checked, shown only at a user-initiated transition (tapping a channel) — never auto-played over the video.

### Removed — everything that could get the AdMob account banned
| Removed | Why it was a ban risk |
| :--- | :--- |
| `src/screens/LiveTvScreen.tsx` (whole screen) | Built around bundled pirate streams (beIN / SSC / Alkass via yacine-tv.com) and a "Yacine TV" tab |
| `src/services/iptvService.ts` curated lists + `fetchIPTVChannels()` | Hardcoded unlicensed beIN/football streams; scraped iptv-org and "free beIN" M3U playlists at runtime |
| `src/services/liveEventsService.ts` | Only existed to decorate the pirate streams |
| `LiveStreamPlayer` `httpReferrer` / `userAgent` spoofing (`xhrSetup`) | Faking the Referer header to bypass a CDN's access control is circumvention — a clear "unauthorised access" signal to Google |
| `LiveStreamPlayer` Yacine/koora/bein iframe special-casing | Embedding known piracy sites |
| `convex/iptv.ts` `resolve` action (HTML m3u8 scraper + Piped YouTube extractor) | Tooling to extract streams from pages / bypass YouTube = piracy tooling |
| Admin "Auto-detect" button, Referrer/User-Agent fields | UI for the above |
| `LiveTV` route + `live-tv` deep link | Screen no longer exists |

**What remains:** channels come **only** from the admin-managed Convex `iptvChannels` table. Nothing is bundled or scraped. The player plays a direct `.m3u8`, a YouTube ID, or a plain embed page (used for archive.org).

> ⚠️ **Still to do by you — the data.** The Convex table still holds whatever channels were added before. Delete every football/sports channel you do not hold a licence for: Admin → Channels → 🗑, or Convex dashboard → Data → `iptvChannels` → *Clear table*. **Code changes alone don't fix this; a Google reviewer sees what the app plays.**

---

## 2. Content policy — what may be added in Admin → Channels

AdMob Publisher Content Policy: *you may not monetise content you do not have the rights to.* Every channel must fall in one of these buckets:

| ✅ Allowed | Where to find it | Put in "subtitle" field |
| :--- | :--- | :--- |
| **US public domain films** — published before 1931, or later films whose copyright was not renewed (*Night of the Living Dead* 1968, *His Girl Friday* 1940, *Charade* 1963, *Nosferatu* 1922 …) | `archive.org/details/feature_films`; Wikipedia "List of films in the public domain in the United States" | `Public Domain · 1968` |
| **Creative Commons (CC-BY / CC-BY-SA)** — commercial use allowed with credit | Blender open movies (*Big Buck Bunny*, *Sintel*, *Tears of Steel*), archive.org CC filter | `CC-BY · Blender Foundation` |
| **Content you own or are licensed for** — your own tutorials, creator uploads with a rights grant, a written licence from the rights holder | Your own files | `© View2Earn` / `Licensed from <name>` |
| **YouTube — your own channel only** (View2Earn tutorials, your own uploads). Embedding is licensed by YouTube's terms, but the tab is **ad-free**: YouTube API Policy III.E forbids interstitials before/after playback or ads adjacent to the player, and AdMob's *replicated content* rule flags screens that are only other people's videos + ads | Your own YouTube channel | `Official · View2Earn` |
| **Official broadcaster streams that are freely and publicly published** by the rights holder themselves (their own `.m3u8` or their official YouTube live) | The broadcaster's own site / YouTube channel | `Official · <broadcaster>` |

| ❌ Never |
| :--- |
| beIN, SSC, Alkass, DAZN, Sky, any pay-TV sports channel from a "free" mirror |
| Yacine TV, Koora, iptv-org lists, freeott, wurl "re-streams", Telegram-shared m3u8 links |
| Nollywood / Bollywood / Hollywood films re-uploaded to YouTube or archive.org by random users (uploaded ≠ public domain) |
| Other people's YouTube videos as a monetised "content" section — YouTube ToS + AdMob replicated-content |
| Any URL that only works with a spoofed Referer / User-Agent — if it needs a fake header, you don't have permission |

**Rule of thumb:** if you can't write a source + licence in the subtitle field in one line, don't add it.

### Paper trail
- Subtitle field = licence line (visible to users **and** to a Google reviewer).
- Keep the source URL as the stream URL itself (archive.org URLs are self-documenting).
- Add a DMCA / copyright contact to `TERMS.md` (a "Copyright complaints: <email>" paragraph is enough) so you qualify as a safe harbour if anyone disputes a title.

---

## 3. Adding a movie (zero storage, zero cost)

Don't host. Internet Archive hosts public-domain films with free unlimited bandwidth and allows embedding; the player already falls back to an iframe for any non-`.m3u8` URL.

1. Admin → Channels → **+ New**
2. Type: **Movies**
3. Name: `Night of the Living Dead (1968)`
4. Stream URL: `https://archive.org/embed/night_of_the_living_dead`
   (every film on archive.org is `https://archive.org/embed/<identifier>` — the identifier is the last part of its `archive.org/details/…` URL)
5. Subtitle: `Public Domain · 1968`
6. Logo: poster image URL (archive.org item page → right-click poster → copy image address)
7. Save → appears in the app instantly (Convex is reactive; no rebuild).

---

## 4. Hosting your own HLS (only if you must)

Use **Cloudflare R2** — 10 GB free and **zero egress fees** (bandwidth is what makes video expensive; R2 is the only free tier that doesn't bill it). Do **not** use Convex file storage for video (bandwidth is billed).

```powershell
# 1. Encode to HLS once, locally (480p ≈ 400 MB/film → ~25 films in the free 10 GB)
ffmpeg -i movie.mp4 -vf scale=-2:480 -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 96k `
  -hls_time 10 -hls_playlist_type vod -hls_segment_filename "movie1/seg_%04d.ts" movie1/index.m3u8

# 2. Bucket + upload (wrangler is already installed in apps/website)
npx wrangler r2 bucket create v2e-movies
Get-ChildItem movie1 | ForEach-Object { npx wrangler r2 object put "v2e-movies/movie1/$($_.Name)" --file $_.FullName }

# 3. Cloudflare dashboard → R2 → v2e-movies → Settings
#    - Public access: enable r2.dev subdomain (or attach a custom domain)
#    - CORS: AllowedOrigins ["*"], AllowedMethods ["GET"]   ← required, player runs in a WebView
```

Stream URL in admin: `https://pub-xxxx.r2.dev/movie1/index.m3u8`.

Cost past the free tier: $0.015 / GB / month → 100 GB of films ≈ **$1.50 / month**. Egress stays free.

---

## 5. Deploy checklist

```powershell
cd D:\user\v2e\View2Earn
npx convex deploy                          # or `npx convex dev` if you stay on the dev deployment
npm run deploy -w @view2earn/admin-panel   # channels page without Auto-detect / Referrer fields
```

Then:
1. Delete all unlicensed channels from the `iptvChannels` table (see §1 warning).
2. Add movies per §3.
3. New Android build (the Movies tile and the removal of the Football/IPTV screen need a store release — the live build can't take OTA).

---

## 6. Ad placement summary (for the AdMob compliance doc)

| Placement | Trigger | Caps |
| :--- | :--- | :--- |
| Interstitial on Watch screens | User taps a channel/movie in the list (`LiveStreamsScreen.pick`) — **not on the YouTube tab** | 30 s min gap · 10 / session · UMP `canRequestAds` checked · never over playing video |

No banner or overlay is rendered on top of the player. Rewarded ads are unchanged (user-initiated only, see `ADMOB_COMPLIANCE_AND_MODERATION.md`).
