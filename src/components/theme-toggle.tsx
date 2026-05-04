'use client';
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const labels = {
    light: '☀️ 浅色',
    dark: '🌙 深色',
    system: '💻 跟随系统',
  };

  return (
    <Button variant="ghost" size="sm" onClick={cycleTheme} className="gap-1.5 text-sm">
      {labels[theme]}
    </Button>
  );
}
