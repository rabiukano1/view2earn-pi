import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import SocialLinkButton from './SocialLinkButton';
import { colors, radius, shadow, spacing } from '../theme';

type Creator = {
  id: string;
  name: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
};

type CreatorLinksListProps = {
  creators: Creator[];
};

const LINK_FIELDS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
] as const;

export default function CreatorLinksList({ creators }: CreatorLinksListProps) {
  const renderCreator = ({ item }: { item: Creator }) => {
    const links = LINK_FIELDS.filter((field) => item[field.key]);
    return (
      <View style={styles.card}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {links.map((field) => (
          <SocialLinkButton
            key={field.key}
            url={item[field.key]!}
            label={field.label}
            type="profile"
          />
        ))}
      </View>
    );
  };

  return (
    <FlatList
      data={creators}
      keyExtractor={(item) => item.id}
      renderItem={renderCreator}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
});