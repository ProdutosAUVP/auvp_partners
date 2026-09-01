/* Dados da rede: praças e corredores usados pelo globo e pela lista lateral. */

/* As seis frentes de atuação. `front` é o índice usado no shader do globo;
   Market Intelligence não percorre corredores, então não vira filtro. */
export const SERVICES = [
  { id: 'institutional', key: 'svc.institutional' },
  { id: 'connections', key: 'svc.connections' },
  { id: 'international', key: 'svc.international' },
  { id: 'familyoffice', key: 'svc.familyoffice' },
  { id: 'softlanding', key: 'svc.softlanding' },
  { id: 'intelligence', key: 'svc.intelligence' },
];

/* Nomes e funções das praças vivem nos dicionários (assets/js/i18n/) — aqui
   fica só a geografia, que não muda de idioma. */
export const HUBS = [
  { id: 'goiania', lon: -49.26, lat: -16.68 },
  { id: 'brasilia', lon: -47.88, lat: -15.79 },
  { id: 'saopaulo', lon: -46.63, lat: -23.55 },
  { id: 'rio', lon: -43.17, lat: -22.91 },
  { id: 'newyork', lon: -74.01, lat: 40.71 },
  { id: 'miami', lon: -80.19, lat: 25.76 },
  { id: 'london', lon: -0.13, lat: 51.51 },
  { id: 'zurich', lon: 8.54, lat: 47.37 },
  { id: 'lisbon', lon: -9.14, lat: 38.72 },
  { id: 'dubai', lon: 55.27, lat: 25.20 },
  { id: 'telaviv', lon: 34.78, lat: 32.08 },
  { id: 'beijing', lon: 116.41, lat: 39.90 },
  { id: 'shanghai', lon: 121.47, lat: 31.23 },
  { id: 'shenzhen', lon: 114.06, lat: 22.54 },
  { id: 'hongkong', lon: 114.17, lat: 22.32 },
  { id: 'singapore', lon: 103.82, lat: 1.35 },
  { id: 'tokyo', lon: 139.69, lat: 35.69 },
];

const idx = (id) => HUBS.findIndex((h) => h.id === id);

/* A descrição de cada corredor está nos dicionários, em route.<i>.what. */
export const ROUTES = [
  // Institutional Relations
  { from: idx('brasilia'), to: idx('dubai'), front: 0 },
  { from: idx('rio'), to: idx('telaviv'), front: 0 },
  { from: idx('brasilia'), to: idx('beijing'), front: 0 },

  // Business Connections
  { from: idx('goiania'), to: idx('shenzhen'), front: 1 },
  { from: idx('saopaulo'), to: idx('shanghai'), front: 1 },
  { from: idx('rio'), to: idx('hongkong'), front: 1 },
  { from: idx('saopaulo'), to: idx('tokyo'), front: 1 },

  // International
  { from: idx('saopaulo'), to: idx('miami'), front: 2 },
  { from: idx('saopaulo'), to: idx('singapore'), front: 2 },
  { from: idx('saopaulo'), to: idx('lisbon'), front: 2 },

  // Family Office
  { from: idx('goiania'), to: idx('newyork'), front: 3 },
  { from: idx('saopaulo'), to: idx('zurich'), front: 3 },
  { from: idx('rio'), to: idx('london'), front: 3 },

  // Soft Landing
  { from: idx('goiania'), to: idx('dubai'), front: 4 },
  { from: idx('rio'), to: idx('lisbon'), front: 4 },
  { from: idx('rio'), to: idx('shanghai'), front: 4 },
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
