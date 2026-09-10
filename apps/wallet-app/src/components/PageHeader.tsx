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
import { useNavigation } from '@react-navigation/native';
import Icon from './Icon';
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
  back?: boolean;
  onBack?: () => void;
};

export default function PageHeader({ title, subtitle, right, actions, back, onBack }: Props) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const showBack = back ?? false;
  const handleBack = onBack ?? (() => navigation.canGoBack() && navigation.goBack());

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
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBack}
              style={[styles.backBtn, dark && styles.backBtnDark]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon
                name="arrow-left"
                iconStyle="solid"
                size={16}
                color={dark ? colors.textDark : colors.text}
              />
            </TouchableOpacity>
          ) : null}
          <View style={styles.titleWrap}>
            <Text style={[styles.title, dark && styles.titleDark]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, dark && styles.subtitleDark]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>

      {actions && actions.length > 0 ? (
        <View style={styles.actionsRow}>
          {actions.map((act) => (
            <TouchableOpacity
              key={act.label}
              onPress={act.onPress}
              style={[styles.actionBtn, dark && styles.actionBtnDark]}>
              <Text style={[styles.actionLabel, dark && styles.actionLabelDark]}>
                {act.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  containerDark: {
    backgroundColor: colors.surfaceDark,
    borderBottomColor: colors.borderDark,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnDark: {
    backgroundColor: colors.surfaceAltDark,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  titleDark: {
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 2,
  },
  subtitleDark: {
    color: colors.textFaint,
  },
  right: {
    marginLeft: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  actionBtnDark: {
    backgroundColor: colors.primarySoftDark,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDeep,
  },
  actionLabelDark: {
    color: '#C4B5FD',
  },
});
