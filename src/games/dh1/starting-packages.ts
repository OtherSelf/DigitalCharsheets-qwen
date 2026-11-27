/**
 * ─── LANDMARK: DH1 STARTING PACKAGES ──────────────────────────────────────
 * Стартовые пакеты профессий из каталога `content/dh1` (reviewed).
 * В каждой ячейке — варианты выбора («A или B»); ключи ведут в i18n.
 * Пакет Адепты Сороритас не входит: профессия вне стандартной генерации.
 */
export interface CareerStartingPackage {
  skills: string[][];
  talents: string[][];
  gear: string[][];
  traits?: string[][];
}

export const STARTING_PACKAGES: Record<string, CareerStartingPackage> = {
  Adept: {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemLiteracyInt'],
      ['dh1.startItemTradeCopyistInt', 'dh1.startItemTradeValetFel'],
      ['dh1.startItemCommonLoreImperiumInt'],
      [
        'dh1.startItemScholasticLoreLegendInt',
        'dh1.startItemCommonLoreTechInt',
      ],
    ],
    talents: [
      [
        'dh1.startItemMeleeWeaponTrainingPrimitive',
        'dh1.startItemPistolTrainingSP',
      ],
      ['dh1.startItemLightSleeper', 'dh1.startItemResistanceCold'],
      ['dh1.startItemSprint', 'dh1.startItemUnremarkable'],
    ],
    gear: [
      ['dh1.startItemStubRevolverAnd6Bullets', 'dh1.startItemStaff'],
      ['dh1.startItemAdministratumRobesCommonQualityClothing'],
      ['dh1.startItemAutoQuill', 'dh1.startItemWritingKit'],
      ['dh1.startItemChrono', 'dh1.startItemHourglass'],
      ['dh1.startItemDataSlate', 'dh1.startItemIlluminatedTome'],
      ['dh1.startItemBackpack'],
    ],
  },
  Arbitrator: {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemLiteracyInt'],
      ['dh1.startItemCommonLoreAdeptusArbitesInt'],
      ['dh1.startItemCommonLoreImperiumInt'],
      ['dh1.startItemInquiryFel'],
    ],
    talents: [
      ['dh1.startItemBasicWeaponTrainingSP'],
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      ['dh1.startItemQuickDraw', 'dh1.startItemRapidReload'],
    ],
    gear: [
      ['dh1.startItemShotgunAnd12Shells'],
      ['dh1.startItemClub'],
      ['dh1.startItemBrassKnuckles'],
      ['dh1.startItemKnife'],
      [
        'dh1.startItemChainCoat',
        'dh1.startItemFlakVest',
        'dh1.startItemMeshVest',
      ],
      ['dh1.startItemUniformGoodQualityClothing'],
      ['dh1.startItem3DosesOfStimm'],
      ['dh1.startItemInjector'],
      ['dh1.startItemArbitratorID'],
      ['dh1.startItemChrono'],
      ['dh1.startItemPackOfLhoSticks', 'dh1.startItemFlaskOfAmasec'],
    ],
  },
  Assassin: {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemAwarenessPer'],
      ['dh1.startItemDodgeAg'],
    ],
    talents: [
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      ['dh1.startItemAmbidextrous', 'dh1.startItemUnremarkable'],
      ['dh1.startItemThrownWeaponTraining', 'dh1.startItemPistolTrainingLas'],
      ['dh1.startItemBasicWeaponTrainingSP'],
      ['dh1.startItemPistolTrainingSP'],
    ],
    gear: [
      [
        'dh1.startItemShotgunAnd12Shells',
        'dh1.startItemHuntingRifleAnd16Rounds',
        'dh1.startItemAutogunAnd1Clip',
      ],
      ['dh1.startItemSword'],
      ['dh1.startItemKnife'],
      [
        'dh1.startItemCompactLasPistolAnd1ChargePack',
        'dh1.startItem10ThrowingKnives',
      ],
      ['dh1.startItem3DosesOfStimm'],
      ['dh1.startItemInjector'],
      ['dh1.startItemCharmCorpseHair'],
      ['dh1.startItemBlackBodygloveCommonQualityClothing'],
    ],
  },
  Cleric: {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemCommonLoreImperialCreedInt'],
      ['dh1.startItemLiteracyInt'],
      ['dh1.startItemPerformerSingerFel', 'dh1.startItemTradeCopyistInt'],
      ['dh1.startItemTradeCookInt', 'dh1.startItemTradeValetFel'],
    ],
    talents: [
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      ['dh1.startItemPistolTrainingSP'],
      [
        'dh1.startItemBasicWeaponTrainingPrimitive',
        'dh1.startItemThrownWeaponTrainingPrimitive',
      ],
    ],
    gear: [
      ['dh1.startItemHammer', 'dh1.startItemSword'],
      [
        'dh1.startItemStubRevolverAnd6Bullets',
        'dh1.startItemAutopistolAnd1Clip',
      ],
      ['dh1.startItemCrossbowAnd10Bolts', 'dh1.startItem5ThrowingKnives'],
      ['dh1.startItemChainCoat', 'dh1.startItemFlakVest'],
      ['dh1.startItemAquilaNecklace'],
      ['dh1.startItemEcclesiarchyRobesGoodQualityClothing'],
      ['dh1.startItem4Candles'],
      ['dh1.startItemCharmSkull'],
      ['dh1.startItemBackpack'],
    ],
  },
  Guardsman: {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemDriveGroundVehicleAg', 'dh1.startItemSwimS'],
    ],
    talents: [
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      [
        'dh1.startItemPistolTrainingPrimitive',
        'dh1.startItemPistolTrainingLas',
      ],
      ['dh1.startItemBasicWeaponTrainingLas'],
      [
        'dh1.startItemBasicWeaponTrainingPrimitive',
        'dh1.startItemBasicWeaponTrainingSP',
      ],
    ],
    gear: [
      ['dh1.startItemSword', 'dh1.startItemAxe', 'dh1.startItemHammer'],
      [
        'dh1.startItemFlintlockPistolAnd12Shots',
        'dh1.startItemLasPistolAnd1ChargePack',
      ],
      ['dh1.startItemLasgunAnd1ChargePack'],
      [
        'dh1.startItemBowAnd10Arrows',
        'dh1.startItemMusketAnd12Shots',
        'dh1.startItemShotgunAnd12Shells',
      ],
      ['dh1.startItemKnife'],
      ['dh1.startItemGuardFlakArmour'],
      [
        'dh1.startItemUniformCommonQualityClothing',
        'dh1.startItemStealthGearCommonQualityClothing',
        'dh1.startItemStreetClothesCommonQualityClothing',
      ],
      ['dh1.startItem1WeekCorpseStarchRations'],
      [
        'dh1.startItemMercenaryLicence',
        'dh1.startItemExplosiveCollarStillAttached',
        'dh1.startItemImperialInfantrymanSUpliftingPrimer',
      ],
    ],
  },
  'Imperial Psyker': {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemPsynisciencePer'],
      ['dh1.startItemInvocationWP'],
      ['dh1.startItemTradeMerchantFel', 'dh1.startItemTradeSoothsayerFel'],
      ['dh1.startItemLiteracyInt'],
    ],
    talents: [
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      ['dh1.startItemPistolTrainingSP', 'dh1.startItemPistolTrainingLas'],
      ['dh1.startItemPsyRating1'],
    ],
    gear: [
      ['dh1.startItemAxe', 'dh1.startItemSword'],
      ['dh1.startItemStaff'],
      [
        'dh1.startItemCompactStubRevolverAnd3Bullets',
        'dh1.startItemCompactLasPistolAnd1ChargePack',
      ],
      ['dh1.startItemKnifePsykanaMercyBlade'],
      ['dh1.startItemQuiltedVest'],
      ['dh1.startItemTattyRobePoorQualityClothing'],
      [
        'dh1.startItemBookOfImperialSaints',
        'dh1.startItemDeckOfCards',
        'dh1.startItemDice',
      ],
      ['dh1.startItemPsyFocus'],
      ['dh1.startItemSanctioningBrand'],
    ],
    traits: [['dh1.startItemSanctionedPsyker']],
  },
  Scum: {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemBlatherFel'],
      ['dh1.startItemCharmFel', 'dh1.startItemDodgeAg'],
      ['dh1.startItemDeceiveFel'],
      ['dh1.startItemAwarenessPer'],
      ['dh1.startItemCommonLoreImperiumInt'],
    ],
    talents: [
      ['dh1.startItemAmbidextrous', 'dh1.startItemUnremarkable'],
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      ['dh1.startItemPistolTrainingSP'],
      ['dh1.startItemBasicWeaponTrainingSP'],
    ],
    gear: [
      ['dh1.startItemAutogunAnd1Clip', 'dh1.startItemShotgunAnd12Shells'],
      ['dh1.startItemAutopistolAnd1Clip'],
      ['dh1.startItemBrassKnuckles', 'dh1.startItemClub'],
      ['dh1.startItemKnife'],
      ['dh1.startItemQuiltedVest', 'dh1.startItemBeastFurs'],
      [
        'dh1.startItemStreetWarePoorQualityClothing',
        'dh1.startItemRagsPoorQualityClothing',
        'dh1.startItemDirtyCoverallsPoorQualityClothing',
      ],
    ],
  },
  'Tech-Priest': {
    skills: [
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemTechUseInt'],
      ['dh1.startItemLiteracyInt'],
      ['dh1.startItemSecretTongueTechInt'],
      ['dh1.startItemTradeScrimshawerAg', 'dh1.startItemTradeCopyistInt'],
    ],
    talents: [
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      ['dh1.startItemBasicWeaponTrainingLas'],
      ['dh1.startItemPistolTrainingLas'],
      ['dh1.startItemElectroGraftUse'],
    ],
    gear: [
      ['dh1.startItemMetalStaff'],
      ['dh1.startItemLasPistolAnd1ChargePack'],
      ['dh1.startItemLasCarbineAnd1ChargePack'],
      ['dh1.startItemKnife'],
      ['dh1.startItemFlakVest'],
      ['dh1.startItemGlowLamp'],
      ['dh1.startItemDataSlate'],
      ['dh1.startItemMechanicusRobesAndVestmentsGoodQualityCl'],
      ['dh1.startItem1d10SpareParts'],
      ['dh1.startItemVialOfSacredMachineOil'],
    ],
    traits: [['dh1.startItemMechanicusImplants']],
  },
  // Инквизиторский справочник, с. 42: опциональная карьера с разрешения
  // Мастера. Набор — из книги, подписи общие с другими карьерами.
  'Adepta Sororitas': {
    skills: [
      ['dh1.startItemCommonLoreImperialCreedInt'],
      ['dh1.startItemLiteracyInt'],
      ['dh1.startItemPerformerSingerFel'],
      ['dh1.startItemSpeakLanguageLowGothicInt'],
      ['dh1.startItemTradeCopyistInt'],
    ],
    talents: [
      ['dh1.startItemBasicWeaponTrainingPrimitive'],
      ['dh1.startItemMeleeWeaponTrainingPrimitive'],
      ['dh1.startItemPistolTrainingLas'],
      ['dh1.startItemPureFaith'],
    ],
    gear: [
      ['dh1.startItemClub', 'dh1.startItemFlail', 'dh1.startItemStaff'],
      ['dh1.startItemLasPistolAnd1ChargePack'],
      [
        'dh1.startItemCarapaceChestPlateAndMeshCowl',
        'dh1.startItemFeudalPlate',
      ],
      ['dh1.startItemAquilaNecklace'],
      ['dh1.startItemChapletEcclesiasticus'],
      ['dh1.startItemVestmentsGoodQualityClothing'],
      ['dh1.startItem4Candles'],
      ['dh1.startItemWritingKit'],
      ['dh1.startItemRuleOfTheSororitas'],
      ['dh1.startItemRingOfSuffrage'],
    ],
  },
};
