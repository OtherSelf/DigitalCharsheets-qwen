#!/usr/bin/env node
/**
 * ─── LANDMARK: LEGAL BACKFILL (DIVINATIONS) ────────────────────────────────
 * Замораживает текст пророчества и его эффекта в листах **до** выреза
 * книжных текстов (релиз 0.22.0). Читает словари текущей установки, пишет
 * `divinationText`/`divinationEffectText` в обеих локалях, демо-листы
 * пропускает.
 *
 *   node scripts/legal/backfill-divinations.mjs --dry-run
 *   node scripts/legal/backfill-divinations.mjs --backup
 *
 * Коды возврата: 0 — успех, 1 — ошибка, 2 — остались незамороженные листы.
 */
import fs from 'node:fs';
import path from 'node:path';

import { freezeFields, isFrozen } from './lib/divination-texts.mjs';

const args = process.argv.slice(2);

/** @param {string} name */
function argValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const hasFlag = (name) => args.includes(name);

const dryRun = hasFlag('--dry-run');
const withBackup = hasFlag('--backup');
const json = hasFlag('--json');

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
  demo: 0,
  failed: 0,
  dryRun,
};

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

/** @param {Record<string, unknown>} character */
function systemOf(character) {
  const systemId = character.systemId;
  return systemId === 'dh1' || systemId === 'dh2' ? systemId : undefined;
}

function main() {
  const dictionaries = {
    dh1: loadDictionaries('dh1'),
    dh2: loadDictionaries('dh2'),
  };

  for (const file of characterFiles()) {
    stats.scanned += 1;
    let character;
    try {
      character = readJson(file);
    } catch (error) {
      stats.failed += 1;
      console.error(`не JSON: ${file}: ${error.message}`);
      continue;
    }

    if (character.demo === true) {
      stats.demo += 1;
      continue;
    }

    const system = systemOf(character);
    if (!system) {
      stats.unknownSystem += 1;
      continue;
    }

    const id =
      typeof character.divination === 'string' ? character.divination : '';
    if (!id) {
      stats.skippedNoId += 1;
      continue;
    }
    if (isFrozen(character.divinationText)) {
      stats.already += 1;
      continue;
    }

    const effectId =
      typeof character.divinationEffect === 'string'
        ? character.divinationEffect
        : system === 'dh2'
          ? id
          : '';

    const frozen = freezeFields(system, { id, effectId }, dictionaries[system]);
    if (!isFrozen(frozen.text)) {
      stats.unknownId += 1;
      console.error(`неизвестное пророчество: ${system}/${id} (${file})`);
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

  if (json) {
    process.stdout.write(`${JSON.stringify(stats)}\n`);
  } else {
    const mode = dryRun ? ' (dry-run, без записи)' : '';
    console.log(
      `сканировано ${stats.scanned}, заморожено ${stats.filled}, уже ${stats.already}, ` +
        `без id ${stats.skippedNoId}, неизвестный id ${stats.unknownId}, ` +
        `без systemId ${stats.unknownSystem}, демо ${stats.demo}, ошибок ${stats.failed}${mode}`,
    );
    if (withBackup && !dryRun) console.log(`бэкап: ${backupRoot}`);
  }

  const remaining = stats.unknownId + stats.unknownSystem;
  process.exit(remaining > 0 ? 2 : stats.failed > 0 ? 1 : 0);
}

main();
