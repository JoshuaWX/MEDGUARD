/**
 * Avatar Component
 * Recreates the avatar with loading blur effect
 */


import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Duration } from '../../theme';

interface AvatarProps {
  source?: string | null;
  size?: number;
  style?: ViewStyle;
  showRing?: boolean;
  ringColor?: string;
}

const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nNTYnIGhlaWdodD0nNTYnIHZpZXdCb3g9JzAgMCA1NiA1NicgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48Y2lyY2xlIGN4PScyOCcgY3k9JzI4JyByPScyOCcgZmlsbD0nI2U1ZTVlNScvPjxjaXJjbGUgY3g9JzI4JyBjeT0nMjAnIHI9JzEyJyBmaWxsPScjZmZmJyBmaWxsLW9wYWNpdHk9Jy4yJy8+PC9zdmc+';

const Avatar: React.FC<AvatarProps> = ({
  source,
  size = 40,
  style,
  showRing = false,
  ringColor = Colors.whiteAlpha50,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const blur = useSharedValue(12);
  const scale = useSharedValue(1.04);

  useEffect(() => {
    if (!isLoading) {
      blur.value = withTiming(0, { duration: Duration.normal });
      scale.value = withTiming(1, { duration: Duration.normal });
    }
  }, [isLoading]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerSize = showRing ? size + 8 : size;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
        },
        showRing && {
          backgroundColor: ringColor,
          padding: 4,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.imageContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri: source || DEFAULT_AVATAR }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  imageContainer: {
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  image: {
    resizeMode: 'cover',
  },
});

export default Avatar;
