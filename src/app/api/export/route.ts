import { NextResponse } from 'next/server';

import { toPortableCharacter } from '@/lib/character-portable';
import { getCharactersFromServer } from '@/lib/server-storage';
import { getSessionUid } from '@/lib/session';

/**
 * ─── LANDMARK: PORTABLE EXPORT ──────────────────────────────────────────────
 * «Backup All» и одиночная выгрузка отдают лист в переносимом виде: без
 * провенанса миграции (`migratedFrom/At/FromUid`), старых Firestore-полей и
 * `userId` (владелец при импорте назначается заново). На диске эти поля
 * остаются — чистим только на выходе.
 *
 * Раньше здесь возвращались сырые файлы: в бэкап попадали `migratedFromUid`
 * (чужой идентификатор Firebase), `userId` и служебные ключи.
 */
export async function GET(request: Request) {
  const uid = getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const characterId = searchParams.get('characterId');

  const characters = getCharactersFromServer(uid);

  if (characterId) {
    // Export single character
    const character = characters.find((c) => c.id === characterId);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      toPortableCharacter(character as unknown as Record<string, unknown>),
    );
  }

  // Export all characters
  return NextResponse.json(
    characters.map((character) =>
      toPortableCharacter(character as unknown as Record<string, unknown>),
    ),
  );
}
