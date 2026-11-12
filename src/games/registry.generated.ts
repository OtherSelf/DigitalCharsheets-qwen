/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Реестр плагинов, сгенерированный из манифестов `src/games/<id>/plugin.json`
 * (D1: плагины — build-time; новый плагин = папка + манифест + пересборка).
 *
 * Пересобрать:  npm run plugins:generate
 * Проверить:    npm run plugins:check   (шаг `npm run verify`)
 */
import { dh1Module } from './dh1';
import dh1Manifest from './dh1/plugin.json';
import { dh2Module } from './dh2';
import dh2Manifest from './dh2/plugin.json';
import { dnd5eModule } from './dnd5e';
import dnd5eManifest from './dnd5e/plugin.json';
import type {
  GameUiSlots,
  GeneratedPluginRegistration,
  PluginManifest,
} from './plugin-api';

/** Зарегистрированные плагины в порядке показа (`order`, затем `id`). */
export const generatedPlugins: readonly GeneratedPluginRegistration[] = [
  {
    manifest: dnd5eManifest as unknown as PluginManifest,
    module: dnd5eModule,
  },
  {
    manifest: dh1Manifest as unknown as PluginManifest,
    module: dh1Module,
  },
  {
    manifest: dh2Manifest as unknown as PluginManifest,
    module: dh2Module,
  },
];

/** Ленивые UI-слоты: `systemId` → загрузчик объекта `GameUiSlots`. */
export const generatedUiLoaders: Readonly<
  Record<string, () => Promise<GameUiSlots<any>>>
> = {
  dnd5e: () => import('./dnd5e/ui').then((module) => module.uiSlots),
  dh1: () => import('./dh1/ui').then((module) => module.uiSlots),
  dh2: () => import('./dh2/ui').then((module) => module.uiSlots),
};
