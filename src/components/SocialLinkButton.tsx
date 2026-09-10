import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { detectPlatform } from '../services/TaskLinkService';
import { openSocialLink } from '../utils/socialLinkUtils';
import { colors, radius, spacing } from '../theme';

type SocialLinkButtonProps = {
  url: string;
  label: string;
  type: 'profile' | 'post' | 'website';
};

const PLATFORM_TAG: Record<string, string> = {
  tiktok: 'TT',
  youtube: 'YT',
  instagram: 'IG',
  facebook: 'FB',
  x: 'X',
  twitter: 'X',
  linkedin: 'LI',
  whatsapp: 'WA',
  telegram: 'TG',
};

function platformTag(url: string): string {
  return PLATFORM_TAG[detectPlatform(url)] ?? 'WEB';
}

export default function SocialLinkButton({ url, label }: SocialLinkButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={() => openSocialLink(url)}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={styles.tag}>{platformTag(url)}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  tag: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
});