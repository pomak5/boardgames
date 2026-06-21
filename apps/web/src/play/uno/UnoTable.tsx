import type { UnoCard, UnoColor } from "@shared/uno/types";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { IconBot } from "../icons";
import { Chat } from "../online/Chat";
import { unoSounds } from "./sounds";
import type { UnoRoomApi } from "./useUnoRoom";

const COLOR_RU: Record<UnoColor, string> = {
  red: "красный",
  yellow: "жёлтый",
  green: "зелёный",
  blue: "синий",
};

function cardLabel(card: UnoCard): string {
  if (card.value === "skip") return "⊘";
  if (card.value === "reverse") return "⇄";
  if (card.value === "draw2") return "+2";
  if (card.value === "wild") return "✦";
  if (card.value === "wild4") return "+4";
  return String(card.value);
}

function colorClass(card: UnoCard): string {
  return card.color ? `pc-${card.color}` : "pc-wild";
}

function isSpecial(card: UnoCard): boolean {
  return (
    card.value === "skip" ||
    card.value === "reverse" ||
    card.value === "draw2" ||
    card.value === "wild" ||
    card.value === "wild4"
  );
}

/** Места соперников по дуге над столом (игрок — внизу по центру). */
function seatPos(i: number, n: number): { x: number; y: number } {
  const span = Math.min(232, 84 + n * 26);
  const start = 270 - span / 2;
  const f = n <= 1 ? 0.5 : i / (n - 1);
  const a = ((start + f * span) * Math.PI) / 180;
  return { x: 50 + 43 * Math.cos(a), y: 45 + 38 * Math.sin(a) };
}

/** Детерминированный «неровный» сдвиг/поворот карты в стопке сброса по её id. */
function scatter(id: number): { x: number; y: number; rot: number } {
  const h = (id * 2654435761) >>> 0;
  return {
    x: (h % 25) - 12,
    y: ((h >> 4) % 21) - 10,
    rot: ((h >> 9) % 37) - 18,
  };
}

export function PlayCard({
  card,
  playable,
  disabled,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  style,
}: {
  card: UnoCard;
  playable?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
}) {
  const label = cardLabel(card);
  const inner = (
    <>
      <span className="oval" />
      <span className="idx tl">{label}</span>
      <span className="big">{label}</span>
      <span className="idx br">{label}</span>
    </>
  );
  if (!onClick)
    return (
      <div className={`playcard ${colorClass(card)}`} style={style}>
        {inner}
      </div>
    );
  return (
    <button
      type="button"
      className={`playcard ${colorClass(card)} ${playable ? "playable" : ""}`}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={style}
      aria-label={`Карта ${card.color ? COLOR_RU[card.color] : "дикая"} ${label}`}
    >
      {inner}
    </button>
  );
}

/** Веер рубашек у соперника. */
function BackFan({ count }: { count: number }) {
  const show = Math.min(Math.max(count, 1), 6);
  const mid = (show - 1) / 2;
  return (
    <span className="uno-backs" aria-hidden="true">
      {Array.from({ length: show }).map((_, i) => (
        <i
          // карты-рубашки декоративны и без своих id
          key={`back-${i}`}
          style={
            {
              "--r": `${(i - mid) * 10}deg`,
              "--ty": `${Math.abs(i - mid) * 2}px`,
              zIndex: i,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function DirArrows({ ccw }: { ccw: boolean }) {
  return (
    <svg
      className={`uno-dir ${ccw ? "uno-dir--ccw" : ""}`}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M78 35a32 32 0 0 0-55-6" />
      <path d="M23 14v16h16" fill="currentColor" stroke="none" />
      <path d="M22 65a32 32 0 0 0 55 6" />
      <path d="M77 86V70H61" fill="currentColor" stroke="none" />
    </svg>
  );
}

function useCountdown(deadline: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) {
      setLeft(null);
      return;
    }
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

interface FlyCard {
  id: number;
  card: UnoCard;
  dx: number;
  dy: number;
  spin: number;
  ex: number;
  ey: number;
  erot: number;
  dur: number;
}

export function UnoTable({ api }: { api: UnoRoomApi }) {
  const room = api.room;
  const game = api.game;
  const [shout, setShout] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [flies, setFlies] = useState<FlyCard[]>([]);
  const seenLog = useRef(0);
  const flyId = useRef(0);
  const prevTurn = useRef<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const left = useCountdown(api.turnDeadline);
  const [burst, setBurst] = useState<{ id: number; color: string } | null>(
    null,
  );
  const prevColor = useRef<string | null>(null);
  const drag = useRef<{
    id: number;
    sx: number;
    sy: number;
    el: HTMLElement;
    moved: boolean;
  } | null>(null);

  const nickOf = (id: string) =>
    room?.players.find(p => p.id === id)?.nickname ?? "—";

  // реагируем на новые события лога: полёт карты, звуки, крик UNO!, тряска
  useEffect(() => {
    if (!game || !room) return;
    const prev = seenLog.current;
    seenLog.current = game.log.length;
    if (prev === 0) return;

    const meId = api.playerId;
    const meIdx = game.players.findIndex(p => p.id === meId);
    const order = [
      ...game.players.slice(meIdx + 1),
      ...game.players.slice(0, Math.max(meIdx, 0)),
    ];
    const srcPos = (pid: string) => {
      if (pid === meId) return { x: 50, y: 97 };
      const idx = order.findIndex(p => p.id === pid);
      return seatPos(idx < 0 ? 0 : idx, order.length);
    };
    const launch = (card: UnoCard, pid: string) => {
      const tr = tableRef.current?.getBoundingClientRect();
      const dr = discardRef.current?.getBoundingClientRect();
      if (!tr || !dr) return;
      const dcx = dr.left + dr.width / 2;
      const dcy = dr.top + dr.height / 2;
      const pos = srcPos(pid);
      const dx = tr.left + (pos.x / 100) * tr.width - dcx;
      const dy = tr.top + (pos.y / 100) * tr.height - dcy;
      const s = scatter(card.id);
      const id = ++flyId.current;
      // разная скорость/замах — бросок ощущается «живым»
      const spin =
        (pid === meId ? -8 : (pos.x - 50) * 0.7) + (Math.random() * 12 - 6);
      const dur = 440 + Math.random() * 340;
      setFlies(f => [
        ...f,
        { id, card, dx, dy, spin, ex: s.x, ey: s.y, erot: s.rot, dur },
      ]);
      setTimeout(() => setFlies(f => f.filter(c => c.id !== id)), dur + 80);
    };

    for (const e of game.log.slice(prev)) {
      if (e.type === "play") {
        launch(e.card, e.player);
        if (isSpecial(e.card)) unoSounds.special();
        else unoSounds.play();
      } else if (e.type === "jumpIn") {
        launch(e.card, e.player);
        unoSounds.play();
      } else if (e.type === "draw") {
        unoSounds.draw();
      } else if (e.type === "uno") {
        setShout(room.players.find(p => p.id === e.player)?.nickname ?? "");
        setTimeout(() => setShout(null), 1400);
        unoSounds.uno();
      } else if (e.type === "caught") {
        setShake(true);
        setTimeout(() => setShake(false), 700);
        unoSounds.caught();
      } else if (e.type === "roundEnd" || e.type === "gameOver") {
        (e.winner === meId ? unoSounds.win : unoSounds.lose)();
      }
    }
  }, [game, room, api.playerId]);

  // звук «ваш ход»
  useEffect(() => {
    if (!game) return;
    const cur = game.turnPlayerId;
    if (
      prevTurn.current !== null &&
      prevTurn.current !== cur &&
      cur === api.playerId &&
      game.phase === "play"
    )
      unoSounds.turn();
    prevTurn.current = cur;
  }, [game, api.playerId]);

  // wild-вспышка: при смене активного цвета дикой картой
  useEffect(() => {
    if (!game) return;
    const top = game.topCard;
    if (
      prevColor.current !== null &&
      prevColor.current !== game.color &&
      (top.value === "wild" || top.value === "wild4")
    ) {
      const id = Date.now();
      setBurst({ id, color: game.color });
      setTimeout(() => setBurst(b => (b?.id === id ? null : b)), 640);
    }
    prevColor.current = game.color;
  }, [game]);

  if (!room || !game) return null;

  const meId = api.playerId;
  const me = game.players.find(p => p.id === meId);
  const myTurn = game.turnPlayerId === meId;
  const meIdx = game.players.findIndex(p => p.id === meId);
  const opps = [
    ...game.players.slice(meIdx + 1),
    ...game.players.slice(0, Math.max(meIdx, 0)),
  ];
  const playableSet = new Set(game.playable);
  const isHost = meId === room.hostId;
  const finished = game.phase === "finished" || room.phase === "finished";
  const sorted = [...game.players].sort((a, b) => b.score - a.score);

  const status = (() => {
    if (game.phase === "roundEnd" || finished) return "";
    if (!myTurn) return `Ходит ${nickOf(game.turnPlayerId)}`;
    if (game.phase === "chooseColor") return "Выберите цвет";
    if (game.phase === "choosePlayer") return "С кем меняемся руками?";
    if (game.phase === "challenge") return "Оспорить +4?";
    if (game.pendingDraw > 0)
      return game.playable.length > 0
        ? `Ответьте картой или возьмите ${game.pendingDraw}`
        : `Возьмите ${game.pendingDraw} карты`;
    if (game.drewThisTurn)
      return game.playable.length > 0
        ? "Сыграйте взятую карту или пас"
        : "Ход переходит…";
    return "Ваш ход";
  })();

  const fan = (i: number, n: number) => {
    const mid = (n - 1) / 2;
    const off = i - mid;
    return {
      "--rot": `${off * (n > 9 ? 3 : 5)}deg`,
      "--lift": `${Math.abs(off) * (n > 9 ? 3 : 5)}px`,
      zIndex: i + 1,
      animationDelay: `${Math.min(i, 9) * 55}ms`,
    } as React.CSSProperties;
  };

  const unoEnabled = !!me && me.handCount <= 2;
  const pressUno = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 500);
    api.act({ type: "uno" });
  };

  // стопка сброса: последние сыгранные карты остаются на столе «неровной» кучкой
  const recentPile: UnoCard[] = (() => {
    const cards = game.log
      .filter(e => e.type === "play" || e.type === "jumpIn")
      .map(e => (e as { card: UnoCard }).card);
    if (cards.length === 0 || cards[cards.length - 1].id !== game.topCard.id)
      cards.push(game.topCard);
    return cards.slice(-5);
  })();

  const onCardDown = (e: React.PointerEvent, cardId: number) => {
    if (!playableSet.has(cardId)) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    drag.current = {
      id: cardId,
      sx: e.clientX,
      sy: e.clientY,
      el,
      moved: false,
    };
  };
  const onCardMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    d.el.style.transition = "none";
    d.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.04}deg) scale(1.06)`;
    d.el.style.zIndex = "120";
  };
  const onCardUp = (e: React.PointerEvent, cardId: number) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    d.el.style.transition = "";
    d.el.style.transform = "";
    d.el.style.zIndex = "";
    const tr = tableRef.current?.getBoundingClientRect();
    let drop = !d.moved;
    if (tr) {
      const cx = tr.left + tr.width / 2;
      const cy = tr.top + tr.height * 0.47;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < 200) drop = true;
    }
    if (drop) api.act({ type: "play", cardId });
  };

  return (
    <div className="uno-screen">
      <div className={`uno-table ${shake ? "shake" : ""}`} ref={tableRef}>
        <DirArrows ccw={game.dir === -1} />
        {burst && (
          <div
            key={burst.id}
            className="uno-burst"
            style={{ background: `var(--uno-${burst.color})` }}
          />
        )}

        {opps.map((p, i) => {
          const pos = seatPos(i, opps.length);
          const rp = room.players.find(rp => rp.id === p.id);
          return (
            <div
              key={p.id}
              className={`uno-seat ${game.turnPlayerId === p.id ? "uno-seat--turn" : ""}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <BackFan count={p.handCount} />
              <span className="ava">
                {rp?.isBot ? (
                  <IconBot />
                ) : (
                  <Avatar
                    nickname={nickOf(p.id)}
                    avatarUrl={rp?.avatarUrl}
                    size={44}
                  />
                )}
                {p.saidUno && p.handCount === 1 && (
                  <span className="uno-seat__uno">UNO!</span>
                )}
                {rp && !rp.connected && (
                  <span className="uno-seat__away" title="отключился">
                    z
                  </span>
                )}
              </span>
              <span className="uno-seat__name">{nickOf(p.id)}</span>
              <span className="cnt">
                {p.handCount} карт
                {game.rules.targetScore ? ` · ${p.score} очк` : ""}
              </span>
            </div>
          );
        })}

        <div className="uno-pile">
          <button
            type="button"
            className="uno-deck deck-stack playcard back"
            onClick={() => api.act({ type: "draw" })}
            disabled={
              !myTurn ||
              game.phase !== "play" ||
              (game.drewThisTurn && game.pendingDraw === 0)
            }
            aria-label={
              game.pendingDraw > 0
                ? `Взять ${game.pendingDraw} карты`
                : "Взять карту"
            }
          >
            <span className="oval" />
            <span className="big">УНО</span>
            <span className="deck-count">
              {myTurn && game.pendingDraw > 0
                ? `взять ${game.pendingDraw}`
                : `в колоде: ${game.deckCount}`}
            </span>
          </button>
          <div className="uno-discard-wrap" ref={discardRef}>
            <div className="uno-discard-pile">
              {recentPile.map((c, idx) => {
                const s = scatter(c.id);
                return (
                  <div
                    key={c.id}
                    className="uno-pile-card"
                    style={{
                      transform: `translate(-50%,-50%) translate(${s.x}px,${s.y}px) rotate(${s.rot}deg)`,
                      zIndex: idx,
                    }}
                  >
                    <PlayCard card={c} />
                  </div>
                );
              })}
              {flies.map(f => (
                <div
                  key={f.id}
                  className="uno-fly"
                  style={
                    {
                      "--dx": `${f.dx}px`,
                      "--dy": `${f.dy}px`,
                      "--spin": `${f.spin}deg`,
                      "--ex": `${f.ex}px`,
                      "--ey": `${f.ey}px`,
                      "--erot": `${f.erot}deg`,
                      animationDuration: `${f.dur}ms`,
                    } as React.CSSProperties
                  }
                >
                  <PlayCard card={f.card} />
                </div>
              ))}
            </div>
            {game.pendingDraw > 0 && (
              <span className="uno-pending">+{game.pendingDraw}</span>
            )}
            <span className="uno-color-dot">
              <i style={{ background: `var(--uno-${game.color})` }} />{" "}
              {COLOR_RU[game.color]}
            </span>
          </div>
        </div>

        {me && (
          <div className="uno-hand">
            {game.hand.map((card, i) => (
              <PlayCard
                key={card.id}
                card={card}
                playable={playableSet.has(card.id)}
                disabled={!playableSet.has(card.id)}
                onClick={() => {}}
                onPointerDown={e => onCardDown(e, card.id)}
                onPointerMove={onCardMove}
                onPointerUp={e => onCardUp(e, card.id)}
                style={fan(i, game.hand.length)}
              />
            ))}
          </div>
        )}

        {me && !finished && game.phase !== "roundEnd" && (
          <button
            type="button"
            className={`uno-btn ${pressed ? "pressed" : ""}`}
            onClick={pressUno}
            disabled={!unoEnabled}
            aria-label="Сказать UNO"
          >
            UNO!
          </button>
        )}

        {game.catchablePlayerId && (
          <button
            type="button"
            className="uno-catch"
            onClick={() => api.act({ type: "catch" })}
          >
            Поймать: {nickOf(game.catchablePlayerId)} не сказал UNO!
          </button>
        )}

        {shout && <div className="uno-shout">UNO! — {shout}</div>}

        {myTurn && game.phase === "chooseColor" && (
          <div className="uno-overlay">
            <div className="uno-prompt">
              <h3>Выберите цвет</h3>
              <div className="row">
                {(["red", "yellow", "green", "blue"] as UnoColor[]).map(c => (
                  <button
                    key={c}
                    type="button"
                    className="uno-color-btn"
                    style={{ background: `var(--uno-${c})` }}
                    onClick={() => api.act({ type: "chooseColor", color: c })}
                    aria-label={COLOR_RU[c]}
                    title={COLOR_RU[c]}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {myTurn && game.phase === "choosePlayer" && (
          <div className="uno-overlay">
            <div className="uno-prompt">
              <h3>Семёрка! С кем меняемся руками?</h3>
              <div className="row">
                {game.players
                  .filter(p => p.id !== meId)
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="un-btn un-btn--ghost"
                      onClick={() =>
                        api.act({ type: "choosePlayer", targetId: p.id })
                      }
                    >
                      {nickOf(p.id)} ({p.handCount})
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {myTurn && game.phase === "challenge" && (
          <div className="uno-overlay">
            <div className="uno-prompt">
              <h3>Вам кинули +4. Оспорить?</h3>
              <p style={{ fontSize: 13, marginBottom: 14 }}>
                Если это был блеф — штраф уйдёт сопернику. Если нет — возьмёте
                +6.
              </p>
              <div className="row">
                <button
                  type="button"
                  className="un-btn"
                  onClick={() => api.act({ type: "challenge", accept: true })}
                >
                  Блефует!
                </button>
                <button
                  type="button"
                  className="un-btn un-btn--ghost"
                  onClick={() => api.act({ type: "challenge", accept: false })}
                >
                  Беру карты
                </button>
              </div>
            </div>
          </div>
        )}

        {game.phase === "roundEnd" && !finished && (
          <div className="uno-overlay">
            <div className="uno-prompt">
              <h3>Раунд за {nickOf(game.roundWinner ?? "")}!</h3>
              <ul className="uno-scores">
                {sorted.map(p => (
                  <li
                    key={p.id}
                    className={p.id === game.roundWinner ? "uno-winner" : ""}
                  >
                    <span>{nickOf(p.id)}</span>
                    <span>
                      {p.score} из {game.rules.targetScore}
                    </span>
                  </li>
                ))}
              </ul>
              {isHost ? (
                <button
                  type="button"
                  className="un-btn"
                  onClick={api.nextRound}
                  disabled={api.busy}
                >
                  Следующий раунд
                </button>
              ) : (
                <div className="un-hint">Ждём, когда хост раздаст карты…</div>
              )}
            </div>
          </div>
        )}

        {finished && (
          <div className="uno-overlay">
            <div className="uno-prompt">
              <h3>Победа: {nickOf(game.winner ?? game.roundWinner ?? "")}</h3>
              <ul className="uno-scores">
                {sorted.map(p => (
                  <li
                    key={p.id}
                    className={
                      p.id === (game.winner ?? game.roundWinner)
                        ? "uno-winner"
                        : ""
                    }
                  >
                    <span>{nickOf(p.id)}</span>
                    <span>{p.score} очков</span>
                  </li>
                ))}
              </ul>
              <div className="row">
                {isHost && (
                  <button
                    type="button"
                    className="un-btn"
                    onClick={api.newGame}
                    disabled={api.busy}
                  >
                    Новая игра
                  </button>
                )}
                <button
                  type="button"
                  className="un-btn un-btn--ghost"
                  onClick={api.leave}
                >
                  Выйти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="uno-status">
        <span>{status}</span>
        {game.canPass && (
          <button
            type="button"
            className="un-btn un-btn--ghost"
            onClick={() => api.act({ type: "pass" })}
          >
            Пас
          </button>
        )}
        {left !== null && !finished && game.phase !== "roundEnd" && (
          <span className={`uno-timer ${left <= 5 ? "uno-timer--low" : ""}`}>
            {left} сек
          </span>
        )}
        {api.error && <span className="un-error">{api.error}</span>}
      </div>

      <div className="uno-below">
        <Chat messages={api.chat} meId={api.playerId} onSend={api.sendChat} />
        <div className="uno-panel">
          <h4>Комната</h4>
          {me && (
            <div className="uno-room-line">
              <span>Вы</span>
              <span>
                {nickOf(me.id)} · {me.handCount} карт
                {game.rules.targetScore ? ` · ${me.score} очк` : ""}
              </span>
            </div>
          )}
          <div className="uno-room-line">
            <span>Игроков</span>
            <span>{game.players.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
