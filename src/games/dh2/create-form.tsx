'use client';

import { DarkHeresyCreateForm } from '../dh-shared/create-form';

/**
 * Форма создания DH 2-й редакции: та же общая форма, но с полем Influence и
 * фабрикой `createDh2Defaults`.
 */
export function Dh2CharacterForm() {
  return <DarkHeresyCreateForm variant="dh2" />;
}

export default Dh2CharacterForm;
