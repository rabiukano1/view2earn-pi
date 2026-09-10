import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useColorScheme } from 'react-native';
import { colors } from '../theme';
import Icon from '../components/Icon';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LevelScreen({ navigation }: any) {
  const dark = useColorScheme() === 'dark';
  
  const progress = useQuery(api.xp.myLevelProgress);
  const levels = useQuery(api.levels.getLevels);
  
  if (progress === undefined || levels === undefined) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: dark ? colors.bgDark : colors.bg }]} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: dark ? colors.bgDark : colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Progress</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Progress Card */}
        {progress && (
          <View style={[styles.card, { backgroundColor: dark ? '#1E293B' : '#FFFFFF' }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              🚀 {progress.currentLevel.name}
            </Text>
            <Text style={styles.cardSub}>Level {progress.currentLevel.level}</Text>
            <Text style={[styles.xpText, { color: colors.primary }]}>
              {progress.xp.toLocaleString()} XP
            </Text>
            
            {progress.nextLevel ? (
              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressLabel, { color: colors.text }]}>
                    Next: 💎 {progress.nextLevel.name}
                  </Text>
                  <Text style={[styles.progressTarget, { color: colors.text }]}>
                    {progress.nextLevel.xpRequired.toLocaleString()} XP
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${progress.progressPercentage}%` }]} />
                </View>
                <Text style={styles.xpRemaining}>
                  {progress.xpToNextLevel.toLocaleString()} XP to go
                </Text>
              </View>
            ) : (
              <Text style={styles.xpRemaining}>You have reached the maximum level!</Text>
            )}
          </View>
        )}

        {/* Levels List */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>All Levels</Text>
        <View style={styles.levelsList}>
          {levels.map((lvl) => {
            const isCompleted = progress && progress.currentLevel.level >= lvl.level;
            const isCurrent = progress && progress.currentLevel.level === lvl.level;
            return (
              <View key={lvl.level} style={[styles.levelRow, isCurrent && styles.currentLevelRow, { borderColor: dark ? '#334155' : '#E2E8F0' }]}>
                <View style={styles.levelRowLeft}>
                  {isCompleted ? (
                    <Icon name="circle-check" iconStyle="solid" size={20} color={colors.success} />
                  ) : (
                    <Icon name="lock" iconStyle="solid" size={18} color="#94A3B8" />
                  )}
                  <View style={styles.levelInfo}>
                    <Text style={[styles.levelName, { color: isCompleted ? colors.text : '#94A3B8' }]}>
                      Level {lvl.level} — {lvl.name}
                    </Text>
                    <Text style={styles.levelDesc}>{lvl.xpRequired.toLocaleString()} XP</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { width: 36 },
  scrollContent: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  cardSub: { fontSize: 16, color: '#64748B', marginBottom: 12 },
  xpText: { fontSize: 28, fontWeight: '900', marginBottom: 20 },
  progressSection: { marginTop: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressTarget: { fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 5 },
  xpRemaining: { fontSize: 13, color: '#64748B', textAlign: 'right' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, paddingHorizontal: 4 },
  levelsList: { gap: 12 },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  currentLevelRow: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  levelRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  levelInfo: { flex: 1 },
  levelName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  levelDesc: { fontSize: 13, color: '#64748B' },
});
