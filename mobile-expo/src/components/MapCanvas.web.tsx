import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing } from '../../theme';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export type MapCanvasHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

type MapCanvasProps = {
  style?: StyleProp<ViewStyle>;
  region?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  children?: React.ReactNode;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
};

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  onPress?: () => void;
};

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(({ style, region }, ref) => {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => {
      // Web preview only. Native Android/iOS keeps the real map implementation.
    },
  }));

  return (
    <View style={[styles.mapPreview, style]}>
      <View style={styles.grid} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="map-outline" size={26} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Map preview</Text>
        <Text style={styles.subtitle}>
          Native map rendering is available on Android and iOS. Web mode is for UI inspection.
        </Text>
        {region && (
          <Text style={styles.coords}>
            {region.latitude.toFixed(3)}, {region.longitude.toFixed(3)}
          </Text>
        )}
      </View>
    </View>
  );
});

MapCanvas.displayName = 'MapCanvas';

export const Marker: React.FC<MarkerProps> = () => null;

const styles = StyleSheet.create({
  mapPreview: {
    backgroundColor: '#e8f5f4',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 220,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
    backgroundColor: '#d7eeeb',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#0f3d3b',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#3d6460',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: FontSize.sm * 1.45,
  },
  coords: {
    marginTop: Spacing.sm,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
});

export default MapCanvas;
