/**
 * ─── AUTO-GENERATED — НЕ РЕДАКТИРОВАТЬ ─────────────────────────────────────
 * Реестр плагинов, сгенерированный из манифестов `src/games/<id>/plugin.json`
 * (плагины — build-time: новый плагин = папка + манифест + пересборка).
 *
 * Пересобрать:  npm run plugins:generate
 * Проверить:    npm run plugins:check   (шаг `npm run verify`)
 */
import { deriveCharacter as dh1Derive, dh1Module } from './dh1';
import dh1Manifest from './dh1/plugin.json';
import { deriveCharacter as dh2Derive, dh2Module } from './dh2';
import dh2Manifest from './dh2/plugin.json';
import { deriveCharacter as dnd5eDerive, dnd5eModule } from './dnd5e';
import dnd5eManifest from './dnd5e/plugin.json';
import type {
  GameUiSlots,
  GeneratedPluginRegistration,
  PluginFont,
  PluginManifest,
} from './plugin-api';
import { sandboxModule } from './sandbox';
import sandboxManifest from './sandbox/plugin.json';

/** Зарегистрированные плагины в порядке показа (`order`, затем `id`). */
export const generatedPlugins: readonly GeneratedPluginRegistration[] = [
  {
    manifest: dnd5eManifest as unknown as PluginManifest,
    module: dnd5eModule,
    derive: dnd5eDerive,
  },
  {
    manifest: dh1Manifest as unknown as PluginManifest,
    module: dh1Module,
    derive: dh1Derive,
  },
  {
    manifest: dh2Manifest as unknown as PluginManifest,
    module: dh2Module,
    derive: dh2Derive,
  },
  {
    manifest: sandboxManifest as unknown as PluginManifest,
    module: sandboxModule,
  },
];

/** Ленивые UI-слоты: `systemId` → загрузчик объекта `GameUiSlots`. */
export const generatedUiLoaders: Readonly<
  Record<string, () => Promise<GameUiSlots<any>>>
> = {
  dnd5e: () => import('./dnd5e/ui').then((module) => module.uiSlots),
  dh1: () => import('./dh1/ui').then((module) => module.uiSlots),
  dh2: () => import('./dh2/ui').then((module) => module.uiSlots),
  sandbox: () => import('./sandbox/ui').then((module) => module.uiSlots),
};

export const generatedFontLoaders: Readonly<
  Record<string, () => Promise<PluginFont>>
> = {
  dnd5e: () => import('./dnd5e/fonts').then((module) => module.pluginFont),
  dh1: () => import('./dh1/fonts').then((module) => module.pluginFont),
  dh2: () => import('./dh2/fonts').then((module) => module.pluginFont),
  sandbox: () => import('./sandbox/fonts').then((module) => module.pluginFont),
};
