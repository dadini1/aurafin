import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'nitido' | 'neon' | 'dark';
export type AccentColor = 'cyan' | 'emerald' | 'purple' | 'amber';

export interface ThemeContextType {
  theme: AppTheme;
  accent: AccentColor;
  isNitido: boolean;
  isVibrant: boolean;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  setAccent: (accent: AccentColor) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('aurafin_theme_v2');
      if (saved === 'nitido' || saved === 'neon' || saved === 'dark') {
        return saved as AppTheme;
      }
      // Check legacy setting or default to 'nitido' (crisp, vivid, attractive, luminous)
      return 'nitido';
    } catch {
      return 'nitido';
    }
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    try {
      const saved = localStorage.getItem('aurafin_accent_color');
      if (saved === 'cyan' || saved === 'emerald' || saved === 'purple' || saved === 'amber') {
        return saved as AccentColor;
      }
      return 'cyan';
    } catch {
      return 'cyan';
    }
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('aurafin_theme_v2', newTheme);
      // keep legacy key updated for compatibility
      localStorage.setItem('aurafin_theme', newTheme === 'nitido' || newTheme === 'neon' ? 'vibrant' : 'default');
    } catch {
      // ignore
    }
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    try {
      localStorage.setItem('aurafin_accent_color', newAccent);
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    // Cycles: nitido (luminous & crisp) -> neon (vibrant cosmic) -> dark (classic)
    if (theme === 'nitido') {
      setTheme('neon');
    } else if (theme === 'neon') {
      setTheme('dark');
    } else {
      setTheme('nitido');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-nitido', 'theme-neon', 'theme-dark', 'vibrant-theme');
    root.classList.remove('accent-cyan', 'accent-emerald', 'accent-purple', 'accent-amber');

    if (theme === 'nitido') {
      root.classList.add('theme-nitido');
      root.classList.add('vibrant-theme'); // maintains vibrant effects
    } else if (theme === 'neon') {
      root.classList.add('theme-neon');
      root.classList.add('vibrant-theme');
    } else {
      root.classList.add('theme-dark');
    }

    root.classList.add(`accent-${accent}`);
  }, [theme, accent]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accent,
        isNitido: theme === 'nitido',
        isVibrant: theme === 'neon' || theme === 'nitido',
        isDark: theme === 'dark',
        setTheme,
        setAccent,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
