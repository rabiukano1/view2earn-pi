import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import type React from 'react';

// Widened FA6 so `iconStyle` (solid/regular/brand) is available.
const Icon = FontAwesome6 as unknown as React.ComponentType<{
  name: string;
  size?: number;
  color?: string;
  iconStyle?: 'solid' | 'regular' | 'brand';
}>;

export default Icon;
