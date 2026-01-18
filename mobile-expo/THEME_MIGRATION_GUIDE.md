# Light/Dark Mode Theme Implementation Guide

## Overview
MedGuard mobile app now supports light and dark mode themes with automatic persistence and system preference detection.

## Quick Start

### Using Theme in Screens

```typescript
import { useTheme } from '../hooks/useTheme';
import { useThemedColors } from '../../theme';

const MyScreen: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const colors = useThemedColors(isDark);
  
  return (
    <View style={{ backgroundColor: colors.background }}>
      <Text style={{ color: colors.text }}>Hello</Text>
    </View>
  );
};
```

## Theme Colors Available

### Light/Dark Adaptive Colors
- `colors.background` - Main background color
- `colors.surface` - Card/surface background
- `colors.text` - Primary text color
- `colors.textSecondary` - Secondary text color
- `colors.textMuted` - Muted/placeholder text
- `colors.textInverse` - Inverse text (opposite of main text)
- `colors.border` - Border color
- `colors.glass` - Glass card overlay
- `colors.glassOverlay` - Glass overlay effect
- `colors.shadow` - Shadow color
- `colors.overlay` - Modal/overlay background

### Theme-Independent Colors
- `Colors.primary` - Primary brand color (cyan)
- `Colors.emerald` - Secondary brand color
- `Colors.success`, `Colors.danger`, `Colors.warning`, `Colors.info` - Status colors
- `Colors.transparent`, `Colors.whiteAlpha*`, `Colors.blackAlpha*` - Alpha variants

## Components Already Theme-Aware

✅ **GlassCard** - Automatically adapts blur tint and overlay
✅ **Input** - Adapts background, text, and placeholder colors
✅ **Button** - Adapts `outline`, `ghost`, and `google` variants

## Theme Toggle

Users can change theme in **Settings & Support** screen with the dark mode toggle.

## Settings Integration

The theme preference is automatically saved to AsyncStorage and persists across app restarts.

###Auto mode support
- `'light'` - Always light theme
- `'dark'` - Always dark theme  
- `'auto'` - Follow system preference (default)

## Implementation Status

### ✅ Completed
- Theme context and provider
- Dynamic color scheme (LightColors/DarkColors)
- ThemeProvider integration in App.tsx
- Settings screen theme toggle
- Core components (GlassCard, Input, Button)
- i18n translations (all 4 languages)
- MapScreen theming

### 🔄 Recommended Updates
Apply themed colors to remaining screens:
- HomeScreen
- AlertsScreen  
- MyHealthScreen
- ProfileScreen
- ChatbotScreen
- WelcomeScreen
- SignUpScreen
- SignUp2Screen
- SignInScreen

## Migration Pattern

For each screen, follow this pattern:

1. **Import theme hooks**:
```typescript
import { useTheme } from '../hooks/useTheme';
import { useThemedColors } from '../../theme';
```

2. **Get theme colors**:
```typescript
const { isDark } = useTheme();
const colors = useThemedColors(isDark);
```

3. **Replace hardcoded colors**:
```typescript
// Before:
<Text style={{ color: Colors.textPrimary }}>

// After:
<Text style={{ color: colors.text }}>
```

4. **Apply to backgrounds**:
```typescript
// Before:
<View style={{ backgroundColor: Colors.backgroundLight }}>

// After:
<View style={{ backgroundColor: colors.background }}>
```

## Best Practices

1. **Use semantic color names**: Prefer `colors.text` over `Colors.textPrimary`
2. **Keep brand colors static**: Don't theme `Colors.primary`, `Colors.emerald`, etc.
3. **Test both themes**: Always verify screens in both light and dark mode
4. **Use themed components**: GlassCard, Input, Button handle theming automatically

## Example: Full Screen Implementation

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedColors, Spacing, FontFamily } from '../../theme';
import { GlassCard } from '../components';

const ExampleScreen: React.FC = () => {
  const { isDark } = useTheme();
  const colors = useThemedColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassCard>
        <Text style={[styles.title, { color: colors.text }]}>
          Title
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Subtitle
        </Text>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.base,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
  },
});
```
