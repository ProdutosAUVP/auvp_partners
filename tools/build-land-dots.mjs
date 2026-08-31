/**
 * Gera a máscara de pontos de terra usada pelo globo WebGL.
 *
 * Uso:
 *   npm pack world-atlas@2 && tar xzf world-atlas-2.0.2.tgz
 *   node tools/build-land-dots.mjs package/land-50m.json > assets/js/land-dots.js
 *
 * Distribui N pontos numa esfera (espiral de Fibonacci), mantém apenas os que
 * caem sobre terra firme e serializa lon/lat como Int16 (centésimos de grau)
 * em base64 — cerca de 25 kB para ~4.500 pontos.
 */
import { readFileSync } from 'node:fs';

const src = process.argv[2];
const COUNT = Number(process.argv[3] || 18000);
if (!src) {
  console.error('uso: node tools/build-land-dots.mjs <land-topojson.json> [pontos]');
  process.exit(1);
}

const topology = JSON.parse(readFileSync(src, 'utf8'));
const { scale: [sx, sy], translate: [tx, ty] } = topology.transform;

// TopoJSON: arcos delta-encoded e quantizados.
const arcs = topology.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

const ring = (indexes) => {
  const points = [];
  for (const index of indexes) {
    const reversed = index < 0;
    const arc = arcs[reversed ? ~index : index];
    const segment = reversed ? arc.slice().reverse() : arc;
    for (const point of segment) {
      const last = points[points.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
    }
  }
  return points;
};

// Achata a coleção de geometrias em uma lista de polígonos { outer, holes, bbox }.
const polygons = [];
const addPolygon = (rings) => {
  const [outer, ...holes] = rings.map(ring);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  polygons.push({ outer, holes, bbox: [minX, minY, maxX, maxY] });
};

const walk = (geometry) => {
  if (geometry.type === 'GeometryCollection') geometry.geometries.forEach(walk);
  else if (geometry.type === 'Polygon') addPolygon(geometry.arcs);
  else if (geometry.type === 'MultiPolygon') geometry.arcs.forEach(addPolygon);
};
walk(topology.objects.land);

const inRing = (points, x, y) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const onLand = (lon, lat) => {
  for (const { outer, holes, bbox } of polygons) {
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    if (!inRing(outer, lon, lat)) continue;
    if (holes.some((hole) => inRing(hole, lon, lat))) continue;
    return true;
  }
  return false;
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const coords = [];
for (let i = 0; i < COUNT; i++) {
  const y = 1 - (i / (COUNT - 1)) * 2;
  const lat = Math.asin(y) * (180 / Math.PI);
  let lon = ((i * GOLDEN) % (2 * Math.PI)) * (180 / Math.PI);
  if (lon > 180) lon -= 360;
  if (lat > 83 || lat < -60) continue; // recorta calotas: ruído visual, pouca informação
  if (onLand(lon, lat)) coords.push(Math.round(lon * 100), Math.round(lat * 100));
}

const buffer = Buffer.from(Int16Array.from(coords).buffer);
process.stdout.write(
  `// Gerado por tools/build-land-dots.mjs — ${coords.length / 2} pontos de terra (Int16 lon/lat, centésimos de grau).\n` +
    `export const LAND_DOTS = '${buffer.toString('base64')}';\n`
);
