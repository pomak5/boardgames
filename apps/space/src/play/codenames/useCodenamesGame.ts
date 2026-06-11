import { useCallback, useMemo, useState } from "react";
import type {
  BotClueTrace,
  BotRisk,
  Clue,
  CodenamesState,
  Team,
} from "../shared";
import {
  BOARD_SIZE,
  createGame,
  giveClue,
  guess,
  pass,
  pickWords,
  score,
  suggestClue,
} from "../shared";
import { sounds } from "./sounds";

export type CaptainMode = "bot" | "human";

export interface GameSettings {
  captainMode: CaptainMode;
  risk: BotRisk;
}

export interface GameApi {
  state: CodenamesState;
  settings: GameSettings;
  trace: BotClueTrace | null;
  spymasterView: boolean;
  score: Record<Team, number>;
  askBot: () => void;
  submitClue: (clue: Clue) => string | null;
  reveal: (index: number) => void;
  stopGuessing: () => void;
  toggleSpymasterView: () => void;
  restart: () => void;
}

export function useCodenamesGame(settings: GameSettings): GameApi {
  const make = () => createGame(pickWords(BOARD_SIZE));
  const [state, setState] = useState<CodenamesState>(make);
  const [trace, setTrace] = useState<BotClueTrace | null>(null);
  const [spymasterView, setSpymasterView] = useState(false);

  const askBot = useCallback(() => {
    setState(s => {
      if (s.phase !== "clue") return s;
      const t = suggestClue(s, s.turn, settings.risk);
      if (!t) return s;
      setTrace(t);
      return giveClue(s, t.clue);
    });
  }, [settings.risk]);

  const submitClue = useCallback((clue: Clue): string | null => {
    let error: string | null = null;
    setState(s => {
      if (s.phase !== "clue") return s;
      try {
        const next = giveClue(s, clue);
        setTrace(null);
        return next;
      } catch (e) {
        error = e instanceof Error ? e.message : "Неверная подсказка";
        return s;
      }
    });
    return error;
  }, []);

  const reveal = useCallback((index: number) => {
    setState(s => {
      if (s.phase !== "guess" || s.cards[index]?.revealed) return s;
      const before = s.turn;
      const next = guess(s, index);
      const owner = s.cards[index]?.owner;
      if (next.phase === "finished") {
        (next.winner === before ? sounds.win : sounds.lose)();
      } else if (owner === before) {
        sounds.good();
      } else {
        sounds.bad();
      }
      return next;
    });
  }, []);

  const stopGuessing = useCallback(() => {
    setState(s => (s.phase === "guess" ? pass(s) : s));
  }, []);

  const restart = useCallback(() => {
    setState(make());
    setTrace(null);
  }, []);

  const toggleSpymasterView = useCallback(() => setSpymasterView(v => !v), []);

  const tally = useMemo(() => score(state), [state]);

  return {
    state,
    settings,
    trace,
    spymasterView,
    score: tally,
    askBot,
    submitClue,
    reveal,
    stopGuessing,
    toggleSpymasterView,
    restart,
  };
}
