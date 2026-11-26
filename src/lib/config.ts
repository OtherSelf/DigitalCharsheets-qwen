import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

/**
 * ─── LANDMARK: INSTANCE CONFIG ──────────────────────────────────────────────
 * Настройки инстанса, которые нельзя держать в коде: имя, юридические тексты
 * и реквизиты оператора, адреса dev-стендов. Файл `dcs.config.json` лежит в
 * корне репозитория, поэтому у self-hosted инстанса свои значения без правки
 * исходников.
 *
 * Что здесь НЕ живёт: переключатели, которые меняются из админки на живом
 * сайте (регистрация, обслуживание, ограничение входа). Они в data-dir
 * (`src/lib/site-settings.ts`): конфиг-файл читается один раз на процесс, а
 * тумблер в админке обязан действовать сразу.
 *
 * Порядок разрешения значений:
 *   1. встроенные значения по умолчанию (работает без файла вообще);
 *   2. `dcs.config.json` (или файл из `DCS_CONFIG_PATH`);
 *   3. переменная `DCS_CONFIG` — JSON, накладывается поверх файла.
 *
 * Модуль обязан оставаться чистым Node: его импортирует `next.config.ts`,
 * который исполняется до сборки приложения.
 */

const operatorSchema = z.object({
  /** ФИО оператора ПДн. Пусто — политика печатает «по запросу». */
  name: z.string().default(''),
  /** Адрес для корреспонденции (не обязательно домашний). */
  postalAddress: z.string().default(''),
  contactEmail: z.string().default('ruslan@thfree.ru'),
  /** Номер записи в реестре операторов РКН. */
  registryNumber: z.string().default(''),
});

export const instanceConfigSchema = z.object({
  instance: z
    .object({
      publicName: z.string().default('Digital Character Sheets'),
    })
    .default(() => ({ publicName: 'Digital Character Sheets' })),
  legal: z
    .object({
      privacy: z
        .object({ enabled: z.boolean().default(true) })
        .default(() => ({ enabled: true })),
      terms: z
        .object({ enabled: z.boolean().default(false) })
        .default(() => ({ enabled: false })),
      operator: operatorSchema.default(() => ({
        name: '',
        postalAddress: '',
        contactEmail: 'ruslan@thfree.ru',
        registryNumber: '',
      })),
      /** Минимальный возраст по политике; текст и гейт используют одно число. */
      ageMinimum: z.number().int().min(0).max(21).default(16),
    })
    .default(() => ({
      privacy: { enabled: true },
      terms: { enabled: false },
      operator: {
        name: '',
        postalAddress: '',
        contactEmail: 'ruslan@thfree.ru',
        registryNumber: '',
      },
      ageMinimum: 16,
    })),
  hosting: z
    .object({
      provider: z.string().default(''),
      country: z.string().default('RU'),
    })
    .default(() => ({ provider: '', country: 'RU' })),
  dev: z
    .object({
      /** Хосты, которым Next разрешает dev-запросы (HMR, server actions). */
      allowedOrigins: z.array(z.string()).default([]),
    })
    .default(() => ({ allowedOrigins: [] })),
});

export type InstanceConfig = z.infer<typeof instanceConfigSchema>;

const DEFAULTS: InstanceConfig = {
  instance: { publicName: 'Digital Character Sheets' },
  legal: {
    privacy: { enabled: true },
    terms: { enabled: false },
    operator: {
      name: '',
      postalAddress: '',
      contactEmail: 'ruslan@thfree.ru',
      registryNumber: '',
    },
    ageMinimum: 16,
  },
  hosting: { provider: '', country: 'RU' },
  dev: { allowedOrigins: [] },
};

/** Глубокое слияние объектов; массивы заменяются целиком, а не склеиваются. */
function merge(base: unknown, patch: unknown): unknown {
  if (
    typeof base !== 'object' ||
    base === null ||
    Array.isArray(base) ||
    typeof patch !== 'object' ||
    patch === null ||
    Array.isArray(patch)
  ) {
    return patch === undefined ? base : patch;
  }
  const result: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    result[key] = merge(result[key], value);
  }
  return result;
}

function readConfigFile(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return {};
    // Битый конфиг — не повод молча стартовать с другими значениями:
    // юридические тексты и реквизиты оператора не должны подменяться.
    throw new Error(`dcs.config.json: ${(error as Error).message}`);
  }
}

/** Путь к файлу настроек: `DCS_CONFIG_PATH` или `dcs.config.json` в корне. */
function configFilePath(): string {
  return (
    process.env.DCS_CONFIG_PATH?.trim() ||
    path.join(process.cwd(), 'dcs.config.json')
  );
}

/**
 * Прочитать настройки. Ошибка валидации — исключение с перечнем полей:
 * тихо подставлять значения по умолчанию там, где ошибка в реквизитах
 * оператора, опаснее падения.
 */
export function loadInstanceConfig(): InstanceConfig {
  let raw: unknown = DEFAULTS;

  const fromFile = readConfigFile(configFilePath());
  raw = merge(raw, fromFile);

  const inline = process.env.DCS_CONFIG?.trim();
  if (inline) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(inline);
    } catch (error) {
      throw new Error(
        `DCS_CONFIG: невалидный JSON (${(error as Error).message})`,
      );
    }
    raw = merge(raw, parsed);
  }

  const result = instanceConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`dcs.config.json: ${issues}`);
  }
  return result.data;
}

let cached: InstanceConfig | null = null;

/**
 * Настройки текущего процесса. Кэш нужен, чтобы не читать файл на каждый
 * запрос; `fresh: true` читает заново (тесты и диагностика).
 */
export function getInstanceConfig(
  options: { fresh?: boolean } = {},
): InstanceConfig {
  if (options.fresh) cached = loadInstanceConfig();
  if (!cached) cached = loadInstanceConfig();
  return cached;
}
