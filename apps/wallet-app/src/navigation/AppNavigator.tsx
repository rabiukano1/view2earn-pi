import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootTabParamList, RootStackParamList } from './types';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';

import WalletScreen from '../screens/WalletScreen';
import RewardsScreen from '../screens/RewardsScreen';
import WalletHistoryScreen from '../screens/WalletHistoryScreen';
import PointsHistoryScreen from '../screens/PointsHistoryScreen';
import PayoutSettingsScreen from '../screens/PayoutSettingsScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_META: Record<keyof RootTabParamList, { icon: string; label: string }> = {
  Wallet: { icon: 'wallet', label: 'Wallet' },
  Rewards: { icon: 'gift', label: 'Rewards' },
  History: { icon: 'clock-rotate-left', label: 'History' },
  Settings: { icon: 'gear', label: 'Settings' },
};

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        dark && styles.tabBarDark,
        { bottom: Math.max(insets.bottom, 12) },
      ]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TAB_META[route.name as keyof RootTabParamList];
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            activeOpacity={0.85}
            style={styles.tabItem}>
            <View
              style={[
                styles.pill,
                focused && (dark ? styles.pillActiveDark : styles.pillActive),
              ]}>
              <Icon
                name={meta.icon}
                iconStyle="solid"
                size={20}
                color={
                  focused
                    ? dark
                      ? '#C4B5FD'
                      : colors.primaryDeep
                    : colors.textFaint
                }
              />
              {focused ? (
                <Text style={[styles.pillLabel, dark && styles.pillLabelDark]}>
                  {meta.label}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      id="MainTabs"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="History" component={WalletHistoryScreen} />
      <Tab.Screen name="Settings" component={PayoutSettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="WalletHistory" component={WalletHistoryScreen} />
      <Stack.Screen name="PointsHistory" component={PointsHistoryScreen} />
      <Stack.Screen name="PayoutSettings" component={PayoutSettingsScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    ...shadow.float,
  },
  tabBarDark: {
    backgroundColor: colors.surfaceDark,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  pillActive: {
    backgroundColor: colors.primarySoft,
  },
  pillActiveDark: {
    backgroundColor: colors.primarySoftDark,
  },
  pillLabel: {
    color: colors.primaryDeep,
    fontWeight: '800',
    fontSize: 13,
  },
  pillLabelDark: {
    color: '#C4B5FD',
  },
});
