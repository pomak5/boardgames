import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthModal } from "../AuthModal";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../net/useAuth";
import { SettingsModal } from "../SettingsModal";
import { setSettings, type Theme, useSettings } from "../settings";
import "./home.css";

const NAV_LINKS = [
  { href: "#games", label: "Игры" },
  { href: "#how", label: "Как играть" },
  { href: "#rooms", label: "Столы" },
  { href: "#about", label: "О проекте" },
];

export function HomeHub() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const auth = useAuth();
  const settings = useSettings();
  const navigate = useNavigate();

  const setTheme = (t: Theme) => setSettings({ theme: t });

  const closeBurger = () => setBurgerOpen(false);

  const onProfileClick = () => {
    if (auth.user) navigate("/profile");
    else setAuthOpen(true);
  };

  return (
    <div className="bn-home">
      {/* ============ NAV ============ */}
      <nav className="nav rise d0" aria-label="Основная навигация">
        <Link className="logo" to="/" aria-label="Настолки — на главную">
          <svg
            className="mark"
            viewBox="0 0 33 33"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="31" height="31" rx="6" />
            <circle
              cx="8.25"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="8.25"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="16.5"
              cy="16.5"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <b>Настолки</b>
        </Link>

        <div className={`nav-links${burgerOpen ? " open" : ""}`} id="navLinks">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={closeBurger}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="nav-actions">
          <button
            className={`nav-burger${burgerOpen ? " open" : ""}`}
            type="button"
            aria-label="Меню"
            aria-expanded={burgerOpen}
            aria-controls="navLinks"
            onClick={() => setBurgerOpen(v => !v)}
          >
            <svg
              className="bars"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <svg
              className="x"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div className="theme-toggle" role="group" aria-label="Тема">
            <button
              type="button"
              data-set="light"
              aria-label="Светлая тема"
              className={settings.theme === "light" ? "on" : ""}
              onClick={() => setTheme("light")}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
              </svg>
            </button>
            <button
              type="button"
              data-set="dark"
              aria-label="Тёмная тема"
              className={settings.theme === "dark" ? "on" : ""}
              onClick={() => setTheme("dark")}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            className="icon-btn"
            aria-label="Настройки"
            onClick={() => setSettingsOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {auth.user ? (
            <div
              className="profile-pill"
              role="button"
              tabIndex={0}
              aria-label={auth.user.nickname}
              title={auth.user.nickname}
              onClick={onProfileClick}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") onProfileClick();
              }}
            >
              <Avatar
                nickname={auth.user.nickname}
                avatarUrl={auth.user.avatarUrl}
                size={32}
              />
              <span className="pill-name">{auth.user.nickname}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          ) : (
            <button
              type="button"
              className="signin"
              onClick={() => setAuthOpen(true)}
            >
              Войти
            </button>
          )}
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <div className="art art-1 art-card">
            <span className="word">ЗВЕЗДА</span>
            <span className="pip" />
          </div>
          <div className="art art-2 art-uno">
            <div className="oval">
              <b>7</b>
            </div>
          </div>
          <div className="art art-3 art-die">
            <i />
            <i className="hide" />
            <i />
            <i className="hide" />
            <i />
            <i className="hide" />
            <i />
            <i className="hide" />
            <i />
          </div>
          <div className="art art-4 art-card">
            <span className="word">КОШКА</span>
            <span className="pip" style={{ background: "var(--team-blue)" }} />
          </div>
        </div>

        <div className="kicker rise d0">
          <svg
            className="spark"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" />
          </svg>
          Вечерние настолки онлайн
          <svg
            className="spark"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z" />
          </svg>
        </div>

        <h1 className="rise d1">
          Уютные настолки
          <br />
          <span className="script">
            на вечер с друзьями
            <svg
              className="underline"
              viewBox="0 0 200 16"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M3 11 C40 4, 80 4, 118 8 S170 13, 197 6"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="lead rise d2">
          Создай комнату по короткому коду, позови своих и играй прямо в
          браузере. Боты дополнят стол, таймеры не дадут затянуть, а сервер
          честно считает каждое слово и карту.
        </p>

        <div className="cta-row rise d3">
          <Link className="btn btn-pri" to="/codenames">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Создать комнату
          </Link>
          <a className="btn btn-sec" href="#rooms">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 14a4 4 0 0 1 0-8 4 4 0 0 1 0 8zM7 14v6M7 14h3" />
              <path d="M3 7h4M3 11h4M3 9.5h4M3 12.5h4" />
            </svg>
            Войти по коду
          </a>
        </div>

        <div className="hero-meta rise d4">
          <span>
            <b>Codenames</b>, <b>Uno</b> и <b>Alias</b> уже играются
          </span>
          <span className="dot" />
          <span>
            <b>больше игр</b> — в планах
          </span>
        </div>
      </section>

      <hr className="sec-rule rise d2" />

      {/* ============ ИГРЫ ============ */}
      <section id="games">
        <div className="sec-head">
          <h2 className="rise d2">
            Игры <span className="script">за столом</span>
          </h2>
          <p className="lead-r rise d2">
            Две уже живые, третья на подходе. Каждая — со своим настроением и
            правилами.
          </p>
        </div>

        <div className="tiles">
          {/* Codenames */}
          <Link className="tile rise d2" to="/codenames">
            <span className="status ok">Играбельно</span>
            <div className="art-wrap">
              <svg
                width="96"
                height="84"
                viewBox="0 0 96 84"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="6"
                  y="6"
                  width="84"
                  height="72"
                  rx="12"
                  fill="var(--felt)"
                  opacity=".18"
                />
                <g stroke="var(--border)" strokeWidth="2">
                  <rect
                    x="16"
                    y="14"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="38"
                    y="14"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="60"
                    y="14"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="16"
                    y="34"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="38"
                    y="34"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="60"
                    y="34"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="16"
                    y="54"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="38"
                    y="54"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                  <rect
                    x="60"
                    y="54"
                    width="20"
                    height="18"
                    rx="5"
                    fill="var(--card-face)"
                  />
                </g>
                <circle cx="26" cy="23" r="3.4" fill="var(--team-red)" />
                <circle cx="48" cy="23" r="3.4" fill="var(--team-blue)" />
                <circle cx="70" cy="43" r="3.4" fill="var(--team-red)" />
                <circle cx="26" cy="63" r="3.4" fill="var(--team-blue)" />
                <circle cx="70" cy="63" r="3.4" fill="var(--neutral)" />
              </svg>
            </div>
            <h3>Codenames</h3>
            <p className="desc">
              Две команды, поле из 25 слов и капитаны, что связывают их одной
              подсказкой. Угадывай своих, береги чужих, держись подальше от
              киллера.
            </p>
            <div className="tags">
              <span className="tag">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="8" r="3.4" />
                  <path d="M20 8.5a4 4 0 0 1 0 7" />
                </svg>
                2–10
              </span>
              <span className="tag">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
                15–30 мин
              </span>
            </div>
          </Link>

          {/* Uno */}
          <Link className="tile rise d3" to="/uno">
            <span className="status ok">Играбельно</span>
            <div className="art-wrap">
              <svg
                width="110"
                height="84"
                viewBox="0 0 110 84"
                fill="none"
                aria-hidden="true"
              >
                <g transform="rotate(-13 30 44)">
                  <rect
                    x="12"
                    y="14"
                    width="40"
                    height="60"
                    rx="8"
                    fill="var(--uno-blue)"
                    stroke="#ffffff33"
                    strokeWidth="2"
                  />
                  <ellipse
                    cx="32"
                    cy="44"
                    rx="15"
                    ry="19"
                    fill="var(--bg)"
                    transform="rotate(18 32 44)"
                  />
                  <text
                    x="32"
                    y="52"
                    textAnchor="middle"
                    fontFamily="Nunito"
                    fontWeight="900"
                    fontSize="20"
                    fill="var(--uno-blue)"
                    transform="rotate(-18 32 44)"
                  >
                    5
                  </text>
                </g>
                <g transform="rotate(8 60 44)">
                  <rect
                    x="42"
                    y="12"
                    width="40"
                    height="60"
                    rx="8"
                    fill="var(--uno-red)"
                    stroke="#ffffff33"
                    strokeWidth="2"
                  />
                  <ellipse
                    cx="62"
                    cy="42"
                    rx="15"
                    ry="19"
                    fill="var(--bg)"
                    transform="rotate(18 62 42)"
                  />
                  <text
                    x="62"
                    y="50"
                    textAnchor="middle"
                    fontFamily="Nunito"
                    fontWeight="900"
                    fontSize="20"
                    fill="var(--uno-red)"
                    transform="rotate(-18 62 42)"
                  >
                    7
                  </text>
                </g>
                <g transform="rotate(20 88 46)">
                  <rect
                    x="68"
                    y="16"
                    width="40"
                    height="60"
                    rx="8"
                    fill="var(--uno-yellow)"
                    stroke="#ffffff33"
                    strokeWidth="2"
                  />
                  <ellipse
                    cx="88"
                    cy="46"
                    rx="15"
                    ry="19"
                    fill="var(--card-ink)"
                    transform="rotate(18 88 46)"
                  />
                  <text
                    x="88"
                    y="54"
                    textAnchor="middle"
                    fontFamily="Nunito"
                    fontWeight="900"
                    fontSize="18"
                    fill="var(--uno-yellow)"
                    transform="rotate(-18 88 46)"
                  >
                    +2
                  </text>
                </g>
              </svg>
            </div>
            <h3>Uno</h3>
            <p className="desc">
              Классическая карточная гонка на 108 карт. Семь вариаций правил,
              кнопка «UNO!» со штрафом, стэкинг +2 и честный челлендж на +4.
            </p>
            <div className="tags">
              <span className="tag">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="8" r="3.4" />
                  <path d="M20 8.5a4 4 0 0 1 0 7" />
                </svg>
                2–10
              </span>
              <span className="tag">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
                10–20 мин
              </span>
            </div>
          </Link>

          {/* Alias — игра готова */}
          <Link
            className="tile rise d4"
            to="/alias"
            aria-label="Alias — играть"
          >
            <span className="status ok">Играбельно</span>
            <div className="art-wrap">
              <svg
                width="104"
                height="84"
                viewBox="0 0 104 84"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M14 16h76a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H52l-16 14v-14H14a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z"
                  fill="var(--surface-2)"
                  stroke="var(--accent)"
                  strokeWidth="2.4"
                />
                <text
                  x="52"
                  y="42"
                  textAnchor="middle"
                  fontFamily="Caveat"
                  fontWeight="700"
                  fontSize="26"
                  fill="var(--accent)"
                >
                  слово!
                </text>
                <g
                  transform="translate(82 60)"
                  stroke="var(--muted)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                >
                  <circle cx="8" cy="9" r="7.5" />
                  <path d="M8 5v4l2.6 2.2" />
                  <path d="M8 1.5v-1M15.5 9h1M8 16.5v1M.5 9h-1" />
                </g>
              </svg>
            </div>
            <h3>Alias</h3>
            <p className="desc">
              Объясняй слова своей команде на время, не называя самого слова и
              его корня. Словари по сложности, раунды на скорость.
            </p>
            <div className="tags">
              <span className="tag">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="8" r="3.4" />
                  <path d="M20 8.5a4 4 0 0 1 0 7" />
                </svg>
                2+ команды
              </span>
              <span className="tag">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
                30–60 мин
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ============ КАК УСТРОЕНО — bento ============ */}
      <section id="how">
        <div className="sec-head">
          <h2 className="rise d3">
            Как это <span className="script">устроено</span>
          </h2>
          <p className="lead-r rise d3">
            Без установки, без регистраций для гостей. Заходишь по коду — и за
            стол.
          </p>
        </div>
        <div className="how">
          <div className="how-card rise d3">
            <span className="num">раз</span>
            <h4>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 21V5a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2z" />
                <path d="M15 3v5h5M8 12h8M8 16h6" />
              </svg>
              Комната по коду
            </h4>
            <p>
              Создал комнату — получил короткий код. Пошли его друзьям, они
              заходят без аккаунта. Один код — один стол, без установки и
              регистрации для гостей.
            </p>
          </div>
          <div className="how-card rise d3">
            <span className="num">два</span>
            <h4>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="5" y="7" width="14" height="12" rx="3" />
                <path d="M9 7V5.5a3 3 0 0 1 6 0V7M9 13a3 3 0 0 0 6 0" />
              </svg>
              Боты за столом
            </h4>
            <p>
              Не хватает людей — добавь ботов. Они ходят, отгадывают и честно
              доигрывают партию до конца.
            </p>
          </div>
          <div className="how-card rise d4">
            <span className="num">три</span>
            <h4>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="13" r="8" />
                <path d="M12 8v5l3.2 2M9 2h6M12 5V2" />
              </svg>
              Таймеры хода
            </h4>
            <p>
              У каждого хода свой лимит. Никто не зависнет вечно — партия
              двигается ровно.
            </p>
          </div>
          <div className="how-card rise d4">
            <span className="num">четыре</span>
            <h4>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3c-2 4-2 6 0 9 2-3 2-5 0-9z" />
                <path d="M5 11c2 1 4 1 5 3-2 3-5 3-7 0-1-2 0-3 2-3z" />
                <path d="M19 11c-2 1-4 1-5 3 2 3 5 3 7 0 1-2 0-3-2-3z" />
                <path d="M9 20c1-1.5 2-2 3-2s2 .5 3 2" />
              </svg>
              Бот-капитан
            </h4>
            <p>
              В Codenames капитан-бот подбирает подсказки по смыслу слов через
              эмбеддинги — ход мысли настоящий, не случайный. Связывает слова в
              осмысленные группы и считает риск.
            </p>
          </div>
        </div>
      </section>

      {/* ============ ОТКРЫТЫЕ СТОЛЫ ============ */}
      <section id="rooms">
        <div className="sec-head">
          <h2 className="rise d4">
            Открытые <span className="script">столы</span>
          </h2>
          <p className="lead-r rise d4">
            Зайди в чужую комнату или подними свою — кодом или ссылкой.
          </p>
        </div>
        <div className="rooms">
          <div className="room rise d4">
            <div className="room-top">
              <div className="room-badge cn">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 33 33"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <rect x="2" y="2" width="29" height="29" rx="5" />
                  <circle
                    cx="9"
                    cy="9"
                    r="2.4"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="24"
                    cy="9"
                    r="2.4"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="2.4"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="9"
                    cy="24"
                    r="2.4"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </div>
              <div>
                <h4>Вечерний штаб</h4>
                <div className="who">Codenames · ждут капитана синих</div>
              </div>
            </div>
            <div className="room-foot">
              <div className="avatars">
                <span className="av" style={{ background: "var(--av-1)" }}>
                  М
                </span>
                <span className="av" style={{ background: "var(--av-3)" }}>
                  С
                </span>
                <span className="av" style={{ background: "var(--av-2)" }}>
                  К
                </span>
                <span className="av" style={{ background: "var(--av-4)" }}>
                  Л
                </span>
              </div>
              <span className="room-meta">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="8" r="3.2" />
                </svg>
                4/8
              </span>
            </div>
            <Link className="join" to="/codenames">
              Присоединиться
            </Link>
          </div>

          <div className="room rise d4">
            <div className="room-top">
              <div className="room-badge un">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="6" width="18" height="13" rx="2.5" />
                  <path d="M3 10h18" />
                </svg>
              </div>
              <div>
                <h4>Без правил</h4>
                <div className="who">Uno · стэкинг +2 включён</div>
              </div>
            </div>
            <div className="room-foot">
              <div className="avatars">
                <span className="av" style={{ background: "var(--av-5)" }}>
                  А
                </span>
                <span className="av" style={{ background: "var(--av-6)" }}>
                  Д
                </span>
                <span className="av" style={{ background: "var(--av-3)" }}>
                  Н
                </span>
              </div>
              <span className="room-meta">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="8" r="3.2" />
                </svg>
                3/8
              </span>
            </div>
            <Link className="join" to="/uno">
              Присоединиться
            </Link>
          </div>

          <a className="room-create rise d4" href="#games">
            <span className="plus">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <b>Поднять свой стол</b>
            <span>Выбери игру, задай правила и позови друзей</span>
          </a>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer id="about" className="rise d4">
        <h2 className="visually-hidden">О проекте</h2>
        <Link className="logo" to="/" aria-label="Настолки">
          <svg
            className="mark"
            viewBox="0 0 33 33"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ width: "28px", height: "28px" }}
          >
            <rect x="1" y="1" width="31" height="31" rx="6" />
            <circle
              cx="8.25"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="8.25"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="24.75"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="8.25"
              cy="24.75"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="16.5"
              cy="16.5"
              r="2.6"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <b>Настолки</b>
        </Link>
        <p>
          Уютный уголок для вечерних игр с друзьями — где бы вы ни были.
          Self-hosted, без установки, с ботами и честным счётом.
        </p>
        <div className="sig">сделано с уютом</div>
        <div className="flinks">
          <a href="#about">О проекте</a>
          <a href="#games">Игры</a>
          <a href="#rooms">Столы</a>
        </div>
      </footer>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {authOpen && <AuthModal api={auth} onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
