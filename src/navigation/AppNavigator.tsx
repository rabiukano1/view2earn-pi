import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootTabParamList, RootStackParamList } from './types';
import Icon from '../components/Icon';
import RewardedAdModal from '../components/RewardedAdModal';
import { colors, radius, shadow } from '../theme';

import HomeScreen from '../screens/HomeScreen';
import TasksScreen from '../screens/TasksScreen';
import RewardsScreen from '../screens/RewardsScreen';
import QuizScreen from '../screens/QuizScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import PointsHistoryScreen from '../screens/PointsHistoryScreen';
import AcademyScreen from '../screens/AcademyScreen';
import SpinScreen from '../screens/SpinScreen';
import WalletScreen from '../screens/WalletScreen';
import WalletHistoryScreen from '../screens/WalletHistoryScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_META: Record<keyof RootTabParamList, { icon: string; label: string }> = {
  Home: { icon: 'house', label: 'Home' },
  Tasks: { icon: 'list-check', label: 'Tasks' },
  Wallet: { icon: 'wallet', label: 'Wallet' },
  Rewards: { icon: 'gift', label: 'Rewards' },
  Leaderboard: { icon: 'trophy', label: 'Ranks' },
  Profile: { icon: 'user', label: 'Profile' },
};

// Floating pill tab bar: the active tab expands to show its label, the rest
// stay icon-only. One custom bar instead of per-tab icon options.
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [adVisible, setAdVisible] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<{ name: string; params?: any } | null>(null);

  const handleAdSuccess = () => {
    if (pendingRoute) {
      navigation.navigate(pendingRoute.name as any, pendingRoute.params);
      setPendingRoute(null);
    }
    setAdVisible(false);
  };

  return (
    <>
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
              if (route.name === 'Profile') {
                navigation.navigate(route.name);
              } else {
                setPendingRoute({ name: route.name, params: undefined });
                setAdVisible(true);
              }
            } else if (focused) {
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
                {focused && (
                  <Text style={[styles.pillLabel, dark && styles.pillLabelDark]}>
                    {meta.label}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <RewardedAdModal
        visible={adVisible}
        onClose={() => setAdVisible(false)}
        onSuccess={handleAdSuccess}
      />
    </>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
      <Stack.Screen
        name="CreateListing"
        component={CreateListingScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="PointsHistory" component={PointsHistoryScreen} />
      <Stack.Screen name="WalletHistory" component={WalletHistoryScreen} />
      <Stack.Screen name="Academy" component={AcademyScreen} />
      <Stack.Screen name="Quiz" component={QuizScreen} />
      <Stack.Screen name="Spin" component={SpinScreen} />
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
  tabEmoji: {
    fontSize: 21,
    opacity: 0.5,
  },
  tabEmojiFocused: {
    opacity: 1,
  },
});
