import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { shadow } from '../theme';
import Icon from './Icon';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

// 10 Sector Prize Configuration
export interface WheelSectorPrize {
  pts: number;
  label: string;
  sublabel: string;
  type: 'pts' | 'zero';
  color: string;
  textColor: string;
  icon: string;
}

// ponytail: 10 equal 36° sectors as specified by user requirements; calibrate reward distribution on server.
export const TEN_WHEEL_PRIZES: WheelSectorPrize[] = [
  { pts: 10, label: '10', sublabel: 'PTS', type: 'pts', color: '#8B5CF6', textColor: '#FFF', icon: 'coins' },
  { pts: 25, label: '25', sublabel: 'PTS', type: 'pts', color: '#5B21B6', textColor: '#FFF', icon: 'coins' },
  { pts: 50, label: '50', sublabel: 'PTS', type: 'pts', color: '#8B5CF6', textColor: '#FFF', icon: 'coins' },
  { pts: 0, label: 'NO', sublabel: 'BONUS', type: 'zero', color: '#5B21B6', textColor: '#FFF', icon: 'box-open' },
  { pts: 100, label: '100', sublabel: 'PTS', type: 'pts', color: '#8B5CF6', textColor: '#FFF', icon: 'coins' },
  { pts: 15, label: '15', sublabel: 'PTS', type: 'pts', color: '#5B21B6', textColor: '#FFF', icon: 'coins' },
  { pts: 250, label: '250', sublabel: 'PTS', type: 'pts', color: '#8B5CF6', textColor: '#FFF', icon: 'coins' },
  { pts: 500, label: '500', sublabel: 'PTS', type: 'pts', color: '#5B21B6', textColor: '#FFF', icon: 'coins' },
  { pts: 0, label: 'NO', sublabel: 'BONUS', type: 'zero', color: '#8B5CF6', textColor: '#FFF', icon: 'box-open' },
  { pts: 35, label: '35', sublabel: 'PTS', type: 'pts', color: '#5B21B6', textColor: '#FFF', icon: 'coins' },
];

interface SvgSpinWheelProps {
  size?: number;
  spinning: boolean;
  disabled: boolean;
  spinInterpolation: Animated.AnimatedInterpolation<string | number>;
  onSpinPress: () => void;
}

export default function SvgSpinWheel({
  size = Math.min(WINDOW_WIDTH * 0.85, 330),
  spinning,
  disabled,
  spinInterpolation,
  onSpinPress,
}: SvgSpinWheelProps) {
  const containerSize = size;
  const cx = containerSize / 2;
  const cy = containerSize / 2;
  // Radius is exactly 45% of container width (leaving 5% margin for pointer & outer bezel)
  const r = 0.45 * containerSize;
  const numSectors = 10;
  const sectorAngle = 360 / numSectors; // Exactly 36°

  // Generate exact SVG path string for a circular sector from startAngle to endAngle
  const createSectorPath = (index: number) => {
    const startAngle = index * sectorAngle - 90;
    const endAngle = (index + 1) * sectorAngle - 90;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
  };

  return (
    <View style={[styles.wheelContainer, { width: containerSize, height: containerSize }]}>
      {/* FIXED POINTER AT 12 O'CLOCK (Does NOT rotate; stays fixed above wheel) */}
      <View style={[styles.pointerWrap, { top: cy - r - 18 }]}>
        <Svg width={36} height={36} viewBox="0 0 36 36">
          {/* Gold Downward Triangle Pointer */}
          <Path
            d="M 18 34 L 4 4 L 32 4 Z"
            fill="#FBBF24"
            stroke="#D97706"
            strokeWidth="2"
          />
        </Svg>
      </View>

      {/* ROTATING WHEEL LAYER (Rotates complete SVG wheel around exact center cx, cy) */}
      <Animated.View
        style={[
          styles.rotatingWheelLayer,
          {
            width: containerSize,
            height: containerSize,
            transform: [{ rotate: spinInterpolation }],
          },
        ]}>
        <Svg width={containerSize} height={containerSize} viewBox={`0 0 ${containerSize} ${containerSize}`}>
          <Defs>
            <ClipPath id="wheelClip">
              <Circle cx={cx} cy={cy} r={r} />
            </ClipPath>
          </Defs>

          {/* Outer Bezel Rim */}
          <Circle cx={cx} cy={cy} r={r + 8} fill="#6D28D9" stroke="#8B5CF6" strokeWidth="4" />

          {/* Bezel Stud Dots around Rim */}
          {Array.from({ length: 10 }).map((_, idx) => {
            const angle = idx * 36 - 90;
            const rad = (angle * Math.PI) / 180;
            const studR = r + 4;
            const sx = cx + studR * Math.cos(rad);
            const sy = cy + studR * Math.sin(rad);
            return <Circle key={idx} cx={sx} cy={sy} r={3} fill="#DDD6FE" />;
          })}

          {/* MATHEMATICALLY CONSTRUCTED 10 SECTORS (Clipped to circular boundary) */}
          <G clipPath="url(#wheelClip)">
            {TEN_WHEEL_PRIZES.map((prize, i) => {
              const d = createSectorPath(i);
              const bisectorAngle = i * sectorAngle + sectorAngle / 2 - 90;
              const bisectorRad = (bisectorAngle * Math.PI) / 180;

              // Position label radially at 65% of radius
              const labelR = 0.65 * r;
              const lx = cx + labelR * Math.cos(bisectorRad);
              const ly = cy + labelR * Math.sin(bisectorRad);
              const textRotation = i * sectorAngle + sectorAngle / 2;

              return (
                <G key={i}>
                  {/* Exact Circular Sector Path */}
                  <Path d={d} fill={prize.color} stroke="#3B0764" strokeWidth="1.5" />

                  {/* Radially Oriented Prize Label Group */}
                  <G transform={`translate(${lx}, ${ly}) rotate(${textRotation})`}>
                    <SvgText
                      x="0"
                      y="-4"
                      textAnchor="middle"
                      fill={prize.textColor}
                      fontSize="16"
                      fontWeight="900"
                      fontFamily="System">
                      {prize.label}
                    </SvgText>
                    <SvgText
                      x="0"
                      y="9"
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.85)"
                      fontSize="8.5"
                      fontWeight="800"
                      fontFamily="System">
                      {prize.sublabel}
                    </SvgText>
                  </G>
                </G>
              );
            })}
          </G>
        </Svg>
      </Animated.View>

      {/* CENTER PERFECT CIRCULAR "SPIN" BUTTON (Stays fixed ABOVE wheel layer at exact center cx, cy) */}
      <TouchableOpacity
        style={[
          styles.centerSpinButton,
          {
            left: cx - 44,
            top: cy - 44,
            width: 88,
            height: 88,
            borderRadius: 44,
          },
          disabled && styles.centerSpinDisabled,
        ]}
        onPress={onSpinPress}
        disabled={disabled}
        activeOpacity={0.88}>
        <View style={styles.centerSpinInner}>
          {spinning ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.centerSpinText}>SPIN</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    aspectRatio: 1,
  },
  pointerWrap: {
    position: 'absolute',
    zIndex: 30,
    alignItems: 'center',
  },
  rotatingWheelLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
  },
  centerSpinButton: {
    position: 'absolute',
    zIndex: 40,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FDE047',
    ...shadow.float,
  },
  centerSpinDisabled: {
    opacity: 0.7,
  },
  centerSpinInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSpinText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
