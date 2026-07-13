/**
 * HealthPostScreen — full detail for a single Health News post.
 * Official items are shown as ATTRIBUTED relays; MedGuard never self-declares.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { Card, Icon } from '../components';
import { CATEGORY_META, relativeDate, type HealthPost } from '../hooks/useHealthFeed';
import { useTheme } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, Gradients } from '../../theme';
import type { RootStackParamList } from '../navigation/types';

const HealthPostScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'HealthPost'>>();
  const { colors, isDark } = useTheme();
  const post = route.params?.post as HealthPost | undefined;

  const gradientColors = isDark
    ? ([colors.gradientFrom, colors.gradientVia, colors.gradientTo] as unknown as [string, string, string])
    : (Gradients.background.colors as unknown as [string, string, string]);

  if (!post) {
    return (
      <LinearGradient colors={gradientColors} start={Gradients.background.start} end={Gradients.background.end} style={styles.container}>
        <View style={[styles.page, { paddingTop: insets.top + 60, paddingHorizontal: Spacing.lg }]}>
          <Text style={{ color: colors.textSecondary, fontFamily: FontFamily.regular }}>This post is no longer available.</Text>
        </View>
      </LinearGradient>
    );
  }

  const meta = CATEGORY_META[post.category];
  const isOfficial = post.category === 'official_update' || post.category === 'outbreak_news';
  const attribution = isOfficial
    ? `Official update from ${post.source}, relayed by MedGuard. MedGuard relays official reports — it does not confirm or declare outbreaks itself.`
    : post.category === 'prevention_tip'
      ? 'General prevention advice — not a diagnosis. See a qualified health worker if you feel unwell.'
      : `Shared by ${post.source}.`;

  return (
    <LinearGradient colors={gradientColors} start={Gradients.background.start} end={Gradients.background.end} style={styles.container}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.sm, paddingBottom: Math.max(insets.bottom, 12) + 40 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} hitSlop={10}>
              <Icon name="chevron-left" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Category + meta */}
          <View style={styles.metaRow}>
            <View style={[styles.iconChip, { backgroundColor: meta.color + '22' }]}>
              <Icon name={meta.icon} size={18} color={meta.color} />
            </View>
            <Text style={[styles.metaLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
            <Text style={[styles.metaMuted, { color: colors.textMuted }]}>· {post.source} · {relativeDate(post.publishedAt)}</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>

          {(post.disease || post.state) && (
            <View style={styles.tagRow}>
              {!!post.disease && <Tag text={post.disease} colors={colors} />}
              {!!post.state && <Tag text={post.state} colors={colors} />}
            </View>
          )}

          <Text style={[styles.body, { color: colors.text }]}>{post.body}</Text>

          {/* Source link */}
          {!!post.sourceUrl && (
            <Pressable onPress={() => Linking.openURL(post.sourceUrl!)} style={[styles.sourceBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Icon name="arrow-up-right" size={18} color={Colors.primary} />
              <Text style={[styles.sourceText, { color: Colors.primary }]}>Read the full update at {post.source}</Text>
            </Pressable>
          )}

          {/* Attribution / safety */}
          <Card style={{ ...styles.attrCard, backgroundColor: isDark ? colors.surfaceSunken : '#EDF6F5' }}>
            <Icon name={isOfficial ? 'shield-check' : 'info'} size={18} color={colors.primary} />
            <Text style={[styles.attrText, { color: colors.textSecondary }]}>{attribution}</Text>
          </Card>
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const Tag: React.FC<{ text: string; colors: any }> = ({ text, colors }) => (
  <View style={[styles.tag, { backgroundColor: colors.surfaceSunken || 'rgba(17,180,212,0.10)' }]}>
    <Text style={[styles.tagText, { color: colors.textSecondary }]}>{text.charAt(0).toUpperCase() + text.slice(1)}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { flex: 1, width: '100%', maxWidth: 448, alignSelf: 'center' },
  scroll: { paddingHorizontal: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, marginBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  iconChip: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metaLabel: { fontFamily: FontFamily.semibold, fontSize: 11, letterSpacing: 0.4 },
  metaMuted: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, flexShrink: 1 },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize['2xl'], lineHeight: FontSize['2xl'] * 1.25, letterSpacing: -0.3, marginBottom: Spacing.md },
  tagRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  tag: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  tagText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: FontSize.base * 1.6, marginBottom: Spacing.lg },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.lg },
  sourceText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, flex: 1 },
  attrCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  attrText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: FontSize.xs * 1.5, fontStyle: 'italic' },
});

export default HealthPostScreen;
