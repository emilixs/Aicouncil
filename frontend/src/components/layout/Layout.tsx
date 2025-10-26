import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { useThemeStore } from '@/stores/theme';

export default function Layout() {
  const { theme, setTheme } = useThemeStore((state) => ({
    theme: state.theme,
    setTheme: state.setTheme,
  }));

  useEffect(() => {
    // Apply the persisted theme on mount using the store's single source of truth
    setTheme(theme);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

