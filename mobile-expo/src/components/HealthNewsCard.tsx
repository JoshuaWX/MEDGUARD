/**
 * HealthNewsCard — compact Home-screen entry into the Health News feed.
 * Self-contained: reads the feed, shows the latest headline, links to the feed
 * and to the post. Renders nothing while empty so it never clutters Home.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Card from './Card';
import Icon from './Icon';
import { useHealthFeed, CATEGORY_META, relativeDate } from '../hooks/useHealthFeed';
import { useTheme } from '../hooks/useTheme';
import type { RootStackParamList } from '../navigation/types';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '../../theme';

const HealthNewsCard: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { posts, loading } = useHealthFeed(8);

  // Lead with the newest official/outbreak item; fall back to the newest post.
  const lead = useMemo(
    () => posts.find((p) => p.category === 'outbreak_news' || p.category === 'official_update') ?? posts[0] ?? null,
    [posts],
  );

  if (loading || !lead) return null;
  const meta = CATEGORY_META[lead.category];

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>HEALTH NEWS</Text>
        <Pressable onPress={() => navigation.navigate('HealthNews')} hitSlop={8} style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
          <Icon name="arrow-right" size={14} color={colors.primary} />
        </Pressable>
      </View>
      <Pressable onPress={() => navigation.navigate('HealthPost', { post: lead })}>
        <Card style={styles.card}>
          <View style={[styles.iconChip, { backgroundColor: meta.color + '22' }]}>
            <Icon name={meta.icon} size={20} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
              <Text style={[styles.metaMuted, { color: colors.textMuted }]}>· {lead.source} · {relativeDate(lead.publishedAt)}</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{lead.title}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </Card>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs, letterSpacing: 0.6 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconChip: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 },
  metaLabel: { fontFamily: FontFamily.semibold, fontSize: 10.5, letterSpacing: 0.4 },
  metaMuted: { fontFamily: FontFamily.regular, fontSize: FontSize.xs },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, lineHeight: FontSize.base * 1.3 },
});

export default HealthNewsCard;
