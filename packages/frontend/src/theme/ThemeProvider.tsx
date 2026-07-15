import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeKey, ColorMode, FontScale } from '@rodinkal/shared';

interface ThemeContextValue {
  theme: ThemeKey;
  colorMode: ColorMode;
  effectiveColorMode: 'light' | 'dark';
  fontScale: FontScale;
  setTheme: (theme: ThemeKey) => void;
  setColorMode: (mode: ColorMode) => void;
  setFontScale: (scale: FontScale) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface Props {
  children: React.ReactNode;
  initialTheme?: ThemeKey;
  initialColorMode?: ColorMode;
  initialFontScale?: FontScale;
}

export function ThemeProvider({
  children,
  initialTheme = 'klasika',
  initialColorMode = 'SYSTEM',
  initialFontScale = 'NORMAL',
}: Props) {
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    return (localStorage.getItem('theme') as ThemeKey | null) ?? initialTheme;
  });
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    return (localStorage.getItem('colorMode') as ColorMode | null) ?? initialColorMode;
  });
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    return (localStorage.getItem('fontScale') as FontScale | null) ?? initialFontScale;
  });
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const effectiveColorMode: 'light' | 'dark' =
    colorMode === 'SYSTEM' ? (systemDark ? 'dark' : 'light') :
    colorMode === 'DARK' ? 'dark' : 'light';

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-color-mode', effectiveColorMode);

    // Update theme-color meta
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const style = getComputedStyle(document.documentElement);
      const primaryColor = style.getPropertyValue('--color-primary').trim();
      if (primaryColor) metaThemeColor.setAttribute('content', primaryColor);
    }
  }, [theme, effectiveColorMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale.toLowerCase());
  }, [fontScale]);

  const setTheme = (newTheme: ThemeKey) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setColorMode = (newMode: ColorMode) => {
    setColorModeState(newMode);
    localStorage.setItem('colorMode', newMode);
  };

  const setFontScale = (newScale: FontScale) => {
    setFontScaleState(newScale);
    localStorage.setItem('fontScale', newScale);
  };

  return (
    <ThemeContext.Provider value={{ theme, colorMode, effectiveColorMode, fontScale, setTheme, setColorMode, setFontScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
