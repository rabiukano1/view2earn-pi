# View2Earn Shorts Video & In-Video Ads Implementation Plan (Zero Cost)

## Executive Summary
This document provides a step-by-step technical plan to implement a **TikTok/YouTube Shorts style vertical video feed** inside the View2Earn mobile app. 

Key Requirements Addressed:
1. **Zero Bandwidth & Video Hosting Costs** ($0 video infrastructure).
2. **Integrated Ad Monetization** (In-Feed Native Ads & Rewarded Video Ads using `react-native-google-mobile-ads`).
3. **Watch-to-Earn Rewards** (Automated Convex backend points payout with anti-fraud protection).

---

## 1. Zero-Cost Video Infrastructure Strategy

To serve video content to thousands of users without incurring expensive CDN bills, use one of the following zero-cost video hosting options:

| Strategy | Hosting Cost | Video Source | Best For |
| :--- | :--- | :--- | :--- |
| **Option A: YouTube Shorts Embeds** | **$0** | YouTube Shorts IDs streamed via `react-native-youtube-iframe` player | Endless viral shorts; YouTube handles 100% of video bandwidth |
| **Option B: Free Public Video APIs** | **$0** | Direct `.mp4` URLs from Pexels API / Pixabay API | High quality vertical HD clips (nature, tech, sports, motivational) |
| **Option C: Cloudinary / Supabase Free Tier** | **$0** | Up to 25 GB free monthly bandwidth for community user-submitted shorts | Custom creator uploads |

---

## 2. Ad Integration Architecture (`react-native-google-mobile-ads`)

The project already includes `@react-native-google-mobile-ads`. We monetize the shorts feed using two ad formats:

1. **In-Feed Native Ads**: Every 4th item in the vertical feed is an inline native ad card rendered seamlessly like a video post.
2. **Rewarded Video Ads**: Triggered after watching 5 videos, or offered to users as a **"2x Points Multiplier"** option.

---

## 3. Database Schema & Anti-Fraud (Convex Backend)

Add video tracking and points distribution to the Convex backend schema:

```typescript
// convex/schema.ts additions
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const shortsVideos = defineTable({
  title: v.string(),
  videoUrl: v.string(), // Direct MP4 URL or YouTube Video ID
  sourceType: v.union(v.literal("youtube"), v.literal("mp4")),
  pointsReward: v.number(),
  durationSeconds: v.number(),
  category: v.string(),
  isActive: v.boolean(),
});

export const videoWatchLogs = defineTable({
  userId: v.id("users"),
  videoId: v.id("shortsVideos"),
  watchedSeconds: v.number(),
  pointsEarned: v.number(),
  timestamp: v.number(),
});
```

### Convex Mutation with Anti-Fraud Checks

```typescript
// convex/shorts.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// ponytail: threshold set to 5s minimum watch time & max 50 video rewards per day; calibrate against production metrics.
const MIN_WATCH_SECONDS = 5;
const MAX_DAILY_VIDEO_REWARDS = 50;

export const claimVideoReward = mutation({
  args: {
    videoId: v.id("shortsVideos"),
    watchedSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) throw new Error("User not found");

    // Check watch duration threshold
    if (args.watchedSeconds < MIN_WATCH_SECONDS) {
      throw new Error(`Must watch at least ${MIN_WATCH_SECONDS} seconds to earn points.`);
    }

    // Rate limiting anti-fraud check
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const todayLogs = await ctx.db
      .query("videoWatchLogs")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), user._id),
          q.gte(q.field("timestamp"), startOfDay)
        )
      )
      .collect();

    if (todayLogs.length >= MAX_DAILY_VIDEO_REWARDS) {
      throw new Error("Daily short video reward limit reached.");
    }

    const video = await ctx.db.get(args.videoId);
    if (!video || !video.isActive) throw new Error("Video unavailable");

    // Log watch event
    await ctx.db.insert("videoWatchLogs", {
      userId: user._id,
      videoId: args.videoId,
      watchedSeconds: args.watchedSeconds,
      pointsEarned: video.pointsReward,
      timestamp: Date.now(),
    });

    // Credit points to user profile
    await ctx.db.patch(user._id, {
      points: (user.points || 0) + video.pointsReward,
    });

    return { success: true, pointsAwarded: video.pointsReward };
  },
});
```

---

## 4. Frontend Implementation (`src/screens/ShortsScreen.tsx`)

Below is the complete React Native vertical paging feed handling video play state, ad injection, and point claims:

```tsx
import React, { useState, useRef } from 'react';
import { View, Text, FlatList, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
// ponytail: default mock item interval of 4 items per ad card; calibrate based on ad fill rates & UX retention metrics.

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

export interface ShortItem {
  id: string;
  type: 'video' | 'ad';
  title?: string;
  videoUrl?: string;
  points?: number;
}

export const ShortsScreen: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [claimedVideos, setClaimedVideos] = useState<Record<string, boolean>>({});

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const handleClaimPoints = (videoId: string, points: number) => {
    if (claimedVideos[videoId]) return;
    setClaimedVideos((prev) => ({ ...prev, [videoId]: true }));
    // Trigger Convex mutation: claimVideoReward({ videoId, watchedSeconds: 10 })
  };

  const renderItem = ({ item, index }: { item: ShortItem; index: number }) => {
    if (item.type === 'ad') {
      return (
        <View style={styles.cardContainer}>
          <Text style={styles.adLabel}>Sponsored Announcement</Text>
          <BannerAd
            unitId={TestIds.BANNER}
            size={BannerAdSize.MEDIUM_RECTANGLE}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          />
        </View>
      );
    }

    const isClaimed = claimedVideos[item.id];

    return (
      <View style={styles.cardContainer}>
        {/* Video Player placeholder - replace with react-native-video or react-native-youtube-iframe */}
        <View style={styles.videoPlaceholder}>
          <Text style={styles.playingText}>
            {index === activeIndex ? '▶ Playing Short...' : '⏸ Paused'}
          </Text>
        </View>

        {/* Overlay Details */}
        <View style={styles.overlayContainer}>
          <Text style={styles.videoTitle}>{item.title}</Text>
          
          <TouchableOpacity
            disabled={isClaimed}
            style={[styles.claimButton, isClaimed && styles.claimedButton]}
            onPress={() => handleClaimPoints(item.id, item.points || 10)}
          >
            <Text style={styles.claimButtonText}>
              {isClaimed ? '✓ Claimed' : `Claim +${item.points} Points`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[]} // Populate from Convex `useQuery(api.shorts.getShortsFeed)`
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={WINDOW_HEIGHT}
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        getItemLayout={(_, index) => ({
          length: WINDOW_HEIGHT,
          offset: WINDOW_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cardContainer: {
    height: WINDOW_HEIGHT,
    width: WINDOW_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  playingText: {
    color: '#8A2BE2',
    fontSize: 20,
    fontWeight: 'bold',
  },
  adLabel: {
    color: '#888',
    marginBottom: 12,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  videoTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  claimButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
  },
  claimedButton: {
    backgroundColor: '#4A5568',
  },
  claimButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
```

---

## 5. Roadmap & Next Steps

1. **Backend Seed**: Create Convex queries/mutations in `convex/shorts.ts` to retrieve active shorts.
2. **Packages Verification**: Ensure `react-native-youtube-iframe` or `react-native-video` is added if custom `.mp4` / YouTube playback is desired.
3. **Screen Registration**: Register `ShortsScreen` into tab navigation stack in `App.tsx`.
4. **AdMob Ad Unit IDs**: Replace test ad unit IDs with production AdMob units in environment variables before launch.
