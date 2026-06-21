-- Добавляем значение 'imaginarium' в enum Game (Imaginarium — новая игра).
-- ALTER TYPE ... ADD VALUE несовместим с транзакционным блоком, поэтому
-- миграция содержит один оператор (Prisma корректно выполняет ADD VALUE
-- без оборачивания в транзакцию).
ALTER TYPE "Game" ADD VALUE 'imaginarium';
