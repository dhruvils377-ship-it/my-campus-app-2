// Time-of-day and color-scheme logic — pure, no React.

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

function getColorScheme(theme, timeOfDay) {
  if (theme === 'light') {
    return {
      bgGrad1: '#e8f3f8', bgGrad2: '#d4e8f0',
      card: 'rgba(255,255,255,0.75)', cardSolid: 'rgba(255,255,255,0.92)',
      cardBorder: 'rgba(255,255,255,0.85)', accent: '#2980b9', accentDark: '#1f6a9e',
      accentLight: 'rgba(41,128,185,0.12)', peach: '#e67e22', peachLight: 'rgba(230,126,34,0.12)',
      text: '#1a1a1a', textMid: '#4a4a4a', textLight: '#656565',
      shadow: 'rgba(41,128,185,0.16)', shadowPeach: 'rgba(230,126,34,0.2)',
      // accentBtn: used only for solid-fill buttons/chips carrying white text.
      // `accent` itself (2980b9) is ~4.3:1 against white — just under WCAG AA's
      // 4.5:1 floor for normal text. accentBtn is darkened enough to clear it
      // (~5.8:1) without changing the lighter `accent` used for icons/borders.
      accentBtn: '#1f6a9e',
      routeCasing: '#34495e', name: 'Light'
    };
  }
  if (theme === 'dark') {
    return {
      bgGrad1: '#1a1a1a', bgGrad2: '#2a2a2a',
      card: 'rgba(40,40,40,0.75)', cardSolid: 'rgba(40,40,40,0.92)',
      cardBorder: 'rgba(60,60,60,0.85)', accent: '#5ba0c4', accentDark: '#4a8aaa',
      accentLight: 'rgba(91,160,196,0.18)', peach: '#7ab899', peachLight: 'rgba(122,184,153,0.18)',
      text: '#e8e8e8', textMid: '#b8b8b8', textLight: '#929292',
      shadow: 'rgba(0,0,0,0.3)', shadowPeach: 'rgba(0,0,0,0.25)',
      // `accent` (5ba0c4) is only ~2.9:1 against white; accentDark (4a8aaa) is
      // still just ~3.8:1. accentBtn goes darker still to clear 4.5:1 (~4.8:1).
      accentBtn: '#3d7a95',
      routeCasing: 'white', name: 'Dark'
    };
  }
  const schemes = {
    morning: {
      bgGrad1: '#d3fcbd', bgGrad2: '#e8f5dd',
      card: 'rgba(255,255,255,0.65)', cardSolid: 'rgba(255,255,255,0.88)',
      cardBorder: 'rgba(255,255,255,0.8)', accent: '#5ba0c4', accentDark: '#4a8aaa',
      accentLight: 'rgba(91,160,196,0.12)', peach: '#7ab899', peachLight: 'rgba(122,184,153,0.12)',
      text: '#2a3d2e', textMid: '#4a6456', textLight: '#5b7167',
      shadow: 'rgba(91,160,196,0.16)', shadowPeach: 'rgba(122,184,153,0.2)',
      accentBtn: '#3d7a95',
      routeCasing: '#2d5a3d', name: 'Morning'
    },
    afternoon: {
      bgGrad1: '#e8ddd4', bgGrad2: '#dcc8be',
      card: 'rgba(255,255,255,0.6)', cardSolid: 'rgba(255,255,255,0.85)',
      cardBorder: 'rgba(255,255,255,0.75)', accent: '#a67c52', accentDark: '#8a6644',
      accentLight: 'rgba(166,124,82,0.12)', peach: '#c89870', peachLight: 'rgba(200,152,112,0.12)',
      text: '#3d3228', textMid: '#625345', textLight: '#5f5348',
      shadow: 'rgba(166,124,82,0.16)', shadowPeach: 'rgba(200,152,112,0.2)',
      // accentDark (8a6644) already clears 4.5:1 here (~5.2:1) — reused directly.
      accentBtn: '#8a6644',
      routeCasing: '#5d4a3a', name: 'Afternoon'
    },
    evening: {
      bgGrad1: '#1a1a1a', bgGrad2: '#2a2a2a',
      card: 'rgba(40,40,40,0.75)', cardSolid: 'rgba(40,40,40,0.92)',
      cardBorder: 'rgba(60,60,60,0.85)', accent: '#5ba0c4', accentDark: '#4a8aaa',
      accentLight: 'rgba(91,160,196,0.18)', peach: '#7ab899', peachLight: 'rgba(122,184,153,0.18)',
      text: '#e8e8e8', textMid: '#b8b8b8', textLight: '#929292',
      shadow: 'rgba(0,0,0,0.3)', shadowPeach: 'rgba(0,0,0,0.25)',
      accentBtn: '#3d7a95',
      routeCasing: 'white', name: 'Evening'
    }
  };
  return schemes[timeOfDay] || schemes.morning;
}

// 'standard' uses real OpenStreetMap tiles for the "Map" mode, matching a
// normal full-world map rather than a campus-only view. satellite/hybrid use
// real photo tiles from Google.
const MAP_TILES = {
  standard: {
    light:     { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
    dark:      { url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png' },
    morning:   { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
    afternoon: { url: 'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png' },
    evening:   { url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png' }
  },
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: '0123'
  },
  hybrid: {
    satellite: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    labels:    'https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
    subdomains: '0123'
  }
};

// A fixed, maximum-contrast palette for the "High contrast" setting — pure
// black/white/yellow rather than a variant of each theme's own colors, since
// the whole point is to guarantee every text/background pairing clears a
// high contrast ratio regardless of which base theme (Auto/Light/Dark) was
// active. Same shape as getColorScheme()'s return value, so it can be
// swapped in as a drop-in replacement for C wherever that's used.
function getHighContrastScheme() {
  return {
    bgGrad1: '#000000', bgGrad2: '#000000',
    card: 'rgba(0,0,0,0.92)', cardSolid: 'rgba(0,0,0,0.98)',
    cardBorder: '#ffffff', accent: '#ffdd00', accentDark: '#ccb100',
    accentBtn: '#000000', // black background + yellow/white text/border clears contrast without relying on the accent color's own luminance
    accentLight: 'rgba(255,221,0,0.25)', peach: '#ffdd00', peachLight: 'rgba(255,221,0,0.2)',
    text: '#ffffff', textMid: '#ffffff', textLight: '#ffdd00',
    shadow: 'rgba(255,255,255,0.25)', shadowPeach: 'rgba(255,221,0,0.3)',
    routeCasing: '#ffffff', name: 'High Contrast',
  };
}

// Returns the normal theme scheme, or the fixed high-contrast override when
// the setting is on. Kept as a tiny pure wrapper (rather than inlining this
// check at every call site) so the override logic has one place to test and
// one place to change.
function applyHighContrast(scheme, highContrastEnabled) {
  return highContrastEnabled ? getHighContrastScheme() : scheme;
}

export { getTimeOfDay, getColorScheme, MAP_TILES, getHighContrastScheme, applyHighContrast };