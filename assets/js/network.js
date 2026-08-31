/* Dados da rede: praças e corredores usados pelo globo e pela lista lateral. */

export const FRONTS = [
  { id: 'todos', label: 'Todos os corredores' },
  { id: 'intermediacao', label: 'Intermediação' },
  { id: 'crossborder', label: 'Cross-border' },
  { id: 'wealth', label: 'Wealth' },
];

export const HUBS = [
  { name: 'Goiânia', role: 'Sede', lon: -49.26, lat: -16.68 },
  { name: 'São Paulo', role: 'Praça financeira', lon: -46.63, lat: -23.55 },
  { name: 'Rio de Janeiro', role: 'Relações institucionais', lon: -43.17, lat: -22.91 },
  { name: 'Nova York', role: 'Capital e M&A', lon: -74.01, lat: 40.71 },
  { name: 'Miami', role: 'Hub das Américas', lon: -80.19, lat: 25.76 },
  { name: 'Londres', role: 'Fusões e aquisições', lon: -0.13, lat: 51.51 },
  { name: 'Zurique', role: 'Gestão de liquidez', lon: 8.54, lat: 47.37 },
  { name: 'Lisboa', role: 'Porta de entrada europeia', lon: -9.14, lat: 38.72 },
  { name: 'Dubai', role: 'Capital do Golfo', lon: 55.27, lat: 25.20 },
  { name: 'Tel Aviv', role: 'Tecnologia e entidades', lon: 34.78, lat: 32.08 },
  { name: 'Xangai', role: 'Indústria e trading', lon: 121.47, lat: 31.23 },
  { name: 'Shenzhen', role: 'Fornecedores e OEM', lon: 114.06, lat: 22.54 },
  { name: 'Hong Kong', role: 'Comércio exterior', lon: 114.17, lat: 22.32 },
  { name: 'Singapura', role: 'Base asiática', lon: 103.82, lat: 1.35 },
  { name: 'Tóquio', role: 'Tecnologia industrial', lon: 139.69, lat: 35.69 },
];

/* front: 0 intermediação · 1 cross-border · 2 wealth (índices usados no shader) */
export const ROUTES = [
  { from: 0, to: 11, front: 0, what: 'Busca de fornecedores e OEM' },
  { from: 1, to: 10, front: 0, what: 'Indústria, insumos e trading' },
  { from: 2, to: 12, front: 0, what: 'Comércio exterior e logística' },
  { from: 1, to: 14, front: 0, what: 'Tecnologia industrial' },

  { from: 0, to: 7, front: 1, what: 'Soft landing europeu' },
  { from: 0, to: 8, front: 1, what: 'Capital do Golfo no Brasil' },
  { from: 2, to: 9, front: 1, what: 'Tecnologia e entidades de classe' },
  { from: 1, to: 13, front: 1, what: 'Base asiática para operar' },
  { from: 1, to: 4, front: 1, what: 'Estruturas nas Américas' },

  { from: 0, to: 3, front: 2, what: 'Pools de investimento' },
  { from: 1, to: 6, front: 2, what: 'Gestão de liquidez' },
  { from: 2, to: 5, front: 2, what: 'Fusões e aquisições' },
];

/** Distância ortodrômica em km, arredondada à centena. */
export function distanceKm(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(h))) / 100) * 100;
}
