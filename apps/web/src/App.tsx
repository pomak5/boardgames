import { useEffect, useState } from 'react';
import type { BotRisk } from '@boardgames/shared';
import { GameScreen } from './codenames/GameScreen';
import { useCodenamesGame } from './codenames/useCodenamesGame';
import type { CaptainMode } from './codenames/useCodenamesGame';
import './theme.css';

type Theme = 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) ?? 'light',
  );
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))];
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [captainMode, setCaptainMode] = useState<CaptainMode>('bot');
  const [risk, setRisk] = useState<BotRisk>('normal');
  const game = useCodenamesGame({ captainMode, risk });

  return (
    <>
      <header className="cn-topbar">
        <h1 className="cn-title">Коднеймс</h1>
        <div className="cn-settings">
          <select
            value={captainMode}
            onChange={(e) => setCaptainMode(e.target.value as CaptainMode)}
            aria-label="Кто капитан"
          >
            <option value="bot">Капитан: бот 🤖</option>
            <option value="human">Капитан: я</option>
          </select>
          {captainMode === 'bot' && (
            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value as BotRisk)}
              aria-label="Смелость бота"
            >
              <option value="cautious">Бот: осторожный</option>
              <option value="normal">Бот: обычный</option>
              <option value="bold">Бот: смелый</option>
            </select>
          )}
          <button className="cn-btn cn-btn--ghost" onClick={game.restart}>
            Новая партия
          </button>
          <button
            className="cn-btn cn-btn--ghost"
            onClick={toggleTheme}
            aria-label="Переключить тему"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>
      <GameScreen game={game} />
    </>
  );
}
