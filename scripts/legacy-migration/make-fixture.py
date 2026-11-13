#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-fixture.py — собрать обезличенный фикстур миграции из реального дампа.

Только для разработки и запускается рядом с `dcs-migrate.py` (импортирует его
как модуль, чтобы читать дамп тем же парсером). Читает Firestore-экспорт или
JSON-массив, заменяет персональные значения плейсхолдерами и пишет JSON-массив
в формате `import-source.json`, который понимает `--source`.

Механика сохраняется: `gameSystem`, `edition`, поля-перечисления (`type`,
`status`, `quality`, `damageType`, `ability`, `class`, `size`, `speed`…),
кубиковые строки (`1d8+5 P`, `2d10`), числа и булевы. Благодаря этому мигратор
на фикстуре проходит те же ветки преобразования (дефолты DH, `atkBonus` →
`damageDice`, `statUpgrades` из трёх флагов, `penetration` только у ближнего
боя), что и на реальных данных.

Что заменяется:
  * имена персонажей, предметов, заклинаний, навыков; заметки, предыстории,
    квесты, прорицания, особенности, внешность, возраст/рост/вес, класс/путь/
    ранг/мир/мировоззрение/раса и списки черт — на плейсхолдеры;
  * Firebase uid, document id, `userId`, `avatar` — на синтетические значения.

Одинаковые исходные значения дают одинаковые плейсхолдеры, поэтому повторный
прогон на том же дампе даёт тот же файл. В вывод не попадает ни одно исходное
персональное значение — скрипт проверяет это перед записью.

ПРИМЕРЫ
  # фикстур листов: по 3 документа на игровую систему
  python3 make-fixture.py --source ../../../firebase-backup \
      --out examples/import-source.example.json --max-per-system 3

  # плюс auth-экспорт и синтетический Firestore-экспорт (бинарный фикстур)
  python3 make-fixture.py --source ../../../firebase-backup \
      --auth-export ../../../firebase-backup/auth-users.json \
      --out examples/import-source.example.json \
      --out-auth examples/auth-users.example.json \
      --binary-out examples/firestore-export --max-per-system 3

  # всё содержимое дампа (без ограничения по системам)
  python3 make-fixture.py --source <dump> --out /tmp/fixture.json --max-per-system 0
"""

import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import re
import struct
import sys
from pathlib import Path

# Скрипт запускают из рабочего дерева репозитория: не создаём __pycache__
# рядом с .py (в .gitignore он есть, но мусор в дереве всё равно мешает).
sys.dont_write_bytecode = True

# Поля, значения которых персональные или свободный текст: заменяются
# плейсхолдером, даже если выглядят как механика.
PLACEHOLDERS = {
    "name": "Example name",
    "notes": "Example note.",
    "description": "Example description.",
    "backstory": "Example backstory.",
    "divination": "Example divination.",
    "divinationEffect": "Example divination effect.",
    "quirk": "Example quirk.",
    "statNotes": "Example stat note.",
    "title": "Example quest.",
    "homeWorld": "Example world",
    "worldVariant": "Example variant",
    "rank": "Example rank",
    "characterClass": "Example class",
    "careerPath": "Example career",
    "advancedPath": "Example path",
    "alternatePath": "Example path",
    "background": "Example background",
    "alignment": "Example alignment",
    "race": "Example race",
    "eyeColor": "grey",
    "hairColor": "grey",
    "skinColor": "grey",
    "eyes": "grey",
    "hair": "grey",
    "skin": "grey",
    "age": "30",
    "height": "180",
    "weight": "75",
    "personalityTraits": "Example trait",
    "ideals": "Example ideal",
    "bonds": "Example bond",
    "flaws": "Example flaw",
    "featuresAndTraits": "Example feature",
    "otherProficienciesAndLanguages": "Example proficiency",
}

# Строковые поля-перечисления и механика: значения остаются как есть.
KEEP_KEYS = {
    "gameSystem",
    "edition",
    "type",
    "status",
    "quality",
    "mods",
    "damageType",
    "traits",
    "penetration",
    "range",
    "damage",
    "atkBonus",
    "reload",
    "rof",
    "size",
    "speed",
    "proficiencyBonus",
    "ability",
    "class",
    "spellcastingAbility",
    "spellAttackBonus",
    "spellAttackModifier",
    "spellSaveModifier",
    "spellSaveDifficulty",
    "hitDice",
    "hitDiceUsed",
    "inspiration",
    "hpTracking",
    "label",
    "createdAt",
    "updatedAt",
    "lastSignedInAt",
}

ID_KEYS = {"id"}
UID_KEYS = {"userId"}
# Домены старого приложения: мигратор их срезает, поэтому в фикстуре они
# остаются, чтобы этот путь тоже проверялся.
AUTH_EMAIL = "player%d@verse-scribe.app"

DICE_RE = re.compile(r"^\s*\d*\s*[dДдD]\s*\d+(\s*[+-]\s*\d+)?\s*([A-Za-zА-Яа-я]+)?\s*$")
NUMBER_RE = re.compile(r"^\s*\d+(\.\d+)?\s*$")

# Признаки, из-за которых документ попадает в фикстур: на них мигратор
# принимает разные решения (дефолты, конвертация старых атак, стат-апы).
INTERESTING_KEYS = (
    "attacks",
    "atkBonus",
    "companions",
    "multiclasses",
    "questLog",
    "statUpgrades",
    "spells",
    "inventory",
    "equipment",
    "talent",
)


def load_migrator():
    """Импортировать dcs-migrate.py из того же каталога."""
    path = Path(__file__).with_name("dcs-migrate.py")
    spec = importlib.util.spec_from_file_location("dcs_migrate", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def count_interesting(doc):
    text = json.dumps(doc, ensure_ascii=False)
    return sum(1 for key in INTERESTING_KEYS if '"%s"' % key in text)


class Redactor:
    """Детерминированные плейсхолдеры для id/uid и учёт замен."""

    def __init__(self):
        self.uids = {}
        self.ids = {}
        self.replaced = set()
        # Значения под KEEP_KEYS — правила игры («Common», «Melee»), а не
        # персональные данные, даже если тот же текст встретился в свободном поле.
        self.keep_values = set()

    def uid(self, firebase_uid):
        firebase_uid = str(firebase_uid)
        if firebase_uid not in self.uids:
            self.uids[firebase_uid] = "exampleUid%02d" % (len(self.uids) + 1)
            self.replaced.add(firebase_uid)
        return self.uids[firebase_uid]

    def doc_id(self, doc_id):
        doc_id = str(doc_id)
        if doc_id not in self.ids:
            self.ids[doc_id] = "exampleSheet%03d" % (len(self.ids) + 1)
            self.replaced.add(doc_id)
        return self.ids[doc_id]

    def value(self, key, value):
        if isinstance(value, str) and key in PLACEHOLDERS:
            self.replaced.add(value)
            return PLACEHOLDERS[key]
        return value


def walk(value, key, redactor):
    if isinstance(value, dict):
        redactor.keep_values.update(value)
        return {k: walk(v, k, redactor) for k, v in value.items()}
    if isinstance(value, list):
        return [walk(item, key, redactor) for item in value]
    if isinstance(value, str):
        if key in KEEP_KEYS:
            redactor.keep_values.add(value)
            return value
        if key in ID_KEYS:
            return redactor.doc_id(value)
        if key in UID_KEYS:
            return redactor.uid(value)
        if key == "avatar":
            redactor.replaced.add(value)
            return ""
        if key in PLACEHOLDERS:
            return redactor.value(key, value)
        if DICE_RE.match(value) or NUMBER_RE.match(value):
            return value
        # Неизвестное строковое поле: не рискуем оставлять как есть.
        redactor.replaced.add(value)
        return "Example text."


def select_docs(docs, max_per_system):
    """Оставить N самых «насыщенных» документов на каждую игровую систему."""
    by_system = {}
    for doc in docs:
        by_system.setdefault(doc["data"].get("gameSystem", ""), []).append(doc)
    chosen = []
    for system in sorted(by_system):
        items = sorted(
            by_system[system],
            key=lambda d: (-count_interesting(d["data"]), d["uid"], d["doc_id"]),
        )
        limit = len(items) if max_per_system <= 0 else max_per_system
        chosen.extend(items[:limit])
    return chosen


def build_fixture(docs, max_per_system):
    redactor = Redactor()
    picked = select_docs(docs, max_per_system)
    picked.sort(key=lambda d: (d["uid"], d["doc_id"]))
    out = []
    for doc in picked:
        data = walk(doc["data"], "", redactor)
        out.append(
            {
                "Document ID": "/users/%s/characterSheets/%s"
                % (redactor.uid(doc["uid"]), redactor.doc_id(doc["doc_id"])),
                **data,
            }
        )
    return out, redactor


def build_auth_fixture(path, redactor):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    users = payload.get("users", []) if isinstance(payload, dict) else payload
    out = []
    for index, user in enumerate(users, start=1):
        local_id = user.get("localId") or user.get("uid") or ""
        email = AUTH_EMAIL % index
        redactor.replaced.add(str(local_id))
        if user.get("email"):
            redactor.replaced.add(str(user["email"]))
        out.append(
            {
                "localId": redactor.uid(local_id),
                "email": email,
                "emailVerified": bool(user.get("emailVerified", True)),
                "passwordHash": hashlib.sha256(
                    ("example-password-%d" % index).encode("utf-8")
                ).hexdigest(),
                "salt": "exampleSalt%04d" % index,
                "displayName": "Player %d" % index,
                "lastSignedInAt": user.get("lastSignedInAt", ""),
                "createdAt": user.get("createdAt", ""),
                "providerUserInfo": [],
            }
        )
    return {"users": out}


def string_leaves(payload):
    """Все строковые значения в дереве (без ключей)."""
    found = set()

    def walk(value):
        if isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str):
            found.add(value)

    walk(payload)
    return found


def assert_clean(payload, redactor):
    """В фикстуре не должно остаться ни одного исходного значения."""
    leaves = string_leaves(payload)
    # Сравнение по целым значениям, а не по вхождению: короткие строки вроде
    # «ds» иначе находятся внутри любого слова.
    leaked = sorted(
        value
        for value in redactor.replaced
        if value
        and value not in redactor.keep_values
        and len(value) >= 2
        and any(ch.isalpha() for ch in value)
        and value in leaves
    )
    if leaked:
        sample = ", ".join(repr(item) for item in leaked[:5])
        raise SystemExit(
            "фикстур содержит исходные значения (%d), например: %s"
            % (len(leaked), sample)
        )


def dump_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


# ─── синтетический managed export: бинарный фикстур LevelDB ─────────────────
#
# JSON-фикстур проверяет только ветку `--source <file>.json`. Чтобы без
# реального дампа оставался проверяемым и парсер Firestore-экспорта (LevelDB-лог
# + protobuf EntityProto), тот же набор документов кодируется обратно в
# минимальный managed export: `<ts>.overall_export_metadata` и
# `all_namespaces/all_kinds/output-0`. Формат — тот, что разбирает
# `dcs-migrate.py` (entity_bytes.proto, raw_property/Property), а не полный
# datastore-экспорт во всех деталях.

LEVELDB_BLOCK = 32 * 1024
DEFAULT_EXPORT_NAME = "2026-11-01T13_44_42_60874"
EXPORT_NAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}_\d+$")


def _varint(value):
    if value < 0:
        value += 1 << 64
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def _tag(field, wire):
    return _varint((field << 3) | wire)


def _field_bytes(field, payload):
    return _tag(field, 2) + _varint(len(payload)) + payload


def _field_varint(field, value):
    return _tag(field, 0) + _varint(value)


def _encode_property_value(value, migrator):
    if isinstance(value, bool):  # bool раньше int: True тоже int
        return _field_varint(migrator.VAL_BOOL, 1 if value else 0)
    if isinstance(value, int):
        return _field_varint(migrator.VAL_INT64, value)
    if isinstance(value, float):
        return _tag(migrator.VAL_DOUBLE, 1) + struct.pack("<d", value)
    if isinstance(value, str):
        return _field_bytes(migrator.VAL_BYTES, value.encode("utf-8"))
    if value is None:
        return b""
    raise TypeError("не умею кодировать значение типа %r" % type(value))


def _name(x):
    return _field_bytes(3, x.encode("utf-8"))  # Property.name


def _encode_item(name, value, migrator):
    """Элемент массива: repeated Property с multiple=1."""
    base = _field_varint(4, 1) + _name(name)  # PROP_MULTIPLE, PROP_NAME
    if isinstance(value, dict):
        return (
            base
            + _field_varint(1, migrator.MEANING_ENTITY_PROTO)  # PROP_MEANING
            # PROP_VALUE -> PropertyValue.bytes -> вложенная Entity
            + _field_bytes(5, _field_bytes(3, _encode_entity(value, None, migrator)))
        )
    return base + _field_bytes(5, _encode_property_value(value, migrator))


def _encode_property(name, value, migrator):
    """Одно значение — Property; массив — несколько Property."""
    if isinstance(value, list):
        if not value:
            return [_field_varint(1, migrator.MEANING_EMPTY_LIST) + _name(name)]
        return [_encode_item(name, item, migrator) for item in value]
    if isinstance(value, dict):
        return [
            _field_varint(1, migrator.MEANING_ENTITY_PROTO)
            + _name(name)
            + _field_bytes(5, _field_bytes(3, _encode_entity(value, None, migrator)))
        ]
    return [_name(name) + _field_bytes(5, _encode_property_value(value, migrator))]


def _encode_key(parts):
    """Entity.key (Reference.path -> Path.element{type, name})."""
    path = b"".join(
        _field_bytes(
            1, _field_bytes(2, kind.encode()) + _field_bytes(4, ident.encode())
        )
        for kind, ident in parts
    )
    return _field_bytes(13, _field_bytes(14, path))


def _encode_entity(data, key_parts, migrator):
    out = bytearray()
    if key_parts:
        out += _encode_key(key_parts)
    for name, value in data.items():
        for prop in _encode_property(name, value, migrator):
            out += _field_bytes(migrator.ENTITY_PROPERTY, prop)
    return bytes(out)


def _crc32c(data):
    crc = 0xFFFFFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ 0x82F63B78 if crc & 1 else crc >> 1
    return crc ^ 0xFFFFFFFF


def _masked_crc32c(data):
    crc = _crc32c(data)
    rotated = ((crc >> 15) | ((crc << 17) & 0xFFFFFFFF)) & 0xFFFFFFFF
    return (rotated + 0xA282EAD8) & 0xFFFFFFFF


def _write_log(records, path, migrator):
    """Последовательность LevelDB-записей: FULL, часть — FIRST/LAST.

    Реальный managed export режет записи по 32-КБ блокам и добивает хвосты
    padding'ом; `dcs-migrate.py` читает заголовки подряд и границы блоков не
    отслеживает, поэтому фикстур пишется одной непрерывной лентой. Часть
    записей всё равно делится на FIRST/LAST, чтобы проверялась и склейка
    фрагментов.
    """
    out = bytearray()
    for index, record in enumerate(records):
        pieces = [(migrator.RECORD_FULL, record)]
        if index % 2 == 1 and len(record) > 64:
            middle = len(record) // 2
            pieces = [
                (migrator.RECORD_FIRST, record[:middle]),
                (migrator.RECORD_LAST, record[middle:]),
            ]
        for rtype, chunk in pieces:
            header = struct.pack(
                "<IHB",
                _masked_crc32c(bytes([rtype]) + chunk),
                len(chunk),
                rtype,
            )
            out += header + chunk
    Path(path).write_bytes(bytes(out))


def split_document(item):
    """Элемент фикстура -> (uid, doc_id, data) по «Document ID»."""
    ref = item["Document ID"]
    uid = ref.split("/users/", 1)[1].split("/", 1)[0]
    doc_id = ref.split("/characterSheets/", 1)[1]
    return uid, doc_id, {k: v for k, v in item.items() if k != "Document ID"}


def write_binary_export(destination, fixture, migrator, export_name):
    export_dir = Path(destination) / export_name
    kinds_dir = export_dir / "all_namespaces" / "all_kinds"
    kinds_dir.mkdir(parents=True, exist_ok=True)
    (export_dir / ("%s.overall_export_metadata" % export_name)).write_bytes(b"")
    records = []
    for item in fixture:
        uid, doc_id, data = split_document(item)
        records.append(
            _encode_entity(
                data, [("users", uid), ("characterSheets", doc_id)], migrator
            )
        )
    _write_log(records, kinds_dir / "output-0", migrator)
    return export_dir


def verify_roundtrip(export_dir, fixture, migrator):
    """Разобрать записанный экспорт тем же парсером и сравнить с JSON."""
    with contextlib.redirect_stdout(io.StringIO()):
        docs, _ = migrator.load_documents(str(export_dir))
    expected = []
    for item in fixture:
        uid, doc_id, data = split_document(item)
        expected.append({"uid": uid, "doc_id": doc_id, "data": data})
    got = [{"uid": d["uid"], "doc_id": d["doc_id"], "data": d["data"]} for d in docs]
    canon = sorted(
        json.dumps(entry, ensure_ascii=False, sort_keys=True) for entry in got
    )
    want = sorted(
        json.dumps(entry, ensure_ascii=False, sort_keys=True) for entry in expected
    )
    if canon != want:
        raise SystemExit(
            "бинарный фикстур не совпал с JSON после разбора (%d из %d документов)"
            % (len(canon), len(want))
        )
    return len(got)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--source", required=True, help="дамп (каталог/.7z/JSON)")
    parser.add_argument(
        "--max-per-system",
        type=int,
        default=3,
        help="сколько документов оставить на игровую систему (0 — все)",
    )
    parser.add_argument("--out", required=True, help="куда писать фикстур листов")
    parser.add_argument("--auth-export", help="auth-users.json (для фикстура логинов)")
    parser.add_argument("--out-auth", help="куда писать обезличенный auth-экспорт")
    parser.add_argument(
        "--binary-out",
        metavar="DIR",
        help="куда положить синтетический Firestore-экспорт (LevelDB-фикстур)",
    )
    parser.add_argument(
        "--export-name",
        default=DEFAULT_EXPORT_NAME,
        help="имя каталога экспорта внутри --binary-out (по умолчанию %s)"
        % DEFAULT_EXPORT_NAME,
    )
    args = parser.parse_args(argv)
    if bool(args.auth_export) != bool(args.out_auth):
        parser.error("--auth-export и --out-auth задаются вместе")

    migrator = load_migrator()
    docs, _ = migrator.load_documents(args.source)
    fixture, redactor = build_fixture(docs, args.max_per_system)
    assert_clean(fixture, redactor)
    dump_json(args.out, fixture)
    print(
        "→ листов в фикстуре: %d (систем: %d, аккаунтов: %d)"
        % (
            len(fixture),
            len({item.get("gameSystem") for item in fixture}),
            len(redactor.uids),
        )
    )

    if args.binary_out:
        export_dir = write_binary_export(
            args.binary_out, fixture, migrator, args.export_name
        )
        count = verify_roundtrip(export_dir, fixture, migrator)
        print(
            "→ бинарный экспорт: %s (%d документов, round-trip с JSON совпал)"
            % (export_dir, count)
        )

    if args.out_auth:
        auth_fixture = build_auth_fixture(args.auth_export, redactor)
        assert_clean(auth_fixture, redactor)
        dump_json(args.out_auth, auth_fixture)
        print("→ аккаунтов в auth-фикстуре: %d" % len(auth_fixture["users"]))

    print("Заменено исходных значений: %d" % len(redactor.replaced))


if __name__ == "__main__":
    main()
