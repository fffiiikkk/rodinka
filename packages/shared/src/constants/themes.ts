import type { ThemeKey } from '../types/index.js';

export interface ThemeMeta {
  key: ThemeKey;
  nameCs: string;
  nameEn: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  emoji: string;
}

export const THEMES: ThemeMeta[] = [
  {
    key: 'klasika',
    nameCs: 'Klasika',
    nameEn: 'Classic',
    description: 'Neutrální rodinný vzhled',
    primaryColor: '#6366f1',
    accentColor: '#f59e0b',
    emoji: '🏠',
  },
  {
    key: 'ocean',
    nameCs: 'Oceán',
    nameEn: 'Ocean',
    description: 'Modré tóny pro plavce',
    primaryColor: '#0ea5e9',
    accentColor: '#06b6d4',
    emoji: '🏊',
  },
  {
    key: 'led',
    nameCs: 'Led',
    nameEn: 'Ice',
    description: 'Chladná paleta pro hokejisty',
    primaryColor: '#64748b',
    accentColor: '#38bdf8',
    emoji: '🏒',
  },
  {
    key: 'leto',
    nameCs: 'Léto',
    nameEn: 'Summer',
    description: 'Teplé letní barvy',
    primaryColor: '#f97316',
    accentColor: '#eab308',
    emoji: '☀️',
  },
  {
    key: 'les',
    nameCs: 'Les',
    nameEn: 'Forest',
    description: 'Přírodní zelené tóny',
    primaryColor: '#22c55e',
    accentColor: '#84cc16',
    emoji: '🌲',
  },
];

export const DEFAULT_THEME: ThemeKey = 'klasika';
