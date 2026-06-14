import { useState } from "react";
import { Link } from "react-router-dom";
import { SettingsModal } from "../SettingsModal";
import "./home.css";
import { useAuth } from "../net/useAuth";
import { AuthModal } from "../AuthModal";

export function HomeHub() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const auth = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const handleEmptyClick = (e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLAnchorElement | HTMLButtonElement;
    if (target instanceof HTMLAnchorElement && target.getAttribute("href") === "#") {
      e.preventDefault();
    }
  };

  return (
    <div className="bn-landing">
      <header>
        <div className="container">
          <div className="header-inner">
            <Link to="/" className="logo">
              <div className="logo-icon">
                <svg width="33" height="33" viewBox="0 0 33 33" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Логотип">
                  <rect x="1" y="1" width="31" height="31" rx="4" />
                  <circle cx="8.25" cy="8.25" r="2.97" fill="currentColor" stroke="none" />
                  <circle cx="24.75" cy="8.25" r="2.97" fill="currentColor" stroke="none" />
                  <circle cx="24.75" cy="24.75" r="2.97" fill="currentColor" stroke="none" />
                  <circle cx="8.25" cy="24.75" r="2.97" fill="currentColor" stroke="none" />
                  <circle cx="16.5" cy="16.5" r="2.97" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <span className="logo-text">Настолки</span>
            </Link>
            <nav>
              <button type="button" className="nav-link" onClick={handleEmptyClick}>Игры</button>
              <button type="button" className="nav-link" onClick={handleEmptyClick}>Комнаты</button>
              <button type="button" className="nav-link" onClick={handleEmptyClick}>Друзья</button>
            </nav>
            <div className="header-spacer" />
            <div className="header-actions">
              <button type="button" className="settings-toggle" aria-label="Настройки" onClick={() => setSettingsOpen(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <div
                className="profile-pill"
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
                aria-label={auth.user ? auth.user.nickname : "Войти"}
                title={auth.user ? auth.user.nickname : "Войти"}
                onClick={() => setAuthOpen(true)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && setAuthOpen(true)
                }
              >
                <div className="user-avatar" aria-hidden="true">
                  {auth.user ? auth.user.nickname.charAt(0).toUpperCase() : ""}
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <div className="container">
          <section className="hero">
            <div className="hero-card">
              <div className="hero-content">
                <h1>
                  Играй в
                  <br />
                  настолки онлайн
                </h1>
                <p>
                  Создавай комнаты, зови друзей
                  <br />
                  и играй без установки.
                </p>
                <div className="hero-buttons">
                  <Link to="/codenames" className="btn btn-primary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Создать комнату
                  </Link>
                  <a href="#games" className="btn btn-secondary">
                    <svg width="20" height="20" viewBox="0 0 33 33" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="1" y="1" width="31" height="31" rx="4" />
                      <circle cx="8.25" cy="8.25" r="2.97" fill="currentColor" stroke="none" />
                      <circle cx="24.75" cy="8.25" r="2.97" fill="currentColor" stroke="none" />
                      <circle cx="24.75" cy="24.75" r="2.97" fill="currentColor" stroke="none" />
                      <circle cx="8.25" cy="24.75" r="2.97" fill="currentColor" stroke="none" />
                      <circle cx="16.5" cy="16.5" r="2.97" fill="currentColor" stroke="none" />
                    </svg>
                    Выбрать игру
                  </a>
                </div>
              </div>
              <div className="active-room">
                <div className="active-room-header">
                  <span className="active-room-title">Активная комната</span>
                  <span className="status">
                    <span className="status-dot" />
                    В игре
                  </span>
                </div>
                <div className="room-info">
                  <div className="room-thumb" style={{ backgroundImage: "url('/game-thumb.jpg')" }} />
                  <div className="room-meta">
                    <div className="room-meta-main">
                      <h4>Коднеймс</h4>
                      <p>Комната: Секретный штаб</p>
                      <div className="room-avatars">
                        <div className="room-avatar">М</div>
                        <div className="room-avatar" style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>К</div>
                        <div className="room-avatar" style={{ background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>С</div>
                        <div className="room-avatar" style={{ background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }}>Л</div>
                        <div className="room-avatar more">+2</div>
                      </div>
                    </div>
                    <div className="room-stats">
                      <span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        6 / 10 игроков
                      </span>
                      <span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        12:45
                      </span>
                    </div>
                  </div>
                </div>
                <Link to="/codenames" className="btn btn-room">
                  Перейти в комнату
                </Link>
              </div>
            </div>
          </section>

          <div className="content-section">
          <section id="games" className="popular-games">
            <div className="section-header">
              <h2 className="section-title">Популярные игры</h2>
              <a href="#" onClick={handleEmptyClick} className="link-arrow">
                Смотреть все игры
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="2 3 6 7 10 3" />
                </svg>
              </a>
            </div>
            <div className="games-grid">
              <div className="game-card">
                <div className="game-card-inner">
                  <div
                    className="game-thumb"
                    style={{ background: "linear-gradient(135deg, #A65E2E 0%, #5D3A24 100%)", position: "relative" }}
                  >
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{ position: "absolute", left: "-2px", bottom: "-4px" }}>
                      <circle cx="22" cy="18" r="8" fill="#2C1810" />
                      <path d="M12 32 C12 25 17 20 22 20 C27 20 32 25 32 32 L32 54 L12 54 Z" fill="#2C1810" />
                      <ellipse cx="22" cy="12" rx="10" ry="6" fill="#2C1810" />
                      <rect x="12" y="28" width="20" height="3" fill="#D4A373" />
                    </svg>
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{ position: "absolute", right: "-6px", bottom: "-4px" }}>
                      <circle cx="26" cy="18" r="8" fill="#1A100C" />
                      <path d="M16 32 C16 25 21 20 26 20 C31 20 36 25 36 32 L36 54 L16 54 Z" fill="#1A100C" />
                      <ellipse cx="26" cy="12" rx="10" ry="6" fill="#1A100C" />
                      <rect x="16" y="28" width="20" height="3" fill="#D4A373" />
                    </svg>
                  </div>
                  <div className="game-info">
                    <h3>Коднеймс</h3>
                    <p>Две команды агентов, одно поле с кодовыми словами.</p>
                    <div className="game-tags">
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        2 – 10 игроков
                      </span>
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        15–30 мин
                      </span>
                    </div>
                  </div>
                </div>
                <Link to="/codenames" className="btn btn-game">Играть</Link>
              </div>

              <div className="game-card">
                <div className="game-card-inner">
                  <div
                    className="game-thumb"
                    style={{ background: "#F5EDE4", position: "relative" }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: "42px",
                        height: "58px",
                        background: "#D94E41",
                        borderRadius: "8px",
                        left: "6px",
                        top: "14px",
                        transform: "rotate(-12deg)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        border: "2px solid rgba(255,255,255,0.3)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        width: "42px",
                        height: "58px",
                        background: "#3B8D99",
                        borderRadius: "8px",
                        left: "18px",
                        top: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        border: "2px solid rgba(255,255,255,0.3)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        width: "42px",
                        height: "58px",
                        background: "#E6B84A",
                        borderRadius: "8px",
                        left: "30px",
                        top: "10px",
                        transform: "rotate(12deg)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        border: "2px solid rgba(255,255,255,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: "12px",
                        color: "#2C1810",
                        letterSpacing: "-0.5px",
                      }}
                    >
                      UNO
                    </div>
                  </div>
                  <div className="game-info">
                    <h3>УНО</h3>
                    <p>Классическая карточная игра для весёлой компании.</p>
                    <div className="game-tags">
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        2 – 10 игроков
                      </span>
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        10–20 мин
                      </span>
                    </div>
                  </div>
                </div>
                <Link to="/uno" className="btn btn-game">Играть</Link>
              </div>

              <div className="game-card">
                <div className="game-card-inner">
                  <div
                    className="game-thumb"
                    style={{ background: "#F5EDE4", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
                      <path d="M15 35 C15 20 28 12 35 12 C42 12 55 20 55 35 C55 45 48 52 40 55 L32 62 L34 55 C24 52 15 45 15 35Z" fill="#E8D5C4" stroke="#C4A884" strokeWidth="2.5" />
                      <text x="35" y="38" textAnchor="middle" fontFamily="'Nunito', sans-serif" fontWeight="700" fontSize="13" fill="#A67B5B">Alias</text>
                    </svg>
                  </div>
                  <div className="game-info">
                    <h3>Alias</h3>
                    <p>Объясняй слова своей команде на время.</p>
                    <div className="game-tags">
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        2 + команды
                      </span>
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        30–60 мин
                      </span>
                    </div>
                  </div>
                </div>
                <a href="#" onClick={handleEmptyClick} className="btn btn-game">Играть</a>
              </div>

              <div className="game-card">
                <div className="game-card-inner">
                  <div
                    className="game-thumb"
                    style={{ background: "#F5EDE4", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
                      <path d="M34 6 C30 6 28 10 28 14 L26 50 L34 56 L42 50 L40 14 C40 10 38 6 34 6Z" fill="#2C1810" />
                      <circle cx="34" cy="12" r="6" fill="#2C1810" />
                      <path d="M48 10 C44 10 42 14 42 18 L40 46 L48 52 L56 46 L54 18 C54 14 52 10 48 10Z" fill="#D4A373" />
                      <circle cx="48" cy="16" r="5" fill="#D4A373" />
                      <path d="M20 12 C16 12 14 16 14 20 L12 46 L20 52 L28 46 L26 20 C26 16 24 12 20 12Z" fill="#A67B5B" />
                      <circle cx="20" cy="18" r="4.5" fill="#A67B5B" />
                    </svg>
                  </div>
                  <div className="game-info">
                    <h3>Шахматы</h3>
                    <p>Классика, которая всегда актуальна.</p>
                    <div className="game-tags">
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        2 игрока
                      </span>
                      <span className="tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        10–60 мин
                      </span>
                    </div>
                  </div>
                </div>
                <a href="#" onClick={handleEmptyClick} className="btn btn-game">Играть</a>
              </div>
            </div>
        </section>

          <section className="bottom-section">
            <div className="bottom-grid">
              <div className="bottom-card">
                <div className="bottom-card-header">
                  <h3 className="bottom-card-title">Сейчас играют</h3>
                  <a href="#" onClick={handleEmptyClick} className="link-arrow">
                    Все комнаты
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="2 3 6 7 10 3" />
                    </svg>
                  </a>
                </div>
                <div className="room-list">
                  <div className="room-list-item">
                    <div className="room-list-icon" style={{ background: "#5D4037" }}>К</div>
                    <div className="room-list-meta">
                      <h4>Коднеймс — Вечерний штаб</h4>
                      <div className="room-list-stats">
                        <span>
                          <div style={{ display: "flex", marginRight: "4px" }}>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", marginLeft: "0" }}>М</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>К</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>С</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }}>Л</div>
                          </div>
                          8 / 10
                        </span>
                        <span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          10:32
                        </span>
                      </div>
                    </div>
                    <button type="button" className="btn-join" onClick={handleEmptyClick}>Присоединиться</button>
                  </div>
                  <div className="room-list-item">
                    <div className="room-list-icon" style={{ background: "#D94E41" }}>У</div>
                    <div className="room-list-meta">
                      <h4>УНО — Без правил</h4>
                      <div className="room-list-stats">
                        <span>
                          <div style={{ display: "flex", marginRight: "4px" }}>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", marginLeft: "0", background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}>А</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>Д</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }}>Н</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" }}>Е</div>
                          </div>
                          5 / 8
                        </span>
                        <span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          06:15
                        </span>
                      </div>
                    </div>
                    <button type="button" className="btn-join" onClick={handleEmptyClick}>Присоединиться</button>
                  </div>
                  <div className="room-list-item">
                    <div className="room-list-icon" style={{ background: "#A67B5B" }}>A</div>
                    <div className="room-list-meta">
                      <h4>Alias — На скорость</h4>
                      <div className="room-list-stats">
                        <span>
                          <div style={{ display: "flex", marginRight: "4px" }}>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", marginLeft: "0", background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}>О</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>И</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>Р</div>
                            <div className="room-avatar" style={{ width: "18px", height: "18px", fontSize: "8px", background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }}>В</div>
                          </div>
                          6 / 12
                        </span>
                        <span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          15:40
                        </span>
                      </div>
                    </div>
                    <button type="button" className="btn-join" onClick={handleEmptyClick}>Присоединиться</button>
                  </div>
                </div>
              </div>

              <div className="bottom-card">
                <div className="bottom-card-header">
                  <h3 className="bottom-card-title">Друзья онлайн</h3>
                  <a href="#" onClick={handleEmptyClick} className="link-arrow">
                    Все друзья
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="2 3 6 7 10 3" />
                    </svg>
                  </a>
                </div>
                <div className="friend-list">
                  <div className="friend-item">
                    <div className="friend-left">
                      <div className="friend-avatar">М</div>
                      <span className="friend-name">Маша</span>
                    </div>
                    <span className="friend-state online">В игре</span>
                  </div>
                  <div className="friend-item">
                    <div className="friend-left">
                      <div className="friend-avatar">С</div>
                      <span className="friend-name">Сергей</span>
                    </div>
                    <span className="friend-state online">В игре</span>
                  </div>
                  <div className="friend-item">
                    <div className="friend-left">
                      <div className="friend-avatar">И</div>
                      <span className="friend-name">Илья</span>
                    </div>
                    <span className="friend-state inroom">В комнате</span>
                  </div>
                  <div className="friend-item">
                    <div className="friend-left">
                      <div className="friend-avatar">К</div>
                      <span className="friend-name">Катя</span>
                    </div>
                    <span className="friend-state online">Онлайн</span>
                  </div>
                  <div className="friend-item">
                    <div className="friend-left">
                      <div className="friend-avatar">Д</div>
                      <span className="friend-name">Дима</span>
                    </div>
                    <span className="friend-state offline">Отошёл</span>
                  </div>
                </div>
              </div>

              <div className="bottom-card">
                <div className="bottom-card-header">
                  <h3 className="bottom-card-title">Быстрый старт</h3>
                </div>
                <div className="quick-list">
                  <div className="quick-item" onClick={handleEmptyClick} role="button" tabIndex={0}>
                    <div className="quick-icon" style={{ background: "#FFF0E3" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </div>
                    <div className="quick-text">
                      <strong>Создать комнату</strong>
                      <span>Создайте комнату и пригласите друзей</span>
                    </div>
                    <div className="quick-arrow">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="quick-item" onClick={handleEmptyClick} role="button" tabIndex={0}>
                    <div className="quick-icon" style={{ background: "#DBF0EB" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="9" x2="20" y2="9" />
                        <line x1="4" y1="15" x2="20" y2="15" />
                        <line x1="10" y1="3" x2="8" y2="21" />
                        <line x1="16" y1="3" x2="14" y2="21" />
                      </svg>
                    </div>
                    <div className="quick-text">
                      <strong>Присоединиться по коду</strong>
                      <span>Введите код комнаты и присоединитесь</span>
                    </div>
                    <div className="quick-arrow">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="quick-item" onClick={handleEmptyClick} role="button" tabIndex={0}>
                    <div className="quick-icon" style={{ background: "#D89636", color: "white" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    </div>
                    <div className="quick-text">
                      <strong>Случайная игра</strong>
                      <span>Мы найдём игру и соперников для вас</span>
                    </div>
                    <div className="quick-arrow">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {authOpen && <AuthModal api={auth} onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
