/**
 * HealthNewsScreen
 * Auto-ingested Health News + prevention tips feed (public.health_posts).
 * Official items are attributed relays (NCDC/WHO); MedGuard never self-declares.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Card, Icon, ErrorBanner, ScreenLoader } from '../components';
import { useHealthFeed, CATEGORY_META, relativeDate, type HealthPost, type PostCategory } from '../hooks/useHealthFeed';
import { useTheme } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, Gradients } from '../../theme';

const FILTERS: Array<{ key: 'all' | PostCategory; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'outbreak_news', label: 'Outbreaks' },
  { key: 'official_update', label: 'Official' },
  { key: 'prevention_tip', label: 'Tips' },
];

const HealthNewsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { posts, loading, error, refresh } = useHealthFeed();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | PostCategory>('all');

  const visible = useMemo(
    () => (filter === 'all' ? posts : posts.filter((p) => p.category === filter)),
    [posts, filter],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const openPost = useCallback((post: HealthPost) => navigation.navigate('HealthPost', { post }), [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: HealthPost }) => <PostRow post={item} onOpen={openPost} colors={colors} />,
    [openPost, colors],
  );

  const gradientColors = isDark
    ? ([colors.gradientFrom, colors.gradientVia, colors.gradientTo] as unknown as [string, string, string])
    : (Gradients.background.colors as unknown as [string, string, string]);

  const header = (
    <View>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} hitSlop={10}>
          <Icon name="chevron-left" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Health News</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>Official updates from NCDC/WHO, and daily prevention tips.</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable key={f.key} onPress={() => setFilter(f.key)}
              style={[styles.filterChip, { backgroundColor: active ? Colors.primary : colors.surface, borderColor: active ? Colors.primary : colors.border }]}>
              <Text style={[styles.filterText, { color: active ? '#fff' : colors.textSecondary }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const empty =
    loading && !refreshing ? (
      <View style={{ paddingTop: 80 }}><ScreenLoader label="Loading health news…" /></View>
    ) : error ? (
      <ErrorBanner title="News unavailable" message="MedGuard could not load health news. Pull down to try again." onRetry={onRefresh} />
    ) : (
      <Card style={styles.empty}>
        <Icon name="info" size={22} color={colors.primary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts here yet. Updates appear automatically as they're published.</Text>
      </Card>
    );

  return (
    <LinearGradient colors={gradientColors} start={Gradients.background.start} end={Gradients.background.end} style={styles.container}>
      <View style={styles.page}>
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.sm, paddingBottom: Math.max(insets.bottom, 12) + 40, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        />
      </View>
    </LinearGradient>
  );
};

const PostRow = React.memo(function PostRow({ post, onOpen, colors }: { post: HealthPost; onOpen: (p: HealthPost) => void; colors: any }) {
  const meta = CATEGORY_META[post.category];
  return (
    <Pressable onPress={() => onOpen(post)}>
      <Card style={styles.card}>
        <View style={[styles.iconChip, { backgroundColor: meta.color + '22' }]}>
          <Icon name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
            <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.metaMuted, { color: colors.textMuted }]}>{post.source}</Text>
            <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.metaMuted, { color: colors.textMuted }]}>{relativeDate(post.publishedAt)}</Text>
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>{post.title}</Text>
          {!!post.summary && <Text style={[styles.cardSummary, { color: colors.textSecondary }]} numberOfLines={2}>{post.summary}</Text>}
        </View>
        <Icon name="chevron-right" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { flex: 1, width: '100%', maxWidth: 448, alignSelf: 'center' },
  scroll: { paddingHorizontal: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, marginBottom: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize['3xl'], letterSpacing: -0.4 },
  sub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, marginTop: 2, marginBottom: Spacing.md },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.pill, borderWidth: StyleSheet.hairlineWidth },
  filterText: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  iconChip: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' },
  metaLabel: { fontFamily: FontFamily.semibold, fontSize: 10.5, letterSpacing: 0.4 },
  metaDot: { fontSize: 12 },
  metaMuted: { fontFamily: FontFamily.regular, fontSize: FontSize.xs },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, lineHeight: FontSize.base * 1.3 },
  cardSummary: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, marginTop: 2, lineHeight: FontSize.sm * 1.4 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emptyText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.4 },
});

export default HealthNewsScreen;
