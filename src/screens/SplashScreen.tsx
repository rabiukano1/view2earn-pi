import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  useColorScheme,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ponytail: ONBOARDING_STORAGE_KEY used to track first-time app launch state; calibrate with persistent user analytics.
export const ONBOARDING_STORAGE_KEY = '@view2earn_has_seen_onboarding_v1';

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const LOGO_EMBLEM = require('../assets/logo.png');

export interface SplashSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  highlightColor: string;
  tags: string[];
  type: 'watch' | 'wallet' | 'payout';
}

const SLIDES: SplashSlide[] = [
  {
    id: 'slide_1',
    badge: 'WELCOME TO VIEW2EARN',
    title: 'Watch, Engage\n& Earn Rewards',
    subtitle: 'Turn your daily social views, micro-tasks, and quiz interactions into real crypto and reward points effortlessly.',
    highlightColor: '#8B5CF6', // Purple
    tags: ['Watch to Earn', 'Daily Quizzes', 'Social Micro-Tasks'],
    type: 'watch',
  },
  {
    id: 'slide_2',
    badge: 'DECENTRALIZED WALLET',
    title: 'Multi-Asset\nCrypto Rewards',
    subtitle: 'Seamlessly hold, swap, and manage PIPRO (Solana), VINTA, Sidra Coin, and Points in one secure vault.',
    highlightColor: '#FBBF24', // Gold
    tags: ['Pi & Solana Powered', 'Instant Swaps', 'Non-Custodial'],
    type: 'wallet',
  },
  {
    id: 'slide_3',
    badge: 'INSTANT PAYOUTS',
    title: 'Fast & Secure\nRedemptions',
    subtitle: 'Redeem your balance anytime to your favorite crypto address or payout account with full transparency.',
    highlightColor: '#10B981', // Emerald Green
    tags: ['Zero Hidden Fees', 'Instant Transfer', 'Verified Security'],
    type: 'payout',
  },
];

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<SplashSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const handleNext = async () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      await finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (e) {
      // ponytail: fallback logging for async storage errors during splash completion.
    }
    if (onFinish) {
      onFinish();
    }
  };

  const renderHeroGraphic = (item: SplashSlide) => {
    if (item.type === 'watch') {
      return (
        <View style={styles.heroContainer}>
          <View style={[styles.glowAura, { backgroundColor: '#8B5CF618', borderColor: '#8B5CF635' }]} />
          <View style={[styles.logoBadgeContainer, dark && styles.logoBadgeDark]}>
            <Image source={LOGO_EMBLEM} style={styles.logoImage} resizeMode="contain" />
          </View>

          {/* Floating Accents */}
          <View style={[styles.floatingChip, styles.topRightChip]}>
            <Icon name="coins" iconStyle="solid" size={13} color="#D97706" />
            <Text style={styles.chipText}>+50 PTS</Text>
          </View>
          <View style={[styles.floatingChip, styles.bottomLeftChip, { backgroundColor: '#8B5CF6' }]}>
            <Icon name="play" iconStyle="solid" size={12} color="#FFF" />
            <Text style={[styles.chipText, { color: '#FFF' }]}>Watch & Earn</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'wallet') {
      return (
        <View style={styles.heroContainer}>
          <View style={[styles.glowAura, { backgroundColor: '#FBBF2418', borderColor: '#FBBF2435' }]} />
          <View style={[styles.logoBadgeContainer, dark && styles.logoBadgeDark]}>
            <Image source={LOGO_EMBLEM} style={styles.logoImage} resizeMode="contain" />
          </View>

          {/* Floating Token Accents */}
          <View style={[styles.floatingChip, styles.topLeftChip]}>
            <View style={[styles.dotIndicator, { backgroundColor: '#8B5CF6' }]} />
            <Text style={styles.chipText}>PIPRO · Solana</Text>
          </View>
          <View style={[styles.floatingChip, styles.bottomRightChip]}>
            <View style={[styles.dotIndicator, { backgroundColor: '#FBBF24' }]} />
            <Text style={styles.chipText}>VINTA Token</Text>
          </View>
          <View style={[styles.floatingChip, styles.bottomLeftChip]}>
            <View style={[styles.dotIndicator, { backgroundColor: '#10B981' }]} />
            <Text style={styles.chipText}>Sidra Chain</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.heroContainer}>
        <View style={[styles.glowAura, { backgroundColor: '#10B98118', borderColor: '#10B98135' }]} />
        <View style={[styles.logoBadgeContainer, dark && styles.logoBadgeDark]}>
          <Image source={LOGO_EMBLEM} style={styles.logoImage} resizeMode="contain" />
        </View>

        {/* Floating Security & Payout Accents */}
        <View style={[styles.floatingChip, styles.topRightChip, { backgroundColor: '#10B981' }]}>
          <Icon name="shield-check" iconStyle="solid" size={13} color="#FFF" />
          <Text style={[styles.chipText, { color: '#FFF' }]}>100% Verified</Text>
        </View>
        <View style={[styles.floatingChip, styles.bottomLeftChip]}>
          <Icon name="bolt" iconStyle="solid" size={13} color="#10B981" />
          <Text style={styles.chipText}>Instant Payout</Text>
        </View>
      </View>
    );
  };

  const renderSlide = ({ item }: { item: SplashSlide }) => {
    return (
      <View style={[styles.slide, { width: WINDOW_WIDTH }]}>
        {/* Top Hero Graphic with Emblem Logo */}
        {renderHeroGraphic(item)}

        {/* Slide Copy */}
        <View style={styles.textContent}>
          <View style={[styles.badgePill, { backgroundColor: item.highlightColor + '18' }]}>
            <Text style={[styles.badgePillText, { color: item.highlightColor }]}>{item.badge}</Text>
          </View>

          <Text style={[styles.title, dark && styles.textLight]}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>

          {/* Feature Tags */}
          <View style={styles.tagRow}>
            {item.tags.map((tag, idx) => (
              <View key={idx} style={[styles.tagItem, dark && styles.tagItemDark]}>
                <Icon name="check" iconStyle="solid" size={12} color={item.highlightColor} />
                <Text style={[styles.tagText, dark && styles.tagTextDark]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const currentSlide = SLIDES[activeIndex];

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header with Skip Button */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.brandRow}>
          <Image source={LOGO_EMBLEM} style={styles.headerLogo} resizeMode="contain" />
        </View>
        {activeIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={finishOnboarding} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        getItemLayout={(_, index) => ({
          length: WINDOW_WIDTH,
          offset: WINDOW_WIDTH * index,
          index,
        })}
      />

      {/* Footer Navigation Controls */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {/* Pagination Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((slide, idx) => {
            const isActive = idx === activeIndex;
            return (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.activeDot, { backgroundColor: slide.highlightColor, width: 28 }]
                    : dark
                    ? styles.inactiveDotDark
                    : styles.inactiveDot,
                ]}
              />
            );
          })}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.88}
          style={[styles.actionButton, { backgroundColor: currentSlide.highlightColor }]}>
          <Text style={styles.actionButtonText}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          <Icon
            name={activeIndex === SLIDES.length - 1 ? 'rocket' : 'arrow-right'}
            iconStyle="solid"
            size={16}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  containerDark: {
    backgroundColor: colors.bgDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
    zIndex: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
  },
  skipText: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '700',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  heroContainer: {
    width: WINDOW_WIDTH * 0.75,
    height: WINDOW_WIDTH * 0.75,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  glowAura: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: WINDOW_WIDTH * 0.38,
    borderWidth: 2,
  },
  logoBadgeContainer: {
    width: 190,
    height: 160,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadow.float,
  },
  logoBadgeDark: {
    backgroundColor: colors.surfaceDark,
  },
  logoImage: {
    width: 165,
    height: 135,
  },
  floatingChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topRightChip: {
    top: 10,
    right: 0,
  },
  topLeftChip: {
    top: 10,
    left: 0,
  },
  bottomRightChip: {
    bottom: 10,
    right: 0,
  },
  bottomLeftChip: {
    bottom: 10,
    left: 0,
  },
  textContent: {
    alignItems: 'center',
    width: '100%',
  },
  badgePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: 14,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  tagItemDark: {
    backgroundColor: colors.surfaceDark,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  tagTextDark: {
    color: colors.textDark,
  },
  textLight: {
    color: colors.textDark,
  },
  footer: {
    paddingHorizontal: 28,
    gap: 20,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  activeDot: {
    borderRadius: 4,
  },
  inactiveDot: {
    backgroundColor: '#E2E8F0',
  },
  inactiveDotDark: {
    backgroundColor: '#334155',
  },
  actionButton: {
    width: '100%',
    height: 54,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...shadow.float,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
