import type { GameHistoryConfig } from '@/games/types';

/**
 * Подписи экрана истории для эталонной игры. Ключи — из её словаря
 * (`sandbox.*`); ядро по ним только рисует «было/стало» и не знает, что
 * такое ранг или спутник.
 */
export const sandboxHistory: GameHistoryConfig = {
  labels: {
    name: 'common.name',
    rank: 'sandbox.rank',
    total: 'sandbox.total',
    notes: 'sandbox.notes',
    'stats.might': 'sandbox.stat.might',
    'stats.wits': 'sandbox.stat.wits',
    'companion.name': 'sandbox.companionName',
    'companion.kind': 'sandbox.companionKind',
    'companion.notes': 'sandbox.notes',
  },
  tokens: {
    yes: 'sandbox.yes',
    no: 'sandbox.no',
  },
};
