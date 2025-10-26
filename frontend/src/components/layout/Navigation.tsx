import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/stores/theme';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Navigation() {
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();

  const links = [
    { path: '/', label: 'Home' },
    { path: '/experts', label: 'Experts' },
    { path: '/sessions', label: 'Sessions' },
  ];

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            AI Council
          </Link>
          
          <div className="hidden md:flex gap-6">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  location.pathname === link.path
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
}

