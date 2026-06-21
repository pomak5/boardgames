import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./net/useAuth";
import { HomeScreen } from "./online/HomeScreen";
import { OnlineGameScreen } from "./online/OnlineGameScreen";
import { useRoom } from "./online/useRoom";
import { SettingsModal } from "./SettingsModal";
import "./theme.css";

/** Базовый путь экрана Коднеймс (без кода комнаты). */
const BASE = "/codenames";

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const auth = useAuth();
  const roomApi = useRoom();
  const navigate = useNavigate();
  const { room: roomParam } = useParams();

  // Комната дилится сразу при входе, поэтому отдельного лобби нет:
  // либо экран входа (нет комнаты), либо живой стол.
  const inRoom = roomApi.room !== null;
  const roomCode = roomApi.room?.code ?? null;

  // Синхронизируем URL с текущей комнатой: /codenames/CODE в комнате,
  // /codenames — на входе. replace, чтобы не засорять историю.
  useEffect(() => {
    const wanted = roomCode ? `${BASE}/${roomCode}` : BASE;
    if (window.location.pathname !== wanted) {
      navigate(wanted, { replace: true });
    }
  }, [roomCode, navigate]);

  // Авто-вход по ссылке: /codenames/CODE и ник уже известен (профиль или
  // память) — заходим сразу. Иначе код подставится в поле на экране входа.
  const attemptedRef = useRef<string | null>(null);

  // При выходе из комнаты (roomCode стал null) URL с кодом ещё не успел
  // обновиться, и авто-вход пытался бы зайти в только что покинутую комнату,
  // получая «Комната не найдена». Запоминаем код покинутой комнаты, чтобы
  // guard ниже пропустил эту попытку.
  const prevRoomCodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevRoomCodeRef.current && !roomCode) {
      attemptedRef.current = prevRoomCodeRef.current;
    }
    prevRoomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    if (inRoom || roomApi.busy) return;
    const code = roomParam?.toUpperCase();
    if (!code || attemptedRef.current === code) return;
    const nick = auth.user?.nickname ?? localStorage.getItem("nickname");
    if (!nick || !nick.trim()) return; // ждём, пока юзер введёт ник в HomeScreen
    attemptedRef.current = code;
    roomApi.join(code, nick.trim());
  }, [inRoom, roomApi, roomParam, auth.user]);

  return (
    <>
      {inRoom ? (
        <OnlineGameScreen
          api={roomApi}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <HomeScreen
          api={roomApi}
          auth={auth}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
