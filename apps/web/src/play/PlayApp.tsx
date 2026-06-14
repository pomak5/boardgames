import { useState } from "react";
import { Link } from "react-router-dom";
import { IconGear, IconHome } from "./icons";
import { useAuth } from "./net/useAuth";
import { HomeScreen } from "./online/HomeScreen";
import { OnlineGameScreen } from "./online/OnlineGameScreen";
import { useRoom } from "./online/useRoom";
import { SettingsModal } from "./SettingsModal";
import "./theme.css";

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const auth = useAuth();
  const roomApi = useRoom();

  // Комната дилится сразу при входе, поэтому отдельного лобби нет:
  // либо экран входа (нет комнаты), либо живой стол.
  const inRoom = roomApi.room !== null;

  return (
    <>
      {!inRoom && (
        <header className="cn-topbar">
          <h1 className="cn-title">
            <Link
              to="/"
              className="cn-home-link"
              title="На главную"
              aria-label="На главную"
            >
              <IconHome />
            </Link>{" "}
            Коднеймс
          </h1>
          <div className="cn-settings">
            <button
              className="cn-btn cn-btn--ghost"
              onClick={() => setSettingsOpen(true)}
              aria-label="Настройки"
              title="Настройки"
            >
              <IconGear />
            </button>
          </div>
        </header>
      )}
      {inRoom ? (
        <OnlineGameScreen
          api={roomApi}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <HomeScreen api={roomApi} auth={auth} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
