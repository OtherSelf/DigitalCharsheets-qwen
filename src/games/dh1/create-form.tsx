'use client';

import { DarkHeresyCreateForm } from '../dh-shared/create-form';

/**
 * Форма создания DH 1-й редакции. Тонкая обёртка: сама форма общая, но
 * модуль dh1 фиксирует variant и тем самым состав полей/фабрику персонажа.
 */
export function Dh1CharacterForm() {
  return <DarkHeresyCreateForm variant="dh1" />;
}

export default Dh1CharacterForm;
