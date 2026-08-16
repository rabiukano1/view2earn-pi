import React from 'react';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';

// Real brand logos for each social platform (FontAwesome 6 Brands).
const BRAND: Record<string, string> = {
  facebook: 'facebook',
  tiktok: 'tiktok',
  telegram: 'telegram',
  instagram: 'instagram',
  youtube: 'youtube',
  x: 'x-twitter',
  linkedin: 'linkedin',
  whatsapp: 'whatsapp',
};

export const PLATFORM_COLOR: Record<string, string> = {
  facebook: '#1877F2',
  tiktok: '#000000',
  telegram: '#229ED9',
  instagram: '#E4405F',
  youtube: '#FF0000',
  x: '#000000',
  linkedin: '#0A66C2',
  whatsapp: '#25D366',
  app: '#7C3AED',
};

export function platformColor(platform: string): string {
  return PLATFORM_COLOR[platform] ?? '#6B7280';
}

// `iconStyle` isn't in the base Icon prop types — widen it here.
const Icon = FontAwesome6 as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  iconStyle?: 'solid' | 'regular' | 'brand';
}>;

export default function PlatformIcon({
  platform,
  size = 20,
  color = '#FFFFFF',
}: {
  platform: string;
  size?: number;
  color?: string;
}) {
  const brand = BRAND[platform];
  if (brand) {
    return <Icon name={brand} iconStyle="brand" size={size} color={color} />;
  }
  // Non-brand platforms (e.g. our own "app" tasks).
  return <Icon name="bolt" iconStyle="solid" size={size} color={color} />;
}
