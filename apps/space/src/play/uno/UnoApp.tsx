import { useState } from "react";
import { Link } from "react-router-dom";
import { IconGear, IconHome } from "../icons";
import { SettingsModal } from "../SettingsModal";
import "../codenames/codenames.css";
import "../online/online.css";
import "../theme.css";
import { UnoHome } from "./UnoHome";
import { UnoLobby } from "./UnoLobby";
import { UnoTable } from "./UnoTable";
import { useUnoRoom } from "./useUnoRoom";
import "./uno.css";

export function UnoApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const api = useUnoRoom();

  return (
    <>
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
          УНО
        </h1>
        <div className="cn-settings">
          <button
            type="button"
            className="cn-btn cn-btn--ghost"
            onClick={() => setSettingsOpen(true)}
            title="Настройки"
            aria-label="Настройки"
          >
            <IconGear />
          </button>
        </div>
      </header>

      {!api.room && <UnoHome api={api} />}
      {api.room && api.room.phase === "lobby" && <UnoLobby api={api} />}
      {api.room && api.room.phase !== "lobby" && <UnoTable api={api} />}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
