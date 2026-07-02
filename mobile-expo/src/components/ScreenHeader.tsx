/**
 * ScreenHeader — standard large-title header ("Calm Clinical").
 *
 * Replaces the ad-hoc gradient / stock-photo hero headers. A quiet overline,
 * a big display-font title, an optional subtitle, an optional back affordance,
 * and an optional trailing slot (avatar, icon button, chip). Sits under the
 * safe-area inset automatically.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, FontSize, LetterSpacing, LineHeight, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import Icon from './Icon';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Small uppercase kicker above the title. */
  overline?: string;
  onBack?: () => void;
  /** Right-aligned element (avatar, icon button, chip). */
  trailing?: React.ReactNode;
  /** Compact reduces the title size for dense/secondary screens. */
  size?: 'large' | 'compact';
  style?: ViewStyle;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  overline,
  onBack,
  trailing,
  size = 'large',
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }, style]}>
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={22} color={colors.text} />
        </Pressable>
      )}

      <View style={styles.row}>
        <View style={styles.titleWrap}>
          {!!overline && (
            <Text style={[styles.overline, { color: colors.primary }]}>{overline.toUpperCase()}</Text>
          )}
          <Text
            style={[
              styles.title,
              { color: colors.text, fontSize: size === 'large' ? FontSize['3xl'] : FontSize['2xl'] },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.base,
  },
  titleWrap: { flex: 1, gap: 4 },
  overline: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.overline,
    letterSpacing: LetterSpacing.overline,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    letterSpacing: LetterSpacing.tight,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
    marginTop: 2,
  },
  trailing: { justifyContent: 'center' },
});

export default ScreenHeader;
