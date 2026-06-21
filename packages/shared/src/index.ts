export * from './roomCode';
export * from './events';
export * from './codenames';
export * from './uno';
export * from './alias';
export * from './imaginarium';
// У alias и imaginarium обе есть функция finishGame с разными сигнатурами.
// alias.finishGame уже используется менеджером через бочку — оставляем её
// каноническим экспортом имени finishGame. imaginarium.finishGame доступен
// через глубокий импорт: `import { finishGame } from '@shared/imaginarium/engine'`.
export { finishGame } from './alias';
