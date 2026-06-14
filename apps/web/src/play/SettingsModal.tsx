import { useEffect } from "react";
import { IconClose } from "./icons";
import { setSettings, useSettings } from "./settings";

/** Модал «Настройки сайта»: тема, ровные карточки, звук. Всё сохраняется сразу. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="st-overlay" onClick={onClose}>
      <div
        className="st-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Настройки сайта"
        onClick={e => e.stopPropagation()}
      >
        <header className="st-modal__head">
          <h2 className="st-modal__title">Настройки</h2>
          <button className="st-close" onClick={onClose} aria-label="Закрыть">
            <IconClose />
          </button>
        </header>

        <div className="st-section">
          <label className="st-field" htmlFor="st-theme">
            <span className="st-field__label">Тема</span>
            <select
              id="st-theme"
              value={s.theme}
              onChange={e =>
                setSettings({ theme: e.target.value as "light" | "dark" })
              }
            >
              <option value="light">Уютный вечер</option>
              <option value="dark">Тёмный лаунж</option>
            </select>
          </label>

          <label className="st-toggle">
            <input
              type="checkbox"
              checked={s.flatCards}
              onChange={e => setSettings({ flatCards: e.target.checked })}
            />
            <span>
              <span className="st-field__label">Ровные карточки</span>
              <span className="st-hint">
                Отключает «ручной» наклон карт в Коднеймс
              </span>
            </span>
          </label>
        </div>

        <div className="st-section">
          <label className="st-toggle">
            <input
              type="checkbox"
              checked={s.soundEnabled}
              onChange={e => setSettings({ soundEnabled: e.target.checked })}
            />
            <span>
              <span className="st-field__label">Звук</span>
              <span className="st-hint">Щелчки, победа/поражение</span>
            </span>
          </label>

          <label className="st-field" htmlFor="st-volume">
            <span className="st-field__label">Громкость</span>
            <input
              id="st-volume"
              type="range"
              min={0}
              max={100}
              value={Math.round(s.volume * 100)}
              disabled={!s.soundEnabled}
              onChange={e =>
                setSettings({ volume: Number(e.target.value) / 100 })
              }
            />
          </label>
        </div>

        <p className="st-foot">
          Настройки сохраняются автоматически на этом устройстве.
        </p>
      </div>
    </div>
  );
}
