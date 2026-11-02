/**
 * Raga design tokens. New and redesigned screens should read from here instead
 * of hard-coding colours and sizes, so the whole app can be re-themed in one place.
 */
export const colors = {
  bg: '#0A0A0F',
  surface: '#14141B',
  surfaceRaised: '#1C1C26',
  surfaceHigh: '#262633',
  border: 'rgba(255,255,255,0.07)',
  text: '#FFFFFF',
  textMuted: '#A7A7B3',
  textFaint: '#6B6B78',
  accent: '#1DB954',
  accentSoft: 'rgba(29,185,84,0.14)',
  accentGradient: ['#1DB954', '#13875B'] as const,
  danger: '#FF5252',
  overlay: 'rgba(0,0,0,0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const type = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
};
