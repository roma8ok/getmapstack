import data from '../data/cities.json';

export type City = {
  slug: string;
  name: string;
  label: string;
  country: string;
  origin: { lat: number; lon: number };
};

export const CITIES: City[] = data as City[];

export function pickCity(rand: () => number = Math.random): City {
  return CITIES[Math.min(CITIES.length - 1, Math.floor(rand() * CITIES.length))];
}

// A cycle, not a second random draw: two consecutive draws can repeat, and a
// visitor who asks for another city and gets the same one reads it as a bug.
export function nextCity(current: City): City {
  const i = CITIES.findIndex((c) => c.slug === current.slug);
  return CITIES[(i + 1) % CITIES.length];
}
