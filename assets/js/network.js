/* Dados da rede: praças e corredores usados pelo globo e pela lista lateral. */

export const FRONTS = [
  { id: 'all', key: 'fronts.all' },
  { id: 'intermediation', key: 'fronts.intermediation' },
  { id: 'crossborder', key: 'fronts.crossborder' },
  { id: 'wealth', key: 'fronts.wealth' },
];

/* Nomes e funções das praças vivem nos dicionários (assets/js/i18n/) — aqui
   fica só a geografia, que não muda de idioma. */
export const HUBS = [
  { id: 'goiania', lon: -49.26, lat: -16.68 },
  { id: 'saopaulo', lon: -46.63, lat: -23.55 },
  { id: 'rio', lon: -43.17, lat: -22.91 },
  { id: 'newyork', lon: -74.01, lat: 40.71 },
  { id: 'miami', lon: -80.19, lat: 25.76 },
  { id: 'london', lon: -0.13, lat: 51.51 },
  { id: 'zurich', lon: 8.54, lat: 47.37 },
  { id: 'lisbon', lon: -9.14, lat: 38.72 },
  { id: 'dubai', lon: 55.27, lat: 25.20 },
  { id: 'telaviv', lon: 34.78, lat: 32.08 },
  { id: 'shanghai', lon: 121.47, lat: 31.23 },
  { id: 'shenzhen', lon: 114.06, lat: 22.54 },
  { id: 'hongkong', lon: 114.17, lat: 22.32 },
  { id: 'singapore', lon: 103.82, lat: 1.35 },
  { id: 'tokyo', lon: 139.69, lat: 35.69 },
];

/* front: 0 intermediação · 1 cross-border · 2 wealth (índices usados no shader).
   A descrição de cada corredor está nos dicionários, em route.<i>.what. */
export const ROUTES = [
  { from: 0, to: 11, front: 0 },
  { from: 1, to: 10, front: 0 },
  { from: 2, to: 12, front: 0 },
  { from: 1, to: 14, front: 0 },

  { from: 0, to: 7, front: 1 },
  { from: 0, to: 8, front: 1 },
  { from: 2, to: 9, front: 1 },
  { from: 1, to: 13, front: 1 },
  { from: 1, to: 4, front: 1 },

  { from: 0, to: 3, front: 2 },
  { from: 1, to: 6, front: 2 },
  { from: 2, to: 5, front: 2 },
];

/** Centro aproximado do Brasil, para o enquadramento da seção da rede. */
export const BRASIL = { lon: -51.5, lat: -12.5 };

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
