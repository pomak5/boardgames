import type { Card } from '../shared';
import './codenames.css';

/** Карточка локальной игры или редактированный онлайн-вид (owner: null = скрыт). */
type TileCard = Pick<Card, 'word' | 'revealed'> & { owner: Card['owner'] | null };

interface Props {
  card: TileCard;
  disabled: boolean;
  spymasterView: boolean;
  onReveal: () => void;
}

const OWNER_CLASS = {
  red: 'cn-card--red',
  blue: 'cn-card--blue',
  neutral: 'cn-card--neutral',
  assassin: 'cn-card--assassin',
} as const;

/** Детерминированный «ручной» наклон карты от -1.4° до 1.4° по слову. */
function tiltOf(word: string): number {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ((h % 29) - 14) / 10;
}

/** Печать принадлежности на капитанском виде (угол лицевой стороны). */
function KeyStamp({ owner }: { owner: Exclude<Card['owner'], null> }) {
  return (
    <svg className={`cn-stamp cn-stamp--${owner}`} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {owner === 'assassin' ? (
        <path
          d="M12 5.5c-2.8 0-4.6 2-4.6 4.6 0 1.6.7 2.9 1.8 3.7l-1.3 4.7 4.1-2 4.1 2-1.3-4.7c1.1-.8 1.8-2.1 1.8-3.7 0-2.6-1.8-4.6-4.6-4.6z"
          fill="currentColor"
        />
      ) : owner === 'neutral' ? (
        <path d="M8 16v-5.5a4 4 0 0 1 8 0V16" fill="none" stroke="currentColor" strokeWidth="1.8" />
      ) : (
        <path d="M12 5.8l1.7 3.7 4 .5-3 2.8.8 4-3.5-2-3.5 2 .8-4-3-2.8 4-.5z" fill="currentColor" />
      )}
    </svg>
  );
}

/** Большая «агентская» печать на обороте открытой карты. */
function SealArt({ owner }: { owner: Exclude<Card['owner'], null> }) {
  return (
    <svg className="cn-seal" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2.4 3.4"
      />
      {owner === 'assassin' ? (
        // череп
        <g fill="currentColor">
          <path d="M32 16c-7.4 0-12.4 5.3-12.4 12.2 0 4.2 1.9 7.6 4.9 9.7v5.4l4-1.6 1.6 3 1.9-3 1.9 3 1.6-3 4 1.6V38c3-2.1 4.9-5.5 4.9-9.7C44.4 21.3 39.4 16 32 16z" />
          <circle cx="26.5" cy="29" r="3.4" fill="var(--seal-bg, #23201c)" />
          <circle cx="37.5" cy="29" r="3.4" fill="var(--seal-bg, #23201c)" />
        </g>
      ) : owner === 'neutral' ? (
        // шляпа прохожего
        <g fill="currentColor">
          <path d="M20 36c0-2 5.4-3.4 12-3.4s12 1.4 12 3.4-5.4 3.4-12 3.4-12-1.4-12-3.4z" />
          <path d="M25 35.4c0-6 2.6-10.4 7-10.4s7 4.4 7 10.4c-2 .9-4.4 1.4-7 1.4s-5-.5-7-1.4z" />
        </g>
      ) : (
        // силуэт агента
        <g fill="currentColor">
          <circle cx="32" cy="25.5" r="6" />
          <path d="M20.5 46c1-7.2 5.6-11.5 11.5-11.5S42.5 38.8 43.5 46h-23z" />
          <path d="M24 24.6h16l-1.6 3.2H25.6z" />
        </g>
      )}
    </svg>
  );
}

export function CardTile({ card, disabled, spymasterView, onReveal }: Props) {
  const revealedClass = card.revealed ? 'cn-card--flipped' : '';
  const dimClass = spymasterView && !card.revealed && card.owner ? `cn-key--${card.owner}` : '';
  return (
    <button
      type="button"
      className={`cn-card ${revealedClass}`}
      style={{ '--tilt': `${tiltOf(card.word)}deg` } as React.CSSProperties}
      disabled={disabled || card.revealed}
      onClick={onReveal}
      aria-label={card.revealed ? `${card.word} — открыто` : card.word}
    >
      <span className="cn-card__inner">
        <span className={`cn-card__face cn-card__front ${dimClass}`}>
          <span className="cn-card__frame" aria-hidden />
          <span className="cn-card__word">{card.word}</span>
          <span className="cn-card__corner cn-card__corner--tl" aria-hidden />
          <span className="cn-card__corner cn-card__corner--br" aria-hidden />
          {spymasterView && !card.revealed && card.owner && <KeyStamp owner={card.owner} />}
        </span>
        <span
          className={`cn-card__face cn-card__back ${card.owner ? OWNER_CLASS[card.owner] : ''}`}
        >
          <span className="cn-card__frame cn-card__frame--back" aria-hidden />
          {card.owner && <SealArt owner={card.owner} />}
          <span className="cn-card__word cn-card__word--back">{card.word}</span>
        </span>
      </span>
    </button>
  );
}
