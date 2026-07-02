/**
 * RiskChoropleth — colors the 36 states + FCT by disease risk tier.
 *
 * Renders one <Polygon> per state part from the bundled Nigeria boundary asset,
 * filled by the selected disease's color ramp. States with no active forecast
 * render grey. Tapping a state surfaces its projected level + summary.
 */

import React, { useMemo } from 'react';
import { Polygon } from './MapCanvas';
import { riskColor, riskFill, NO_DATA_FILL, type RiskDisease } from '../theme/riskColors';
import type { RiskRow } from '../hooks/useRiskMap';

// require (not import) keeps tsc from deep-inferring the large JSON literal.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const statesGeo = require('../../assets/data/nigeria-states.json') as StatesGeo;

type LngLat = [number, number];
interface StatesGeo {
  features: Array<{
    properties: { state: string };
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  }>;
}
interface LatLng {
  latitude: number;
  longitude: number;
}
interface Part {
  state: string;
  coordinates: LatLng[];
  holes: LatLng[][];
}

function toLatLng(ring: LngLat[]): LatLng[] {
  return ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

// Parse the static asset once into flat, renderable polygon parts.
const PARTS: Part[] = (() => {
  const parts: Part[] = [];
  for (const f of statesGeo.features) {
    const state = f.properties.state;
    const { type, coordinates } = f.geometry;
    const polys = type === 'Polygon' ? [coordinates as LngLat[][]] : (coordinates as LngLat[][][]);
    for (const poly of polys) {
      if (!poly || poly.length === 0) continue;
      parts.push({
        state,
        coordinates: toLatLng(poly[0]),
        holes: poly.slice(1).map(toLatLng),
      });
    }
  }
  return parts;
})();

interface Props {
  disease: RiskDisease;
  lookup: Map<string, RiskRow>;
  onSelect: (state: string, row: RiskRow | null) => void;
}

const RiskChoropleth: React.FC<Props> = ({ disease, lookup, onSelect }) => {
  // Recompute fills only when disease/data change.
  const rendered = useMemo(
    () =>
      PARTS.map((p, i) => {
        const row = lookup.get(p.state) ?? null;
        return (
          <Polygon
            key={`${p.state}-${i}`}
            coordinates={p.coordinates}
            holes={p.holes.length ? p.holes : undefined}
            fillColor={riskFill(disease, row?.level ?? null)}
            strokeColor={row ? riskColor(disease, row.level) : NO_DATA_FILL}
            strokeWidth={0.8}
            tappable
            onPress={() => onSelect(p.state, row)}
          />
        );
      }),
    [disease, lookup, onSelect]
  );

  return <>{rendered}</>;
};

export default RiskChoropleth;
