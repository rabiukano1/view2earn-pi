import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { deviceFingerprint } from '../lib/device';
import PageHeader from '../components/PageHeader';

export default function SurveysScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<Id<'users'> | null>(null);

  const getOrCreateDevUser = useMutation(api.users.getOrCreateDevUser);
  const surveys = useQuery(api.surveys.listAvailable, userId ? { userId } : 'skip');
  const balance = useQuery(api.users.balance, userId ? { userId } : 'skip');

  useEffect(() => {
    getOrCreateDevUser({ deviceFingerprint: deviceFingerprint() })
      .then((id) => setUserId(id))
      .catch((e) => Alert.alert('Error', String(e)));
  }, [getOrCreateDevUser]);

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <PageHeader
        title="Surveys"
        subtitle="Complete surveys to earn points"
        right={
          <View style={styles.balancePill}>
            <Text style={styles.balanceText}>
              {balance === undefined ? '…' : balance} pts
            </Text>
          </View>
        }
      />
      {surveys === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : surveys.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, dark && styles.textLight]}>No surveys available</Text>
          <Text style={styles.headerSubtitle}>Check back soon for new surveys.</Text>
        </View>
      ) : (
        <FlatList
          data={surveys}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, dark && styles.cardDark]}>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, dark && styles.textLight]}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {item.platform === 'sidra-mobile' || item.platform === 'both'
                    ? 'Available on mobile'
                    : 'Web survey'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => Alert.alert('Coming soon', `${item.name} surveys are being set up.`)}>
                <Text style={styles.startButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F5' },
  containerDark: { backgroundColor: '#18181B' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#18181B' },
  headerSubtitle: { fontSize: 14, color: '#71717A', marginTop: 4 },
  textLight: { color: '#FAFAFA' },
  balancePill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  balanceText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#18181B' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDark: { backgroundColor: '#27272A' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#18181B' },
  cardSub: { fontSize: 13, color: '#71717A', marginTop: 2 },
  startButton: { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  startButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
