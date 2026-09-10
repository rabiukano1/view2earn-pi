import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../convex/_generated/api';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow } from '../theme';

type StackNav = NativeStackNavigationProp<RootStackParamList, 'Surveys'>;

export default function SurveysScreen() {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNav>();
  const { userId } = useAuth();

  const surveys = useQuery(api.surveys.listAvailable, userId ? { userId } : 'skip');
  const balance = useQuery(api.points.balance, userId ? { userId } : 'skip');
  const getOfferwallUrl = useMutation(api.cpx.getOfferwallUrl);

  const [busy, setBusy] = useState(false);
  const [surveyUrl, setSurveyUrl] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);

  const openWall = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const url = await getOfferwallUrl({ userId });
      setSurveyUrl(url);
      setWebLoading(true);
    } catch (e) {
      Alert.alert(
        'Surveys unavailable',
        String((e as { message?: string })?.message ?? e).replace('[CONVEX] ', ''),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <StatusBar barStyle="light-content" />

      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroTitle}>Surveys</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.heroBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.heroBackText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroHi}>Earn with surveys 📝</Text>
        <Text style={styles.heroLabel}>Points Balance</Text>
        <Text style={styles.heroBalance}>{balance === undefined ? '—' : balance}</Text>
        <TouchableOpacity
          style={[styles.heroChip, busy && styles.heroChipBusy]}
          onPress={openWall}
          activeOpacity={0.85}>
          <Text style={styles.heroChipText}>{busy ? 'Opening…' : 'Open Survey Wall'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}>
        {/* Wall card */}
        <View style={[styles.wallCard, dark && styles.wallCardDark]}>
          <Text style={[styles.wallTitle, dark && styles.textLight]}>Partner surveys</Text>
          <Text style={[styles.wallSub, dark && styles.textMuted]}>
            Answer surveys from our partner wall and get points credited automatically when you finish.
          </Text>
          <TouchableOpacity style={styles.wallBtn} onPress={openWall} activeOpacity={0.85} disabled={busy}>
            <Text style={styles.wallBtnText}>{busy ? 'Opening…' : 'Open Survey Wall'}</Text>
          </TouchableOpacity>
        </View>

        {surveys === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : surveys.length === 0 ? (
          <Text style={[styles.empty, dark && styles.textMuted]}>More survey partners coming soon.</Text>
        ) : (
          <>
            <Text style={[styles.sectionTitle, dark && styles.textLight]}>Available</Text>
            {surveys.map((s) => (
              <View key={s.id} style={[styles.providerCard, dark && styles.providerCardDark]}>
                <View style={styles.providerNum}>
                  <Text style={styles.providerNumText}>📝</Text>
                </View>
                <View style={styles.providerInfo}>
                  <Text style={[styles.providerTitle, dark && styles.textLight]}>{s.name}</Text>
                  <Text style={[styles.providerMeta, dark && styles.textMuted]}>
                    {s.platform === 'sidra-mobile' || s.platform === 'both'
                      ? 'Available in-app'
                      : 'Web survey'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.providerStart} onPress={openWall} activeOpacity={0.85}>
                  <Text style={styles.providerStartText}>Start</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <View style={[styles.tip, dark && styles.tipDark]}>
          <Text style={styles.tipIcon}>💡</Text>
          <View style={styles.tipBody}>
            <Text style={[styles.tipTitle, dark && styles.textLight]}>How it works</Text>
            <Text style={[styles.tipText, dark && styles.textMuted]}>
              Open the wall in-app, pick a survey and finish it. Once the partner confirms completion, your
              points are added automatically — no need to send proof.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* In-App Survey Browser Modal */}
      <Modal
        visible={Boolean(surveyUrl)}
        animationType="slide"
        onRequestClose={() => setSurveyUrl(null)}>
        <View style={[styles.modalContainer, dark && styles.modalContainerDark, { paddingTop: insets.top }]}>
          {/* Header Bar */}
          <View style={[styles.modalHeader, dark && styles.modalHeaderDark]}>
            <TouchableOpacity
              onPress={() => setSurveyUrl(null)}
              style={styles.modalCloseBtn}
              activeOpacity={0.8}>
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>
            <View style={styles.modalHeaderTitleArea}>
              <Text style={[styles.modalHeaderTitle, dark && styles.textLight]}>Survey Wall 📝</Text>
              <Text style={styles.modalHeaderSub}>In-App Survey Browser</Text>
            </View>
            <TouchableOpacity
              onPress={() => setWebLoading(true)}
              style={styles.modalReloadBtn}
              activeOpacity={0.8}>
              <Text style={styles.modalReloadText}>↻ Reload</Text>
            </TouchableOpacity>
          </View>

          {/* In-App WebView Container */}
          <View style={{ flex: 1 }}>
            {surveyUrl ? (
              <WebView
                source={{ uri: surveyUrl }}
                onLoadStart={() => setWebLoading(true)}
                onLoadEnd={() => setWebLoading(false)}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={[styles.webViewLoader, dark && styles.webViewLoaderDark]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.webViewLoaderText, dark && styles.textLight]}>
                      Loading survey wall…
                    </Text>
                  </View>
                )}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  containerDark: { backgroundColor: colors.bgDark },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow.raised,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  heroTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  heroBack: {
    backgroundColor: '#FFFFFF22',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  heroBackText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  heroHi: { color: '#EDE9FE', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  heroLabel: { color: '#EDE9FE', fontSize: 12, fontWeight: '600', opacity: 0.9 },
  heroBalance: {
    color: colors.white,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 2,
  },
  heroChip: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  heroChipBusy: { opacity: 0.8 },
  heroChipText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 13 },

  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  wallCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    ...shadow.card,
  },
  wallCardDark: { backgroundColor: colors.surfaceDark },
  wallTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  wallSub: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 6, marginBottom: 16 },
  wallBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    ...shadow.raised,
  },
  wallBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  empty: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },

  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  providerCardDark: { backgroundColor: colors.surfaceDark },
  providerNum: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerNumText: { fontSize: 20 },
  providerInfo: { flex: 1 },
  providerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  providerMeta: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600', marginTop: 3 },
  providerStart: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  providerStartText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 12 },

  tip: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    padding: 16,
    marginTop: 4,
  },
  tipDark: { backgroundColor: colors.surfaceDark, borderColor: colors.borderDark },
  tipIcon: { fontSize: 20 },
  tipBody: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 2 },
  tipText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  textLight: { color: colors.textDark },
  textMuted: { color: colors.textMuted },

  /* In-App Browser Modal Styles */
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalContainerDark: { backgroundColor: '#0F172A' },
  modalHeader: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  modalHeaderDark: {
    backgroundColor: '#1E293B',
    borderBottomColor: '#334155',
  },
  modalCloseBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalCloseText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
  modalHeaderTitleArea: { alignItems: 'center' },
  modalHeaderTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  modalHeaderSub: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  modalReloadBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalReloadText: { color: colors.primaryDeep, fontWeight: '700', fontSize: 13 },
  webViewLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  webViewLoaderDark: { backgroundColor: '#0F172A' },
  webViewLoaderText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: colors.text },
});
