import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PageHeader from '../components/PageHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  tiktok: '#010101',
  telegram: '#229ED9',
  youtube: '#FF0000',
  x: '#000000',
};

export default function MarketplaceScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const navigation = useNavigation<Nav>();

  const listings = useQuery(api.marketplace.listListings);
  const myListings = useQuery(api.marketplace.myListings, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');
  const cancelListing = useMutation(api.marketplace.cancelListing);


  const handleCancel = (listingId: Id<'marketplaceListings'>) => {
    Alert.alert('Cancel listing', 'Unused points will be refunded.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel listing',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelListing({ userId: userId!, listingId });
          } catch (e) {
            Alert.alert('Error', String(e));
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Marketplace"
        subtitle="List your profile — earn points when others follow"
        right={
          <View style={styles.balancePill}>
            <Text style={styles.balanceText}>{balance === undefined ? '…' : balance} pts</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.createCard}
        activeOpacity={0.85}
        onPress={() => userId && navigation.navigate('CreateListing', { userId })}>
        <View style={styles.createIcon}>
          <Text style={styles.createIconText}>+</Text>
        </View>
        <View style={styles.createBody}>
          <Text style={[styles.createTitle, dark && styles.textLight]}>Create a listing</Text>
          <Text style={styles.createSub}>Spend points to promote your profile</Text>
        </View>
      </TouchableOpacity>

      {myListings && myListings.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, dark && styles.textLight]}>My listings</Text>
          {myListings.map((l) => {
            const color = PLATFORM_COLORS[l.platform] ?? '#6B7280';
            const pct = Math.round((l.completionsSoFar / l.maxCompletions) * 100);
            return (
              <View key={l._id} style={[styles.listingCard, dark && styles.listingCardDark]}>
                <View style={styles.listingTop}>
                  <View style={[styles.listingBadge, { backgroundColor: color }]}>
                    <Text style={styles.listingBadgeText}>{l.platform[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.listingInfo}>
                    <Text style={[styles.listingName, dark && styles.textLight]}>{l.targetUrl.replace(/\/+$/, '').split('/').pop()}</Text>
                    <Text style={styles.listingSub}>{l.platform} · {l.pointsReward} pts each</Text>
                  </View>
                  <Text style={styles.listingStatus}>{l.status}</Text>
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{l.completionsSoFar}/{l.maxCompletions}</Text>
                </View>
                {l.status === 'active' && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(l._id)}>
                    <Text style={styles.cancelBtnText}>Cancel & refund</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, dark && styles.textLight]}>All listings</Text>
        {listings === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, dark && styles.textMuted]}>No listings yet. Be the first!</Text>
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const color = PLATFORM_COLORS[item.platform] ?? '#6B7280';
              const pct = Math.round((item.completionsSoFar / item.maxCompletions) * 100);
              return (
                <View style={[styles.listingCard, dark && styles.listingCardDark]}>
                  <View style={styles.listingTop}>
                    <View style={[styles.listingBadge, { backgroundColor: color }]}>
                      <Text style={styles.listingBadgeText}>{item.platform[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.listingInfo}>
                      <Text style={[styles.listingName, dark && styles.textLight]}>
                        {item.targetUrl.replace(/\/+$/, '').split('/').pop()}
                      </Text>
                      <Text style={styles.listingSub}>{item.platform} · {item.pointsReward} pts reward</Text>
                    </View>
                  </View>
                  <View style={styles.progressRow}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{item.completionsSoFar}/{item.maxCompletions}</Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F5' },
  containerDark: { backgroundColor: '#18181B' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#18181B' },
  headerSubtitle: { fontSize: 14, color: '#71717A', marginTop: 4 },
  textLight: { color: '#FAFAFA' },
  textMuted: { color: '#A1A1AA' },
  balancePill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  balanceText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
  },
  createIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginTop: -2 },
  createBody: { marginLeft: 14, flex: 1 },
  createTitle: { fontSize: 16, fontWeight: '700', color: '#18181B' },
  createSub: { fontSize: 13, color: '#6D28D9', marginTop: 2 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#18181B', marginBottom: 10 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 15, color: '#71717A' },
  listingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  listingCardDark: { backgroundColor: '#27272A' },
  listingTop: { flexDirection: 'row', alignItems: 'center' },
  listingBadge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listingBadgeText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  listingInfo: { flex: 1, marginLeft: 12 },
  listingName: { fontSize: 15, fontWeight: '600', color: '#18181B' },
  listingSub: { fontSize: 12, color: '#71717A', marginTop: 2 },
  listingStatus: { fontSize: 12, fontWeight: '700', color: '#7C3AED', textTransform: 'capitalize' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#E4E4E7', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: '#7C3AED', borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '700', color: '#71717A', width: 60, textAlign: 'right' },
  cancelBtn: { marginTop: 10, alignSelf: 'flex-end' },
  cancelBtnText: { fontSize: 13, color: '#DC2626', fontWeight: '600' },
});
