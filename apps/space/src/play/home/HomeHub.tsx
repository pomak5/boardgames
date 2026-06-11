import { useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowRight, IconDice, IconGear } from "../icons";
import { SettingsModal } from "../SettingsModal";
import "./home.css";

/** Арт Коднеймс: мини-поле 3×3 с командными карточками. */
function CodenamesArt() {
  const cells: { x: number; y: number; fill: string }[] = [
    { x: 10, y: 14, fill: "var(--team-red)" },
    { x: 36, y: 14, fill: "var(--card-face)" },
    { x: 62, y: 14, fill: "var(--team-blue)" },
    { x: 10, y: 38, fill: "var(--team-blue)" },
    { x: 36, y: 38, fill: "#3b3b3b" },
    { x: 62, y: 38, fill: "var(--team-red)" },
    { x: 10, y: 62, fill: "var(--card-face)" },
    { x: 36, y: 62, fill: "var(--team-red)" },
    { x: 62, y: 62, fill: "var(--team-blue)" },
  ];
  return (
    <svg
      className="bn-art"
      viewBox="0 0 92 92"
      aria-hidden="true"
      focusable={false}
    >
      <g className="bn-lift">
        {cells.map(c => (
          <rect
            key={`${c.x}-${c.y}`}
            x={c.x}
            y={c.y}
            width="20"
            height="16"
            rx="3.5"
            fill={c.fill}
            stroke="var(--border)"
            strokeWidth="1.4"
          />
        ))}
        <path
          d="M14 21h12M40 21h12M66 21h12M14 45h12M66 45h12M14 69h12M40 69h12M66 69h12"
          stroke="#00000038"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M40 45h12"
          stroke="#ffffff66"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** Арт UNO: веер карт (из design/final.html). */
function UnoArt() {
  return (
    <svg
      className="bn-art"
      viewBox="0 0 92 92"
      aria-hidden="true"
      focusable={false}
    >
      <g className="bn-lift">
        <rect
          x="14"
          y="20"
          width="34"
          height="50"
          rx="6"
          fill="var(--uno-blue)"
          stroke="var(--card-face)"
          strokeWidth="3"
          transform="rotate(-14 31 45)"
        />
        <rect
          x="28"
          y="16"
          width="34"
          height="50"
          rx="6"
          fill="var(--uno-green)"
          stroke="var(--card-face)"
          strokeWidth="3"
          transform="rotate(-4 45 41)"
        />
        <rect
          x="42"
          y="16"
          width="34"
          height="50"
          rx="6"
          fill="var(--uno-red)"
          stroke="var(--card-face)"
          strokeWidth="3"
          transform="rotate(8 59 41)"
        />
        <ellipse
          cx="59"
          cy="41"
          rx="11"
          ry="16"
          fill="#ffffff30"
          transform="rotate(8 59 41)"
        />
        <text
          x="59"
          y="49"
          fontFamily="Nunito,sans-serif"
          fontSize="22"
          fontWeight="900"
          fill="#fff"
          textAnchor="middle"
          transform="rotate(8 59 41)"
        >
          7
        </text>
      </g>
    </svg>
  );
}

/** Арт Alias: реплика «сло-во» + песочные часы (из design/final.html). */
function AliasArt() {
  return (
    <svg
      className="bn-art"
      viewBox="0 0 92 92"
      aria-hidden="true"
      focusable={false}
    >
      <g className="bn-lift">
        <path
          d="M14 26 a12 12 0 0 1 12-12 h26 a12 12 0 0 1 12 12 v14 a12 12 0 0 1-12 12 h-18 l-10 10 v-10 a12 12 0 0 1-10-12 Z"
          fill="var(--accent)"
          opacity=".92"
        />
        <text
          x="39"
          y="42"
          fontFamily="Caveat,cursive"
          fontSize="22"
          fontWeight="700"
          fill="var(--accent-text)"
          textAnchor="middle"
        >
          сло-во
        </text>
        <g transform="translate(56 50)">
          <path
            d="M5 2 h16 M5 30 h16 M7 2 c0 8 4 10 6 12 c2 2 6 4 6 12 M19 2 c0 8-4 10-6 12 c-2 2-6 4-6 12"
            fill="none"
            stroke="var(--text-strong)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path d="M13 14 l-4.5 11 h9 Z" fill="var(--gold)" />
        </g>
      </g>
    </svg>
  );
}

/** Главный экран: выбор игры на вечер (дизайн — design/final.html). */
export function HomeHub() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="bn-home">
      <header className="bn-nav">
        <span className="bn-logo">
          <IconDice className="bn-logo__dice" />
          <b>Настолки</b>
        </span>
        <button
          type="button"
          className="cn-btn cn-btn--ghost bn-nav__settings"
          onClick={() => setSettingsOpen(true)}
          aria-label="Настройки"
          title="Настройки"
        >
          <IconGear />
        </button>
      </header>

      <section className="bn-hero">
        <svg
          className="bn-doodle"
          style={{ left: "4%", top: "22%", width: 54 }}
          viewBox="0 0 40 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect
            x="8"
            y="5"
            width="22"
            height="30"
            rx="4"
            transform="rotate(-12 19 20)"
          />
          <path d="M14 18c2.5-3 7-3 9.5 0" transform="rotate(-12 19 20)" />
        </svg>
        <svg
          className="bn-doodle"
          style={{ right: "5%", top: "14%", width: 46 }}
          viewBox="0 0 40 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="20" cy="20" r="13" />
          <path d="M20 12v8l5.5 4" />
        </svg>
        <svg
          className="bn-doodle"
          style={{ right: "13%", bottom: "6%", width: 38 }}
          viewBox="0 0 40 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 5l3.6 9.2 9.9.6-7.7 6.3 2.5 9.6L20 25.4l-8.3 5.3 2.5-9.6-7.7-6.3 9.9-.6Z" />
        </svg>

        <h1>
          Соберёмся{" "}
          <span className="bn-script">
            за столом?
            <svg
              viewBox="0 0 200 14"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M4 9 C40 3 80 11 110 7 C145 3 175 8 196 6"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        <p>
          Коднеймс, Uno и другие настолки онлайн. Создай комнату для друзей —
          играть можно даже без регистрации.
        </p>
      </section>

      <main className="bn-tiles">
        <Link to="/codenames" className="bn-tile">
          <CodenamesArt />
          <div>
            <h3>
              Коднеймс <span className="bn-tag">2 команды +</span>
            </h3>
            <p>
              Капитаны дают намёки из одного слова, команды ищут своих агентов.
              С ботом, в коопе или онлайн-комнате с чатом.
            </p>
          </div>
          <IconArrowRight className="bn-go" />
        </Link>

        <Link to="/uno" className="bn-tile">
          <UnoArt />
          <div>
            <h3>
              УНО <span className="bn-tag">2–10 игроков</span>
            </h3>
            <p>
              Классика и куча вариаций: стэкинг, jump-in, 7-0, челлендж +4.
              Кнопка «UNO!» со штрафом, боты для недостающих игроков.
            </p>
          </div>
          <IconArrowRight className="bn-go" />
        </Link>

        <div className="bn-tile bn-tile--soon">
          <AliasArt />
          <div>
            <h3>
              ALIAS <span className="bn-tag">2 команды +</span>{" "}
              <span className="bn-tag bn-tag--soon">скоро</span>
            </h3>
            <p>
              Объясняй слова своей команде на время. Словари по сложности:
              лёгкий, средний, сложный.
            </p>
          </div>
        </div>
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
