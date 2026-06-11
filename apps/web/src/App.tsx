import { generateRoomCode } from '@boardgames/shared';

export function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Настолки</h1>
      <p>Скелет проекта работает. Пример кода комнаты из shared: {generateRoomCode()}</p>
    </main>
  );
}
