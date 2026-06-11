import type { Card } from '@boardgames/shared';
import './codenames.css';

interface Props {
  card: Card;
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

/** Метка принадлежности для капитанского вида: цветная «печать» в углу. */
function KeyStamp({ owner }: { owner: Card['owner'] }) {
  return (
    <svg className={`cn-stamp cn-stamp--${owner}`} viewBox="0 0 24 24" aria-hidden>
      {owner === 'assassin' ? (
        <path
          d="M12 3c-3 0-5 2.2-5 5 0 1.8.8 3.2 2 4l-1.6 8 4.6-2.4L16.6 20 15 12c1.2-.8 2-2.2 2-4 0-2.8-2-5-5-5z"
          fill="currentColor"
        />
      ) : (
        <circle cx="12" cy="12" r="8" fill="currentColor" />
      )}
    </svg>
  );
}

export function CardTile({ card, disabled, spymasterView, onReveal }: Props) {
  const revealedClass = card.revealed ? 'cn-card--flipped' : '';
  return (
    <button
      type="button"
      className={`cn-card ${revealedClass}`}
      disabled={disabled || card.revealed}
      onClick={onReveal}
      aria-label={card.revealed ? `${card.word} — открыто` : card.word}
    >
      <span className="cn-card__inner">
        <span className="cn-card__face cn-card__front">
          {card.word}
          {spymasterView && !card.revealed && <KeyStamp owner={card.owner} />}
        </span>
        <span className={`cn-card__face cn-card__back ${OWNER_CLASS[card.owner]}`}>
          {card.word}
        </span>
      </span>
    </button>
  );
}
