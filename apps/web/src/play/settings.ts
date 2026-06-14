import { useSyncExternalStore } from "react";

/**
 * Глобальные настройки сайта. Хранятся в localStorage и применяются сразу.
 * Сюда складываем все будущие пользовательские настройки (см. #43).
 */
export type Theme = "light" | "dark";

export interface Settings {
  /** Тема оформления: light = «Уютный вечер», dark = «Тёмный лаунж». */
  theme: Theme;
  /** Ровные карточки — отключает «ручной» наклон карт в Коднеймс. */
  flatCards: boolean;
  /** Включён ли звук (задел под #20). */
  soundEnabled: boolean;
  /** Громкость 0..1. */
  volume: number;
}

const STORAGE_KEY = "bg-settings";

const DEFAULTS: Settings = {
  theme: "light",
  flatCards: false,
  soundEnabled: true,
  volume: 0.8,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
    // миграция со старого ключа темы
    const legacyTheme = localStorage.getItem("theme");
    if (legacyTheme === "light" || legacyTheme === "dark") {
      return { ...DEFAULTS, theme: legacyTheme };
    }
  } catch {
    /* битый JSON — откатываемся к дефолтам */
  }
  return { ...DEFAULTS };
}

let state: Settings = load();
const listeners = new Set<() => void>();

function applyToDom(): void {
  const root = document.documentElement;
  root.dataset["theme"] = state.theme;
  root.dataset["flat"] = state.flatCards ? "on" : "off";
}

export function getSettings(): Settings {
  return state;
}

export function setSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
  applyToDom();
  listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

// применяем тему/флаги сразу при загрузке модуля
applyToDom();
