const METADATA_URL = 'https://www.geoboundaries.org/api/current/gbOpen/NGA/ADM1/';
const OUTPUT_URL = new URL('../src/data/nigeria-adm1.json', import.meta.url);
// Preserve recognisable state boundaries while keeping the SSR atlas cheap to
// parse and paint on low-powered phones.
const TOLERANCE = 0.028;

function squaredDistance(a, b) {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  return x * x + y * y;
}

function segmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyStep(points, first, last, toleranceSquared, result) {
  let furthest = toleranceSquared;
  let index = -1;
  for (let cursor = first + 1; cursor < last; cursor += 1) {
    const distance = segmentDistance(points[cursor], points[first], points[last]);
    if (distance > furthest) {
      index = cursor;
      furthest = distance;
    }
  }
  if (index === -1) return;
  if (index - first > 1) simplifyStep(points, first, index, toleranceSquared, result);
  result.push(points[index]);
  if (last - index > 1) simplifyStep(points, index, last, toleranceSquared, result);
}

function simplifyRing(ring) {
  const clean = ring.filter((point, index) => index === 0 || squaredDistance(point, ring[index - 1]) > 0);
  if (clean.length < 4) return clean;
  const closed = squaredDistance(clean[0], clean[clean.length - 1]) === 0;
  const points = closed ? clean.slice(0, -1) : clean;
  const simplified = [points[0]];
  simplifyStep(points, 0, points.length - 1, TOLERANCE * TOLERANCE, simplified);
  simplified.push(points[points.length - 1]);
  if (closed) simplified.push(simplified[0]);
  return simplified.length >= 4 ? simplified : clean;
}

function polygonArea(ring) {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    sum += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return Math.abs(sum / 2);
}

function normalizeGeometry(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .map((polygon) => polygon.map(simplifyRing).filter((ring) => ring.length >= 4))
    .filter((polygon) => polygon.length > 0)
    .sort((a, b) => polygonArea(b[0]) - polygonArea(a[0]));
}

function ringCentroid(ring) {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const factor = ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
    twiceArea += factor;
    x += (ring[index][0] + ring[index + 1][0]) * factor;
    y += (ring[index][1] + ring[index + 1][1]) * factor;
  }
  if (!twiceArea) return ring[0];
  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

const metadataResponse = await fetch(METADATA_URL);
if (!metadataResponse.ok) throw new Error(`geoBoundaries metadata failed: ${metadataResponse.status}`);
const metadata = await metadataResponse.json();
const geoResponse = await fetch(metadata.simplifiedGeometryGeoJSON);
if (!geoResponse.ok) throw new Error(`geoBoundaries geometry failed: ${geoResponse.status}`);
const geojson = await geoResponse.json();

const states = geojson.features.map((feature) => {
  const polygons = normalizeGeometry(feature.geometry);
  const mainRing = polygons[0]?.[0] ?? [];
  return {
    id: feature.properties.shapeISO || feature.properties.shapeID,
    name: feature.properties.shapeName,
    centroid: ringCentroid(mainRing).map((value) => Number(value.toFixed(5))),
    polygons: polygons.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))]))),
  };
}).sort((a, b) => a.name.localeCompare(b.name));

const coordinates = states.flatMap((state) => state.polygons.flat(2));
const bounds = coordinates.reduce((value, [x, y]) => ({
  minX: Math.min(value.minX, x),
  minY: Math.min(value.minY, y),
  maxX: Math.max(value.maxX, x),
  maxY: Math.max(value.maxY, y),
}), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

const atlas = {
  attribution: {
    name: 'geoBoundaries gbOpen NGA ADM1',
    source: 'GRID3 via geoBoundaries',
    license: metadata.boundaryLicense,
    year: metadata.boundaryYearRepresented,
    url: 'https://www.geoboundaries.org/',
  },
  bounds,
  states,
};

await import('node:fs/promises').then(({ mkdir, writeFile }) => Promise.all([
  mkdir(new URL('../src/data/', import.meta.url), { recursive: true }),
  writeFile(OUTPUT_URL, `${JSON.stringify(atlas)}\n`, 'utf8'),
]));

console.log(`Generated ${states.length} Nigerian ADM1 features at ${OUTPUT_URL.pathname}`);
