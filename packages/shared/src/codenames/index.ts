export * from './types';
export * from './engine';
export * from './dictionary';
export * from './view';
// bot (+ embeddings 1.2 МБ) и coop (тянет bot) вынесены из barrel — иначе любой
// web-импорт @shared тащит embeddings в бандл. Сервер импортит suggestClue напрямую:
//   import { suggestClue } from '@boardgames/shared/codenames/bot';
// (см. packages/shared/package.json exports).
