import "./avatar.css";

interface AvatarProps {
  nickname: string;
  avatarUrl?: string | null;
  size?: number;
  /** Доп. класс для обёртки (например, для рамки). */
  className?: string;
}

function initials(nickname: string): string {
  const parts = nickname.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/** Детерминированный тёплый цвет фона по нику (когда нет загруженного аватара). */
function hueFor(nickname: string): number {
  let h = 0;
  for (let i = 0; i < nickname.length; i++) {
    h = (h * 31 + nickname.charCodeAt(i)) % 360;
  }
  return h;
}

/** Аватар игрока: загруженная картинка либо инициалы на цветном фоне. */
export function Avatar({
  nickname,
  avatarUrl,
  size = 40,
  className,
}: AvatarProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
  };
  if (avatarUrl) {
    return (
      <span
        className={`bn-avatar${className ? ` ${className}` : ""}`}
        style={style}
      >
        <img src={avatarUrl} alt={nickname} className="bn-avatar__img" />
      </span>
    );
  }
  const hue = hueFor(nickname);
  return (
    <span
      className={`bn-avatar bn-avatar--initials${className ? ` ${className}` : ""}`}
      style={{
        ...style,
        background: `linear-gradient(135deg, hsl(${hue} 55% 58%), hsl(${(hue + 40) % 360} 55% 48%))`,
      }}
      aria-label={nickname}
    >
      {initials(nickname)}
    </span>
  );
}
