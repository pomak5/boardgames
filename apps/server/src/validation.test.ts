import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  aliasSettingsPatchSchema,
  cardIndexSchema,
  chatTextSchema,
  clueSchema,
  codenamesSettingsSchema,
  parseSocketArg,
  setCaptainArgsSchema,
  setTeamArgsSchema,
  unoActionSchema,
  unoSettingsPatchSchema,
} from './validation';

/** Минимальный mock socket: собирает emit-вызовы. */
function mockSocket() {
  const emits: Array<[string, unknown]> = [];
  return {
    emits,
    socket: { emit: (event: string, message: unknown) => emits.push([event, message]) } as never,
  };
}

describe('chatTextSchema', () => {
  test('пропускает строку (длину обрезает менеджер)', () => {
    expect(chatTextSchema.safeParse('привет').success).toBe(true);
    expect(chatTextSchema.safeParse('').success).toBe(true); // пустую пропускаем — addChat trim'ит
  });
  test('отторгает не-строку', () => {
    expect(chatTextSchema.safeParse(123).success).toBe(false);
    expect(chatTextSchema.safeParse({ x: 1 }).success).toBe(false);
    expect(chatTextSchema.safeParse(null).success).toBe(false);
  });
});

describe('parseSocketArg', () => {
  test('валидный аргумент — отдаёт значение, без game:error', () => {
    const { socket, emits } = mockSocket();
    const out = parseSocketArg(socket, chatTextSchema, 'сообщение');
    expect(out).toBe('сообщение');
    expect(emits).toEqual([]);
  });

  test('невалидный аргумент — шлёт game:error и возвращает null', () => {
    const { socket, emits } = mockSocket();
    const out = parseSocketArg(socket, chatTextSchema, 123);
    expect(out).toBeNull();
    expect(emits).toEqual([['game:error', 'Некорректные данные']]);
  });

  test('кастомное сообщение об ошибке', () => {
    const { socket, emits } = mockSocket();
    const out = parseSocketArg(socket, z.string().min(1), '', 'Пусто');
    expect(out).toBeNull();
    expect(emits[0]).toEqual(['game:error', 'Пусто']);
  });
});

describe('codenamesSettingsSchema', () => {
  const valid = {
    game: 'codenames',
    botCaptains: { red: true, blue: false },
    botRisk: 'normal',
  };
  test('пропускает валидные (без таймера)', () => {
    expect(codenamesSettingsSchema.safeParse(valid).success).toBe(true);
  });
  test('пропускает с таймером', () => {
    expect(
      codenamesSettingsSchema.safeParse({ ...valid, timer: { enabled: true, turnSec: 60 } })
        .success,
    ).toBe(true);
  });
  test('отторгает чужой game', () => {
    expect(codenamesSettingsSchema.safeParse({ ...valid, game: 'uno' }).success).toBe(false);
  });
  test('отторгает не-boolean в botCaptains', () => {
    expect(
      codenamesSettingsSchema.safeParse({
        ...valid,
        botCaptains: { red: 'yes', blue: false },
      }).success,
    ).toBe(false);
  });
  test('отторгает чужой botRisk', () => {
    expect(codenamesSettingsSchema.safeParse({ ...valid, botRisk: 'crazy' }).success).toBe(false);
  });
});

describe('clueSchema / cardIndexSchema', () => {
  test('clue: валидный', () => {
    expect(clueSchema.safeParse({ word: 'кот', count: 2 }).success).toBe(true);
  });
  test('clue: count строкой → отторгает', () => {
    expect(clueSchema.safeParse({ word: 'кот', count: '2' }).success).toBe(false);
  });
  test('clue: без count → отторгает', () => {
    expect(clueSchema.safeParse({ word: 'кот' }).success).toBe(false);
  });
  test('cardIndex: целое ≥0 — ок', () => {
    expect(cardIndexSchema.safeParse(0).success).toBe(true);
    expect(cardIndexSchema.safeParse(24).success).toBe(true);
  });
  test('cardIndex: отрицательное / не-целое / строка → отторгает', () => {
    expect(cardIndexSchema.safeParse(-1).success).toBe(false);
    expect(cardIndexSchema.safeParse(1.5).success).toBe(false);
    expect(cardIndexSchema.safeParse('5').success).toBe(false);
  });
});

describe('setTeamArgsSchema / setCaptainArgsSchema', () => {
  test('setTeam валидный', () => {
    expect(setTeamArgsSchema.safeParse(['red', 'captain']).success).toBe(true);
    expect(setTeamArgsSchema.safeParse(['blue', 'guesser']).success).toBe(true);
  });
  test('setTeam чужая роль', () => {
    expect(setTeamArgsSchema.safeParse(['red', 'spy']).success).toBe(false);
  });
  test('setCaptain валидный', () => {
    expect(setCaptainArgsSchema.safeParse(['blue', 'bot']).success).toBe(true);
  });
  test('setCaptain чужой who', () => {
    expect(setCaptainArgsSchema.safeParse(['blue', 'anyone']).success).toBe(false);
  });
});

describe('unoSettingsPatchSchema', () => {
  test('пустой патч — ок', () => {
    expect(unoSettingsPatchSchema.safeParse({}).success).toBe(true);
  });
  test('патч rules — ок', () => {
    expect(unoSettingsPatchSchema.safeParse({ rules: { jumpIn: true } }).success).toBe(true);
  });
  test('rules с не-boolean — отторгает', () => {
    expect(unoSettingsPatchSchema.safeParse({ rules: { jumpIn: 'yes' } }).success).toBe(false);
  });
  test('maxPlayers строкой — отторгает', () => {
    expect(unoSettingsPatchSchema.safeParse({ maxPlayers: '4' }).success).toBe(false);
  });
  test('targetScore null в rules — ок (number | null)', () => {
    expect(unoSettingsPatchSchema.safeParse({ rules: { targetScore: null } }).success).toBe(true);
  });
});

describe('unoActionSchema', () => {
  test('play валидный', () => {
    expect(unoActionSchema.safeParse({ type: 'play', cardId: 5, declareUno: true }).success).toBe(
      true,
    );
  });
  test('play без declareUno — ок (optional)', () => {
    expect(unoActionSchema.safeParse({ type: 'play', cardId: 5 }).success).toBe(true);
  });
  test('play без cardId — отторгает', () => {
    expect(unoActionSchema.safeParse({ type: 'play', declareUno: true }).success).toBe(false);
  });
  test('chooseColor валидный', () => {
    expect(unoActionSchema.safeParse({ type: 'chooseColor', color: 'green' }).success).toBe(true);
  });
  test('chooseColor чужой цвет — отторгает', () => {
    expect(unoActionSchema.safeParse({ type: 'chooseColor', color: 'purple' }).success).toBe(false);
  });
  test('чужой type — отторгает', () => {
    expect(unoActionSchema.safeParse({ type: 'fly', cardId: 5 }).success).toBe(false);
  });
  test('cardId строкой — отторгает', () => {
    expect(unoActionSchema.safeParse({ type: 'play', cardId: '5' }).success).toBe(false);
  });
});

describe('aliasSettingsPatchSchema', () => {
  test('пустой патч — ок', () => {
    expect(aliasSettingsPatchSchema.safeParse({}).success).toBe(true);
  });
  test('валидный', () => {
    expect(
      aliasSettingsPatchSchema.safeParse({ difficulty: 'hard', targetScore: 30 }).success,
    ).toBe(true);
  });
  test('чужая difficulty — отторгает', () => {
    expect(aliasSettingsPatchSchema.safeParse({ difficulty: 'insane' }).success).toBe(false);
  });
  test('roundDuration строкой — отторгает', () => {
    expect(aliasSettingsPatchSchema.safeParse({ roundDuration: '60' }).success).toBe(false);
  });
});
