import React from 'react';
import { Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootTabParamList, RootStackParamList } from './types';
import { colors, radius, shadow } from '../theme';

import TasksScreen from '../screens/TasksScreen';
import RewardsScreen from '../screens/RewardsScreen';
import QuizScreen from '../screens/QuizScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import PointsHistoryScreen from '../screens/PointsHistoryScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TABS = [
  { name: 'Tasks', icon: '📋', component: TasksScreen },
  { name: 'Rewards', icon: '🎁', component: RewardsScreen },
  { name: 'Quiz', icon: '🧠', component: QuizScreen },
  { name: 'Leaderboard', icon: '🏆', component: LeaderboardScreen },
  { name: 'Profile', icon: '👤', component: ProfileScreen },
] as const;

function TabIcon({ icon, focused, dark }: { icon: string; focused: boolean; dark: boolean }) {
  return (
    <View
      style={[
        styles.iconPill,
        focused && (dark ? styles.iconPillActiveDark : styles.iconPillActive),
      ]}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>{icon}</Text>
    </View>
  );
}

function MainTabs() {
  const dark = useColorScheme() === 'dark';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, dark && styles.tabBarDark],
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabBarItem,
      }}>
      {TABS.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={t.icon} focused={focused} dark={dark} />
            ),
          }}
        />
      ))}
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
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 24 : 14,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    paddingHorizontal: 6,
    ...shadow.float,
  },
  tabBarDark: {
    backgroundColor: colors.surfaceDark,
  },
  tabBarItem: {
    height: 64,
    paddingVertical: 0,
  },
  iconPill: {
    width: 48,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.primarySoft,
  },
  iconPillActiveDark: {
    backgroundColor: colors.primarySoftDark,
  },
  tabEmoji: {
    fontSize: 21,
    opacity: 0.5,
  },
  tabEmojiFocused: {
    opacity: 1,
  },
});
