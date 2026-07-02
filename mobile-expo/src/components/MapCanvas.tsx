import React, { forwardRef } from 'react';
import NativeMapView, {
  Marker,
  Polygon,
  Geojson,
  type MapViewProps,
  type Region,
} from 'react-native-maps';

export type { Region };

export type MapCanvasHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

const MapCanvas = forwardRef<MapCanvasHandle, MapViewProps>((props, ref) => (
  <NativeMapView ref={ref as React.Ref<NativeMapView>} {...props} />
));

MapCanvas.displayName = 'MapCanvas';

export { Marker, Polygon, Geojson };
export default MapCanvas;
