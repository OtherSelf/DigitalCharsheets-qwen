#!/usr/bin/env node
/**
 * ─── LANDMARK: LEGAL BACKFILL (DIVINATIONS) ────────────────────────────────
 * Замораживает текст пророчества и его эффекта в листах **до** выреза
 * книжных текстов (релиз 0.22.0). Читает словари текущей установки, пишет
 * `divinationText`/`divinationEffectText` в обеих локалях, демо-листы
 * пропускает.
 *
 * Старые листы без `systemId` разрешаются по алиасам манифестов, а если в
 * `divination` лежит фраза вместо id — по обратному поиску в словаре.
 *
 *   node scripts/legal/backfill-divinations.mjs --dry-run
 *   node scripts/legal/backfill-divinations.mjs --backup --explain
 *
 * Коды возврата: 0 — успех, 1 — ошибка, 2 — остались незамороженные листы.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  findEffectIdByText,
  findIdByText,
  freezeFields,
  hasDivinationText,
  hasEffectText,
  isFrozen,
} from './lib/divination-texts.mjs';

const args = process.argv.slice(2);

/** @param {string} name */
function argValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const hasFlag = (name) => args.includes(name);

const dryRun = hasFlag('--dry-run');
const withBackup = hasFlag('--backup');
const asJson = hasFlag('--json');
const explain = hasFlag('--explain');

const dataDir = path.resolve(
  argValue('--data-dir') ?? process.env.DCS_DATA_DIR ?? './data',
);
const i18nRoot = path.resolve(argValue('--i18n') ?? './src/games');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(dataDir, `.legal-backup-${stamp}`);

const stats = {
  scanned: 0,
  filled: 0,
  already: 0,
  skippedNoId: 0,
  unknownId: 0,
  unknownSystem: 0,
  otherSystem: 0,
  demo: 0,
  failed: 0,
  dryRun,
};

/** @type {{ file: string, reason: string, systemId?: string, gameSystem?: string, edition?: string, divination?: string }[]} */
const skipped = [];

/** @param {'dh1'|'dh2'} system */
function loadDictionaries(system) {
  /** @type {Record<string, Record<string, string>>} */
  const dictionaries = {};
  for (const lang of ['en', 'ru']) {
    const file = path.join(i18nRoot, system, 'i18n', `${lang}.json`);
    dictionaries[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return dictionaries;
}

/**
 * Legacy-алиасы из манифестов: `{gameSystem, edition} → systemId`.
 * Тот же принцип, что в приложении: чем специфичнее совпадение, тем выше
 * приоритет.
 */
function loadAliases() {
  /** @type {{ id: string, gameSystem?: string, edition?: string }[]} */
  const aliases = [];
  for (const name of fs.readdirSync(i18nRoot)) {
    const manifest = path.join(i18nRoot, name, 'plugin.json');
    if (!fs.existsSync(manifest)) continue;
    const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    for (const alias of parsed.aliases ?? []) {
      aliases.push({ id: parsed.id, ...alias });
    }
  }
  return aliases;
}

/**
 * @param {Record<string, unknown>} character
 * @param {{ id: string, gameSystem?: string, edition?: string }[]} aliases
 * @returns {{ system?: 'dh1'|'dh2', reason: string }}
 */
function resolveSystem(character, aliases) {
  const explicit = character.systemId;
  if (typeof explicit === 'string' && explicit) {
    return explicit === 'dh1' || explicit === 'dh2'
      ? { system: explicit, reason: 'systemId' }
      : { reason: 'otherSystem' };
  }

  /** @type {{ id: string, score: number } | undefined} */
  let best;
  for (const alias of aliases) {
    if (
      alias.gameSystem !== undefined &&
      alias.gameSystem !== character.gameSystem
    ) {
      continue;
    }
    if (alias.edition !== undefined && alias.edition !== character.edition) {
      continue;
    }
    if (alias.gameSystem === undefined && alias.edition === undefined) continue;
    const score =
      (alias.gameSystem !== undefined ? 1 : 0) +
      (alias.edition !== undefined ? 1 : 0);
    if (!best || score > best.score) best = { id: alias.id, score };
  }

  if (!best) return { reason: 'unknownSystem' };
  return best.id === 'dh1' || best.id === 'dh2'
    ? { system: best.id, reason: 'alias' }
    : { reason: 'otherSystem' };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.tmp-${process.pid}`;
  const mode = fs.statSync(file).mode & 0o777;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode });
  fs.renameSync(temp, file);
}

function backup(file) {
  if (!withBackup) return;
  const relative = path.relative(dataDir, file);
  const target = path.join(backupRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
}

/** Все листы: активные, архив и корзина (без .meta.json). */
function characterFiles() {
  const usersRoot = path.join(dataDir, 'users');
  if (!fs.existsSync(usersRoot)) return [];
  /** @type {string[]} */
  const files = [];
  for (const uid of fs.readdirSync(usersRoot)) {
    for (const folder of ['characters', 'archive', 'trash']) {
      const dir = path.join(usersRoot, uid, folder);
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json') || name.endsWith('.meta.json')) continue;
        files.push(path.join(dir, name));
      }
    }
  }
  return files;
}

function main() {
  const dictionaries = {
    dh1: loadDictionaries('dh1'),
    dh2: loadDictionaries('dh2'),
  };
  const aliases = loadAliases();

  for (const file of characterFiles()) {
    stats.scanned += 1;
    let character;
    try {
      character = readJson(file);
    } catch (error) {
      stats.failed += 1;
      skipped.push({ file, reason: `bad json: ${error.message}` });
      continue;
    }

    if (character.demo === true) {
      stats.demo += 1;
      continue;
    }

    const resolved = resolveSystem(character, aliases);
    if (!resolved.system) {
      if (resolved.reason === 'otherSystem') stats.otherSystem += 1;
      else stats.unknownSystem += 1;
      skipped.push({
        file,
        reason: resolved.reason,
        systemId: character.systemId,
        gameSystem: character.gameSystem,
        edition: character.edition,
        divination: character.divination,
      });
      continue;
    }
    const system = resolved.system;

    let id =
      typeof character.divination === 'string' ? character.divination : '';
    if (!id.trim()) {
      stats.skippedNoId += 1;
      continue;
    }
    if (!hasDivinationText(system, id, dictionaries[system])) {
      const fromText = findIdByText(system, id, dictionaries[system]);
      if (fromText) {
        id = fromText;
        character.divination = id;
      }
    }
    if (isFrozen(character.divinationText)) {
      stats.already += 1;
      continue;
    }

    let effectId =
      typeof character.divinationEffect === 'string'
        ? character.divinationEffect
        : system === 'dh2'
          ? id
          : '';
    if (
      system === 'dh1' &&
      effectId &&
      !hasEffectText(effectId, dictionaries.dh1)
    ) {
      const fromText = findEffectIdByText(effectId, dictionaries.dh1);
      if (fromText) {
        effectId = fromText;
        character.divinationEffect = effectId;
      }
    }

    const frozen = freezeFields(system, { id, effectId }, dictionaries[system]);
    if (!isFrozen(frozen.text)) {
      stats.unknownId += 1;
      skipped.push({
        file,
        reason: 'unknownId',
        systemId: system,
        divination: id,
      });
      continue;
    }

    character.divinationText = frozen.text;
    if (isFrozen(frozen.effect)) character.divinationEffectText = frozen.effect;

    if (!dryRun) {
      backup(file);
      writeJsonAtomic(file, character);
    }
    stats.filled += 1;
  }

  const report = explain ? { ...stats, skipped } : stats;
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } else {
    const mode = dryRun ? ' (dry-run, без записи)' : '';
    console.log(
      `сканировано ${stats.scanned}, заморожено ${stats.filled}, уже ${stats.already}, ` +
        `без id ${stats.skippedNoId}, неизвестный id ${stats.unknownId}, ` +
        `без systemId ${stats.unknownSystem}, чужая система ${stats.otherSystem}, ` +
        `демо ${stats.demo}, ошибок ${stats.failed}${mode}`,
    );
    if (withBackup && !dryRun) console.log(`бэкап: ${backupRoot}`);
    if (skipped.length > 0 && !asJson) {
      for (const item of skipped) {
        console.log(`  - ${item.reason}: ${item.file}`);
      }
    }
  }

  const remaining = stats.unknownId + stats.unknownSystem;
  process.exit(remaining > 0 ? 2 : stats.failed > 0 ? 1 : 0);
}

main();
