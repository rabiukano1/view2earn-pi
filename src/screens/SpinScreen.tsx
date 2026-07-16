import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SPIN_PRIZES } from '@view2earn/core';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';

type StackNav = NativeStackNavigationProp<RootStackParamList, 'Spin'>;

const SCREEN_W = Dimensions.get('window').width;
const TILE_INNER = 76;
const TILE_MARGIN = 8;
const TILE_W = TILE_INNER + TILE_MARGIN * 2; // full slot width
const LOOPS = 8; // full cycles before landing, for the spin effect
const LEN = SPIN_PRIZES.length;
// Enough tiles to cover the resting point plus a buffer past it.
const STRIP = Array.from({ length: (LOOPS + 2) * LEN }, (_, i) => SPIN_PRIZES[i % LEN]);

export default function SpinScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNav>();
  const route = useRoute();
  const { userId } = useAuth();

  const status = useQuery(api.spin.getSpinStatus, userId ? { userId } : 'skip');
  const doSpin = useMutation(api.spin.spin);

  const translateX = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const spunToday = status?.spunToday ?? false;

  const onSpin = async () => {
    if (!userId || spinning || spunToday || result !== null) return;
    setSpinning(true);
    setResult(null);
    try {
      const { index, pts } = await doSpin({ userId });
      // Land the chosen segment under the fixed center pointer.
      const target = LOOPS * LEN + index;
      const dest = SCREEN_W / 2 - (target * TILE_W + TILE_W / 2);
      translateX.setValue(0);
      Animated.timing(translateX, {
        toValue: dest,
        duration: 3400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setResult(pts);
        setSpinning(false);
      });
    } catch (e) {
      setSpinning(false);
      // Already spun / not signed in — status query will reflect it.
    }
  };

  const disabled = spinning || spunToday || result !== null || !userId;

  return (
    <View style={[styles.container, dark && styles.containerDark, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dark && styles.textLight]}>Spin Wheel</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.stage}>
        <Text style={styles.stageEmoji}>🎡</Text>
        <Text style={[styles.stageHint, dark && styles.textMuted]}>
          One free spin every day
        </Text>

        {/* Reel */}
        <View style={styles.reelWrap}>
          <Animated.View style={[styles.reel, { transform: [{ translateX }] }]}>
            {STRIP.map((p, i) => (
              <View key={i} style={[styles.tile, dark && styles.tileDark]}>
                <Text style={styles.tilePts}>{p.pts}</Text>
                <Text style={styles.tilePtsLabel}>pts</Text>
              </View>
            ))}
          </Animated.View>
          {/* Fixed center pointer */}
          <View pointerEvents="none" style={styles.pointer} />
          <View pointerEvents="none" style={styles.pointerCap} />
        </View>

        {result !== null ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultIcon}>🎉</Text>
            <Text style={[styles.resultTitle, dark && styles.textLight]}>You won</Text>
            <Text style={styles.resultPts}>+{result} pts</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
            onPress={onSpin}
            disabled={disabled}>
            <Text style={styles.primaryBtnText}>
              {spinning ? 'Spinning…' : spunToday ? 'Come back tomorrow' : 'SPIN'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: { width: 60 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textMuted },
  stage: { flex: 1, alignItems: 'center', paddingTop: 24, gap: 8 },
  stageEmoji: { fontSize: 56 },
  stageHint: { fontSize: 14, color: colors.textMuted, fontWeight: '600', marginBottom: 12 },
  reelWrap: {
    width: '100%',
    height: 108,
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 20,
  },
  reel: { flexDirection: 'row' },
  tile: {
    width: TILE_INNER,
    marginHorizontal: TILE_MARGIN,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  tileDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  tilePts: { fontSize: 26, fontWeight: '800', color: colors.primary },
  tilePtsLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  pointer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SCREEN_W / 2 - 1.5,
    width: 3,
    backgroundColor: colors.danger,
    borderRadius: 2,
  },
  pointerCap: {
    position: 'absolute',
    top: -2,
    left: SCREEN_W / 2 - 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.danger,
  },
  resultBox: { alignItems: 'center', gap: 6, marginTop: 12 },
  resultIcon: { fontSize: 44 },
  resultTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  resultPts: { fontSize: 34, fontWeight: '800', color: colors.success },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 56,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    ...shadow.raised,
  },
  primaryBtnDisabled: { backgroundColor: colors.textFaint, shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
});
