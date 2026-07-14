import React from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme';

type Action = {
  label: string;
  onPress: () => void;
};

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  actions?: Action[];
};

export default function PageHeader({ title, subtitle, right, actions }: Props) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  // Under Android edge-to-edge, insets.top can read 0 before the frame is
  // measured, dropping the header behind the status bar — fall back to the
  // real status-bar height so the title always clears it.
  const topInset =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : insets.top;

  return (
    <View
      style={[
        styles.container,
        dark && styles.containerDark,
        { paddingTop: topInset + 12 },
      ]}>
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {right && <View style={styles.rightCol}>{right}</View>}
      </View>
      {actions && actions.length > 0 && (
        <View style={styles.actionRow}>
          {actions.map((a, i) => (
            <TouchableOpacity key={i} style={styles.actionChip} onPress={a.onPress} activeOpacity={0.75}>
              <Text style={styles.actionText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow.raised,
  },
  containerDark: {
    backgroundColor: colors.primaryDeep,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleCol: { flex: 1, marginRight: 12 },
  rightCol: {},
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.white,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#DDD6FE',
    marginTop: 3,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
