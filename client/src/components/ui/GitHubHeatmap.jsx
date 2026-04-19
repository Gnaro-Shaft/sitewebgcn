import { GitHubCalendar } from 'react-github-calendar';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

// Matches the #00ff88 accent theme
const LIGHT_THEME = {
  light: ['#ebedf0', '#c6f6d5', '#68d391', '#38a169', '#00ff88'],
};

const DARK_THEME = {
  dark: ['#161b22', '#0d3f26', '#007a3d', '#00b85c', '#00ff88'],
};

export default function GitHubHeatmap({ username = 'gnaro-shaft' }) {
  const { theme } = useTheme();
  const { i18n } = useTranslation();

  // Determine resolved theme (auto → check system)
  const isDark = theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const calendarTheme = isDark ? DARK_THEME : LIGHT_THEME;

  const labels = i18n.language?.startsWith('fr')
    ? {
        totalCount: '{{count}} contributions en {{year}}',
        legend: { less: 'Moins', more: 'Plus' },
      }
    : undefined;

  return (
    <div className="flex justify-center overflow-x-auto">
      <GitHubCalendar
        username={username}
        theme={calendarTheme}
        colorScheme={isDark ? 'dark' : 'light'}
        blockSize={11}
        blockMargin={3}
        fontSize={12}
        labels={labels}
        errorMessage="Unable to load GitHub contributions"
      />
    </div>
  );
}
