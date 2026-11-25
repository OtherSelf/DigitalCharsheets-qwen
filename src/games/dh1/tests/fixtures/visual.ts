import type { DH1Character } from '../../types';

/**
 * Фикстура визуальных тестов Dark Heresy 1-й редакции.
 *
 * Данные специально «богатые»: так на скриншотах видно не пустые карточки,
 * а реальные значения, таблицы, бейджи и длинный контент. Все даты —
 * фиксированные, чтобы PNG не зависели от дня запуска.
 *
 * Файл — часть плагина: global-setup находит его по пути
 * `src/games/<id>/tests/fixtures/visual.ts`, поэтому удаление папки игры
 * убирает и её фикстуру, не ломая визуальный хост.
 */

export const dhCharacter: Omit<DH1Character, 'id' | 'userId'> = {
  systemId: 'dh1',
  gameSystem: 'Dark Heresy',
  name: 'Lucius Varn',
  characterClass: 'Adept',
  homeWorld: 'Imperial World',
  worldVariant: 'Shrine World',
  careerPath: 'Adept',
  rank: 'Scholar',
  divination: 'sinsHidden',
  divinationEffect: '+3 Corruption Points.',
  quirk: 'Devotional Scar',
  height: '1.82 m',
  weight: '78 kg',
  age: '34',
  skinColor: 'Weathered',
  hairColor: 'Black',
  eyeColor: 'Grey',
  // Пол задан: фикстура проверяет и подпись пола, и замок после создания.
  identity: { gender: 'male' },
  experience: 2500,
  totalExpSpent: 2200,
  experienceLog: [],
  alternatePath: null,
  advancedPath: null,
  backstory:
    'A junior savant of the Ordo Calixis, Lucius catalogues heresy for a living ' +
    'and has learned to distrust anything that catalogues too easily.',
  notes:
    'Keep the sealed dossier away from the ship’s cogitator.\n\n' +
    'The Inquisitor wants the reliquary opened only in a consecrated room.',
  questLog: [
    {
      id: 'quest-visual-dh-1',
      title: 'The Reliquary of Saint Veren',
      status: 'active',
      priority: 'main',
      description:
        'Recover the reliquary before the recidivist cult moves it off-world.',
      createdAt: '2025-03-01T08:00:00.000Z',
      updatedAt: '2025-03-14T19:45:00.000Z',
      notes: 'Sealed with a blood ward.',
      rewards: 'The Inquisitor’s favour',
      npcs: 'Interrogator Hesse, Magos Ardel',
      locations: 'Hive Sibellus, Shrine of the Ninth Hour',
      objectives: [
        {
          id: 'dh-obj-1',
          text: 'Interview Interrogator Hesse',
          completed: true,
        },
        { id: 'dh-obj-2', text: 'Locate the blood ward key', completed: false },
        {
          id: 'dh-obj-3',
          text: 'Secure transport off-world',
          completed: false,
        },
      ],
    },
  ],
  stats: {
    weaponSkill: 34,
    ballisticSkill: 41,
    strength: 32,
    toughness: 38,
    agility: 36,
    intelligence: 46,
    perception: 39,
    willpower: 43,
    fellowship: 31,
  },
  statUpgrades: {
    weaponSkill: [false, false, false, false],
    ballisticSkill: [true, false, false, false],
    strength: [false, false, false, false],
    toughness: [true, false, false, false],
    agility: [false, false, false, false],
    intelligence: [true, true, false, false],
    perception: [false, false, false, false],
    willpower: [true, false, false, false],
    fellowship: [false, false, false, false],
  },
  statNotes: {
    intelligence: 'Cortex implant (+5)',
    willpower: 'Iron resolve',
  },
  wounds: { current: 11, max: 14, notes: 'Grazed by a stub round' },
  fatePoints: { current: 2, max: 3, notes: 'Burned one at the shrine' },
  insanityPoints: { total: 6, notes: 'Recurring dreams of the Ninth Hour' },
  corruptionPoints: { total: 3, notes: 'Divination penalty' },
  wealth: {
    throneGelt: 240,
    monthlyIncome: 90,
    notes: 'Retainer from the Ordo',
  },
  movement: { walkHalf: 3, walkFull: 6, charge: 9, run: 18 },
  equipment: {
    armor: {
      Head: { ap: 4, type: 'Flak', mods: '', quality: 'Common' },
      Body: { ap: 5, type: 'Flak', mods: 'Cameleoline', quality: 'Good' },
      'Left arm': { ap: 4, type: 'Flak', mods: '', quality: 'Common' },
      'Right arm': { ap: 4, type: 'Flak', mods: '', quality: 'Common' },
      'Left leg': { ap: 3, type: 'Leather', mods: '', quality: 'Common' },
      'Right leg': { ap: 3, type: 'Leather', mods: '', quality: 'Common' },
    },
    weapons: {
      melee: [
        {
          id: 'dh-melee-1',
          name: 'Mono-sword',
          type: 'Blade',
          range: 'Melee',
          penetration: '2',
          damage: '1d10+3',
          traits: 'Balanced',
          equipped: true,
          notes: 'Family heirloom',
        },
      ],
      ranged: [
        {
          id: 'dh-ranged-1',
          name: 'Laspistol',
          type: 'Las',
          range: '30 m',
          rof: 'S/2/–',
          damage: '1d10+2',
          clip: 14,
          clipSize: 30,
          reload: 'Full',
          traits: 'Reliable',
          equipped: true,
          notes: 'Ordo-issue',
        },
        {
          id: 'dh-ranged-2',
          name: 'Hunting rifle',
          type: 'Solid projectile',
          range: '150 m',
          rof: 'S/–/–',
          damage: '1d10+3',
          clip: 4,
          clipSize: 5,
          reload: '2 Full',
          traits: 'Accurate',
          equipped: false,
          notes: '',
        },
      ],
    },
  },
  inventory: [
    {
      id: 'dh-inv-1',
      name: 'Data-slate',
      status: 'default',
      notes: 'Sealed dossier',
    },
    { id: 'dh-inv-2', name: 'Lho-sticks', status: 'default', notes: '' },
    {
      id: 'dh-inv-3',
      name: 'Sanctioned psykana seal',
      status: 'default',
      notes: '',
    },
    {
      id: 'dh-inv-4',
      name: 'Blood ward key',
      status: 'lost',
      notes: 'Not yet recovered',
    },
  ],
  skills: [
    {
      id: 'dh-skill-1',
      name: 'Awareness (Per)',
      notes: 'Spotting ambushes',
      type: 'basic',
      training: { skilled: true, plus10: true, plus20: false, plus30: false },
    },
    {
      id: 'dh-skill-2',
      name: 'Charm (Fel)',
      notes: '',
      type: 'basic',
      training: { skilled: false, plus10: false, plus20: false, plus30: false },
    },
    {
      id: 'dh-skill-3',
      name: 'Dodge (Agi)',
      notes: 'Reaction',
      type: 'basic',
      training: { skilled: true, plus10: false, plus20: false, plus30: false },
    },
    {
      id: 'dh-skill-4',
      name: 'Inquiry (Fel)',
      notes: 'Interrogation technique',
      type: 'basic',
      training: { skilled: true, plus10: false, plus20: false, plus30: false },
    },
    {
      id: 'dh-skill-5',
      name: 'Scholastic Lore (Int)',
      notes: 'Occult and Imperial history',
      type: 'advanced',
      training: { skilled: true, plus10: true, plus20: false, plus30: false },
    },
    {
      id: 'dh-skill-6',
      name: 'Tech-Use (Int)',
      notes: '',
      type: 'advanced',
      training: { skilled: false, plus10: false, plus20: false, plus30: false },
    },
  ],
  talents: [
    {
      id: 'dh-talent-1',
      name: 'Peer (Academic)',
      notes: 'The Ordo’s archivists',
    },
    { id: 'dh-talent-2', name: 'Resistance (Psychic Powers)', notes: '' },
    {
      id: 'dh-talent-3',
      name: 'Total Recall',
      notes: '',
      description: 'Perfect memory for texts.',
    },
  ],
  fatigue1st: { current: 0 },
  criticalConditions: [],
  customHouseRules: [
    {
      name: 'Critical hits on 96–00',
      description: 'Use the expanded critical table from the core book.',
    },
  ],
};

/**
 * Контракт discovery: default-экспорт — шаблон персонажа, который
 * global-setup сеет в каждый визуальный аккаунт.
 */
export default dhCharacter;
