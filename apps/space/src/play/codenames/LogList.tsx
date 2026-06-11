import type { LogEntry, Team } from "../shared";

const TEAM_RU: Record<Team, string> = { red: "Красные", blue: "Синие" };

export function TeamName({
  team,
  names,
}: {
  team: Team;
  names?: Partial<Record<Team, string>>;
}) {
  return (
    <span className={team === "red" ? "t-red" : "t-blue"}>
      {names?.[team] ?? TEAM_RU[team]}
    </span>
  );
}

function LogLine({
  entry,
  names,
}: {
  entry: LogEntry;
  names?: Partial<Record<Team, string>>;
}) {
  switch (entry.type) {
    case "clue":
      return (
        <li>
          <TeamName team={entry.team} names={names} />: подсказка «
          {entry.clue.word}, {entry.clue.count}»
        </li>
      );
    case "guess":
      return (
        <li>
          <TeamName team={entry.team} names={names} />: открыли{" "}
          {entry.owner === "assassin"
            ? "убийцу"
            : entry.owner === "neutral"
              ? "нейтральное слово"
              : entry.owner === entry.team
                ? "своё слово ✓"
                : "чужое слово ✗"}
        </li>
      );
    case "pass":
      return (
        <li>
          <TeamName team={entry.team} names={names} />: стоп, ход переходит
        </li>
      );
    case "gameover":
      return (
        <li>
          Победа: <TeamName team={entry.winner} names={names} />{" "}
          {entry.reason === "assassin"
            ? "(открыт убийца)"
            : "(все слова открыты)"}
        </li>
      );
  }
}

export function LogList({
  log,
  names,
}: {
  log: readonly LogEntry[];
  names?: Partial<Record<Team, string>>;
}) {
  return (
    <ul className="cn-log" aria-label="Лог ходов">
      {[...log].reverse().map((entry, i) => (
        <LogLine key={log.length - i} entry={entry} names={names} />
      ))}
    </ul>
  );
}
