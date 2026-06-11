import { useEffect, useState } from 'react';
import type { BotRisk } from './shared';
import { CoopScreen } from './codenames/CoopScreen';
import { HomeScreen } from './online/HomeScreen';
import { LobbyScreen } from './online/LobbyScreen';
import { OnlineGameScreen } from './online/OnlineGameScreen';
import { useRoom } from './online/useRoom';
import { GameScreen } from './codenames/GameScreen';
import { useCodenamesGame } from './codenames/useCodenamesGame';
import type { CaptainMode } from './codenames/useCodenamesGame';
import './theme.css';

type Theme = 'light' | 'dark';
type Mode = 'classic' | 'coop' | 'online';

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
  const [mode, setMode] = useState<Mode>('classic');
  const [captainMode, setCaptainMode] = useState<CaptainMode>('bot');
  const [risk, setRisk] = useState<BotRisk>('normal');
  const game = useCodenamesGame({ captainMode, risk });
  const roomApi = useRoom();

  // если мы в комнате — переключаемся на онлайн-режим автоматически (rejoin после F5)
  const effectiveMode: Mode = roomApi.room ? 'online' : mode;

  return (
    <>
      <header className="cn-topbar">
        <h1 className="cn-title">Коднеймс</h1>
        <div className="cn-settings">
          <select
            value={effectiveMode}
            onChange={(e) => setMode(e.target.value as Mode)}
            disabled={roomApi.room !== null}
            aria-label="Режим"
          >
            <option value="classic">Классика (с ботом)</option>
            <option value="coop">Кооп: соло/дуо</option>
            <option value="online">Онлайн: комната</option>
          </select>
          {effectiveMode === 'classic' && (
            <select
              value={captainMode}
              onChange={(e) => setCaptainMode(e.target.value as CaptainMode)}
              aria-label="Кто капитан"
            >
              <option value="bot">Капитан: бот 🤖</option>
              <option value="human">Капитан: я</option>
            </select>
          )}
          {effectiveMode !== 'online' && (mode === 'coop' || captainMode === 'bot') && (
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
          {effectiveMode === 'classic' && (
            <button className="cn-btn cn-btn--ghost" onClick={game.restart}>
              Новая партия
            </button>
          )}
          <button
            className="cn-btn cn-btn--ghost"
            onClick={toggleTheme}
            aria-label="Переключить тему"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>
      {effectiveMode === 'classic' && <GameScreen game={game} />}
      {effectiveMode === 'coop' && <CoopScreen key={risk} risk={risk} />}
      {effectiveMode === 'online' &&
        (roomApi.room === null ? (
          <HomeScreen api={roomApi} />
        ) : roomApi.room.phase === 'lobby' ? (
          <LobbyScreen api={roomApi} />
        ) : (
          <OnlineGameScreen api={roomApi} />
        ))}
    </>
  );
}
