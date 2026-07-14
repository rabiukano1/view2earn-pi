import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

type RouteParams = {
  CreateListing: { userId: Id<'users'> };
};

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: '📘', color: '#1877F2', placeholder: 'https://facebook.com/yourpage' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵', color: '#010101', placeholder: 'https://tiktok.com/@yourhandle' },
  { value: 'telegram', label: 'Telegram', icon: '✈️', color: '#229ED9', placeholder: 'https://t.me/yourhandle' },
  { value: 'youtube', label: 'YouTube', icon: '▶️', color: '#FF0000', placeholder: 'https://youtube.com/@yourchannel' },
  { value: 'x', label: 'X (Twitter)', icon: '𝕏', color: '#000000', placeholder: 'https://x.com/yourhandle' },
  { value: 'instagram', label: 'Instagram', icon: '📸', color: '#E4405F', placeholder: 'https://instagram.com/yourhandle' },
];

export default function CreateListingScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'CreateListing'>>();
  const userId = route.params.userId;

  const createListing = useMutation(api.marketplace.createListing);

  const [platform, setPlatform] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [pointsReward, setPointsReward] = useState('');
  const [maxCompletions, setMaxCompletions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reward = parseInt(pointsReward, 10) || 0;
  const completions = parseInt(maxCompletions, 10) || 0;
  const totalCost = reward * completions;

  const selected = PLATFORMS.find((p) => p.value === platform);

  const canSubmit =
    platform && targetUrl.trim() && reward >= 10 && completions >= 1 && completions <= 100 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { balanceAfter } = await createListing({
        userId,
        platform,
        targetUrl: targetUrl.trim(),
        pointsReward: reward,
        maxCompletions: completions,
      });
      Alert.alert('Listed!', `Your profile is now in the marketplace. Balance: ${balanceAfter} pts`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', String(e).replace('[CONVEX] ', ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, dark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, dark && styles.textLight]}>Create listing</Text>
          <Text style={styles.sub}>List your social profile as a follow task</Text>
        </View>

        <View style={styles.card}>
          <Text style={[styles.label, dark && styles.textLight]}>Platform</Text>
          <TouchableOpacity
            style={[styles.dropdown, dark && styles.dropdownDark]}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}>
            {selected ? (
              <View style={styles.dropdownSelected}>
                <Text style={styles.dropdownIcon}>{selected.icon}</Text>
                <Text style={[styles.dropdownText, dark && styles.textLight]}>{selected.label}</Text>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Select a platform</Text>
            )}
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={[styles.label, dark && styles.textLight]}>Profile URL</Text>
          <TextInput
            style={[styles.input, dark && styles.inputDark]}
            placeholder={selected?.placeholder ?? 'https://facebook.com/yourpage'}
            placeholderTextColor="#A1A1AA"
            value={targetUrl}
            onChangeText={setTargetUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[styles.hint, dark && styles.textMuted]}>
            The URL of the profile you want others to follow
          </Text>

          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Text style={[styles.label, dark && styles.textLight]}>Reward per follow</Text>
              <TextInput
                style={[styles.input, dark && styles.inputDark]}
                placeholder="10"
                placeholderTextColor="#A1A1AA"
                value={pointsReward}
                onChangeText={setPointsReward}
                keyboardType="number-pad"
              />
              <Text style={[styles.hint, dark && styles.textMuted]}>Min 10 pts</Text>
            </View>
            <View style={styles.rowHalf}>
              <Text style={[styles.label, dark && styles.textLight]}>Max followers</Text>
              <TextInput
                style={[styles.input, dark && styles.inputDark]}
                placeholder="10"
                placeholderTextColor="#A1A1AA"
                value={maxCompletions}
                onChangeText={setMaxCompletions}
                keyboardType="number-pad"
              />
              <Text style={[styles.hint, dark && styles.textMuted]}>1–100</Text>
            </View>
          </View>

          {totalCost > 0 && (
            <View style={styles.costCard}>
              <Text style={styles.costLabel}>Total cost</Text>
              <Text style={styles.costAmount}>{totalCost.toLocaleString()} pts</Text>
              <Text style={styles.costBreakdown}>
                {reward} pts × {completions} followers
              </Text>
              <View style={styles.costBar}>
                <View style={[styles.costBarFill, { width: `${Math.min(100, (totalCost / 5000) * 100)}%` }]} />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>
              {submitting ? 'Creating…' : `Spend ${totalCost.toLocaleString()} pts — List profile`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerOpen(false)}>
          <View style={[styles.pickerCard, dark && styles.pickerCardDark]}>
            <Text style={[styles.pickerTitle, dark && styles.textLight]}>Select platform</Text>
            {PLATFORMS.map((p) => {
              const active = platform === p.value;
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.pickerOption,
                    active && { backgroundColor: p.color + '18', borderColor: p.color },
                    dark && styles.pickerOptionDark,
                  ]}
                  onPress={() => {
                    setPlatform(p.value);
                    setPickerOpen(false);
                  }}>
                  <Text style={styles.pickerIcon}>{p.icon}</Text>
                  <Text style={[styles.pickerLabel, dark && styles.textLight]}>{p.label}</Text>
                  {active && <Text style={styles.pickerCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setPickerOpen(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F5' },
  containerDark: { backgroundColor: '#18181B' },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#18181B' },
  sub: { fontSize: 14, color: '#71717A', marginTop: 4 },
  textLight: { color: '#FAFAFA' },
  textMuted: { color: '#A1A1AA' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#18181B', marginBottom: 6, marginTop: 16, letterSpacing: 0.2 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
  },
  dropdownDark: { backgroundColor: '#1F1F23', borderColor: '#3F3F46' },
  dropdownSelected: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  dropdownIcon: { fontSize: 18 },
  dropdownText: { fontSize: 15, fontWeight: '600', color: '#18181B' },
  dropdownPlaceholder: { flex: 1, fontSize: 15, color: '#A1A1AA' },
  dropdownArrow: { fontSize: 10, color: '#A1A1AA' },
  input: {
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#18181B',
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
  },
  inputDark: { backgroundColor: '#1F1F23', color: '#FAFAFA', borderColor: '#3F3F46' },
  hint: { fontSize: 12, color: '#71717A', marginTop: 5 },
  row: { flexDirection: 'row', gap: 12 },
  rowHalf: { flex: 1 },
  costCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 18,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  costLabel: { fontSize: 12, color: '#6D28D9', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  costAmount: { fontSize: 34, fontWeight: '800', color: '#7C3AED', marginTop: 4, letterSpacing: -0.5 },
  costBreakdown: { fontSize: 13, color: '#6D28D9', marginTop: 2 },
  costBar: { height: 4, backgroundColor: '#DDD6FE', borderRadius: 2, marginTop: 12, width: '100%' },
  costBarFill: { height: 4, backgroundColor: '#7C3AED', borderRadius: 2 },
  submitBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.5)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  pickerCardDark: { backgroundColor: '#18181B' },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: '#18181B', marginBottom: 16, textAlign: 'center' },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pickerOptionDark: { backgroundColor: '#27272A' },
  pickerIcon: { fontSize: 20, marginRight: 14 },
  pickerLabel: { fontSize: 16, fontWeight: '600', color: '#18181B', flex: 1 },
  pickerCheck: { fontSize: 16, fontWeight: '800', color: '#7C3AED' },
  pickerCancel: { marginTop: 8, padding: 14, alignItems: 'center' },
  pickerCancelText: { fontSize: 15, color: '#71717A', fontWeight: '600' },
});
