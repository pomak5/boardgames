/** Базовые типизированные события комнаты (расширяются по мере задач). */
export type GameId = 'codenames' | 'uno' | 'alias';

export interface RoomSettings {
  game: GameId;
  maxPlayers: number;
  botsEnabled: boolean;
  botCount: number;
}

export interface ChatMessage {
  authorId: string;
  authorName: string;
  text: string;
  sentAt: number;
}

/** События сервер → клиент. */
export interface ServerToClientEvents {
  'room:state': (state: { code: string; settings: RoomSettings; playerIds: string[] }) => void;
  'chat:message': (msg: ChatMessage) => void;
}

/** События клиент → сервер. */
export interface ClientToServerEvents {
  'room:join': (code: string, nickname: string) => void;
  'chat:send': (text: string) => void;
}
