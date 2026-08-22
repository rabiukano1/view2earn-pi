import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootTabParamList, RootStackParamList } from './types';
import Icon from '../components/Icon';
import { colors, radius, shadow } from '../theme';

import HomeScreen from '../screens/HomeScreen';
import TasksScreen from '../screens/TasksScreen';
import RewardsScreen from '../screens/RewardsScreen';
import QuizScreen from '../screens/QuizScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import PointsHistoryScreen from '../screens/PointsHistoryScreen';
import AcademyScreen from '../screens/AcademyScreen';
import SpinScreen from '../screens/SpinScreen';
import SurveysScreen from '../screens/SurveysScreen';
import WalletScreen from '../screens/WalletScreen';
import WalletHistoryScreen from '../screens/WalletHistoryScreen';
import TermsScreen from '../screens/TermsScreen';
import PolicyScreen from '../screens/PolicyScreen';
import ReferralScreen from '../screens/ReferralScreen';
import LinkedAccountsScreen from '../screens/LinkedAccountsScreen';
import SecurityScreen from '../screens/SecurityScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import DonateScreen from '../screens/DonateScreen';
import StatsScreen from '../screens/StatsScreen';
import PayoutSettingsScreen from '../screens/PayoutSettingsScreen';
import LevelScreen from '../screens/LevelScreen';

import LoginScreen from '../screens/LoginScreen';
import { useAuth } from '../auth/AuthContext';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_META: Record<keyof RootTabParamList, { icon: string; label: string }> = {
  Home: { icon: 'house', label: 'Home' },
  Tasks: { icon: 'list-check', label: 'Tasks' },
  Wallet: { icon: 'wallet', label: 'Wallet' },
  Rewards: { icon: 'gift', label: 'Rewards' },
  Settings: { icon: 'gear', label: 'Settings' },
  Profile: { icon: 'user', label: 'Profile' },
};

// Floating pill tab bar: the active tab expands to show its label, the rest
// stay icon-only. One custom bar instead of per-tab icon options.
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

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

function MainTabs() {
  const flags = useQuery(api.features.getFlags) || {};
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      {flags['feature:tasks'] !== false && <Tab.Screen name="Tasks" component={TasksScreen} />}
      {flags['feature:wallet'] !== false && <Tab.Screen name="Wallet" component={WalletScreen} />}
      {flags['feature:rewards'] !== false && <Tab.Screen name="Rewards" component={RewardsScreen} />}
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  onShowSplash?: () => void;
}

export default function AppNavigator({ onShowSplash }: AppNavigatorProps = {}) {
  const { userId } = useAuth();
  const flags = useQuery(api.features.getFlags) || {};

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userId ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Level" component={LevelScreen} />
          <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
          <Stack.Screen
            name="CreateListing"
            component={CreateListingScreen}
            options={{ presentation: 'modal' }}
          />
          {flags['feature:rewards'] !== false && (
            <Stack.Screen name="PointsHistory" component={PointsHistoryScreen} />
          )}
          {flags['feature:wallet'] !== false && (
            <Stack.Screen name="WalletHistory" component={WalletHistoryScreen} />
          )}
          <Stack.Screen name="Academy" component={AcademyScreen} />
          <Stack.Screen name="Quiz" component={QuizScreen} />
          <Stack.Screen name="Spin" component={SpinScreen} />
          <Stack.Screen name="Surveys" component={SurveysScreen} />
          <Stack.Screen name="Terms" component={TermsScreen} />
          <Stack.Screen name="Policy" component={PolicyScreen} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
          <Stack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
          <Stack.Screen name="Security" component={SecurityScreen} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="Stats" component={StatsScreen} />
          {flags['feature:wallet'] !== false && (
            <Stack.Screen name="PayoutSettings" component={PayoutSettingsScreen} />
          )}
          <Stack.Screen name="Donate" component={DonateScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onShowSplash={onShowSplash} />}
          </Stack.Screen>
          <Stack.Screen name="Terms" component={TermsScreen} />
          <Stack.Screen name="Policy" component={PolicyScreen} />
        </>
      )}
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
