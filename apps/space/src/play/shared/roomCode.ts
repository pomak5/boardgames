/** Генерация кода комнаты вида KX4-92F (без похожих символов 0/O, 1/I). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(random: () => number = Math.random): string {
  const pick = () => ALPHABET[Math.floor(random() * ALPHABET.length)] as string;
  const part = (n: number) => Array.from({ length: n }, pick).join("");
  return `${part(3)}-${part(3)}`;
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{3}-[${ALPHABET}]{3}$`).test(code);
}
