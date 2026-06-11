import type { SVGProps } from "react";

/**
 * Свои SVG-иконки по дизайн-системе из design/final.html.
 * Никаких эмодзи в интерфейсе — только эти иконки (см. правило в design/).
 */

type P = SVGProps<SVGSVGElement>;

function base(props: P): P {
  return {
    ...props,
    className: `pi ${props.className ?? ""}`.trim(),
  };
}

/** Кубик — логотип «Настолки». */
export function IconDice(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 48 48"
      {...base(props)}
    >
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="9"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="3.5"
      />
      <circle cx="17" cy="17" r="3.4" fill="var(--accent)" />
      <circle cx="31" cy="17" r="3.4" fill="var(--accent)" />
      <circle cx="24" cy="24" r="3.4" fill="var(--accent)" />
      <circle cx="17" cy="31" r="3.4" fill="var(--accent)" />
      <circle cx="31" cy="31" r="3.4" fill="var(--accent)" />
    </svg>
  );
}

/** Шестерёнка — настройки. */
export function IconGear(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      {...base(props)}
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </svg>
  );
}

/** Домик — на главную. */
export function IconHome(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...base(props)}
    >
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10v9.5h11V10" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

/** Крестик — закрыть. */
export function IconClose(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      {...base(props)}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Робот — бот (из дизайн-системы). */
export function IconBot(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 34 34"
      {...base(props)}
    >
      <rect x="7" y="10" width="20" height="16" rx="5" fill="#7d8a99" />
      <rect x="10" y="13" width="14" height="10" rx="3" fill="#2b3440" />
      <circle cx="14" cy="18" r="1.8" fill="#7be0a0" />
      <circle cx="20" cy="18" r="1.8" fill="#7be0a0" />
      <line
        x1="17"
        y1="10"
        x2="17"
        y2="5.5"
        stroke="#7d8a99"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="17" cy="4.5" r="2" fill="#d94a32" />
      <rect x="4" y="15" width="3" height="7" rx="1.5" fill="#7d8a99" />
      <rect x="27" y="15" width="3" height="7" rx="1.5" fill="#7d8a99" />
    </svg>
  );
}

/** Ключ — капитан / ключ-карта. */
export function IconKey(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...base(props)}
    >
      <circle cx="8" cy="14.5" r="4" />
      <path d="M11 11.5 20 3M16 7l3 3M13.5 9.5l2.5 2.5" />
    </svg>
  );
}

/** Реплика — чат. */
export function IconChat(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...base(props)}
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

/** Бумажный самолётик — отправить. */
export function IconSend(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...base(props)}
    >
      <path d="M3.4 20.6 22 12 3.4 3.4 3.4 10l13 2-13 2Z" />
    </svg>
  );
}

/** Шеврон вниз/вбок — свернуть/развернуть. */
export function IconChevron({
  collapsed,
  ...props
}: P & { collapsed?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: collapsed ? "rotate(-90deg)" : undefined,
        transition: "transform .15s ease",
        ...props.style,
      }}
      {...base(props)}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Стрелка вправо — «играть». */
export function IconArrowRight(props: P) {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...base(props)}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
