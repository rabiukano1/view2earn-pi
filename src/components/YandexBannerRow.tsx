import React, { useEffect, useState } from 'react';
import { Dimensions, View } from 'react-native';
import { BannerAdSize, BannerView } from 'yandex-mobile-ads';
import {
  YANDEX_BANNER_MAX_HEIGHT,
  initializeYandexAds,
  yandexBannerUnit,
} from '../services/yandexAdsService';
import { spacing } from '../theme';

// One Yandex banner, rendered as a row inside the voices list.
//
// It occupies no space until an ad has actually loaded: a no-fill (the normal
// case outside RU/CIS) must not leave a gap in the list, and a reserved-but-
// empty slot is also what gets a placement flagged as an unfilled ad request.

type Size = Awaited<ReturnType<typeof BannerAdSize.inlineSize>>;

export default function YandexBannerRow() {
  const [unit, setUnit] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Awaiting init is what makes the consent decision reliable here; it is
    // idempotent, so this costs nothing after the first banner.
    initializeYandexAds()
      .then(() => {
        const u = yandexBannerUnit();
        if (!alive || !u) return;
        setUnit(u);
        // Width minus the list's horizontal padding, so the banner lines up
        // with the voice rows instead of running edge to edge.
        const width = Dimensions.get('window').width - spacing.lg * 2;
        return BannerAdSize.inlineSize(width, YANDEX_BANNER_MAX_HEIGHT).then(
          (s) => alive && setSize(s),
        );
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (!unit || !size || failed) return null;

  return (
    <View style={loaded ? { marginBottom: spacing.md } : { height: 0, overflow: 'hidden' }}>
      <BannerView
        size={size}
        adRequest={{ adUnitId: unit }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={(e) => {
          setFailed(true);
          if (__DEV__) console.log('[yandex] banner no-fill', e.nativeEvent?.description);
        }}
      />
    </View>
  );
}
