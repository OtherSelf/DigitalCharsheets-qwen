#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dcs-migrate.py — перенос листов персонажей из старых бэкапов (Firebase/Firestore)
в файловую структуру новой версии Digital Character Sheets.

ЧТО ДЕЛАЕТ
  * читает бэкап Firestore (managed export: .7z / каталог с файлами `output-*`)
    либо JSON-массив (старый формат `data/import-source.json`);
  * достаёт документы вида users/<firebase-uid>/characterSheets/<doc-id>;
  * приводит их к структуре новой версии (src/lib/types.ts): DnD5eCharacter /
    DarkHeresyCharacter, дополняя отсутствующие обязательные поля значениями
    по умолчанию (в старых данных их может не быть);
  * создаёт локальные аккаунты так же, как это делает сервер новой версии:
    каталог data/users/<uid>/, user.json (schemaVersion 4, неизменяемый uid,
    scrypt-хеш пароля в формате приложения, логин отдельным полем);
  * из логинов убирает домены старого приложения: @verse-scribe.app
    (petya@verse-scribe.app -> petya) и @local.charsheets из шаблона
    (imported-ab12cd@local.charsheets -> imported-ab12cd). Полный e-mail
    сохраняется в user.json (migratedFromEmail) и в отчёте (firebaseEmail);
  * пишет листы в data/users/<uid>/characters/<id>.json (в каждом листе
    userId = uid владельца — как и у листов, созданных приложением);
  * собирает/дополняет индекс логинов data/index/logins.json (логин → uid).

  uid здесь — UUIDv5 от firebase-uid (стабильный между прогонами, чтобы --force
  не плодил дубликаты). В самом приложении uid случайный: логин и личность
  развязаны, смена логина не переносит каталог.

  Итог — можно сразу логиниться в новой версии теми логинами/паролями,
  которые напечатает скрипт.

  --source понимает:
    * каталог с бэкапами, как на сервере: /opt/backup/<timestamp>_<id>/ (внутри
      all_namespaces/... ) — можно указать и сам /opt/backup, и один экспорт;
    * .7z с таким же деревом (нужен 7z/py7zr);
    * JSON-массив (старый import-source.json).

ПРИМЕРЫ
  # что вообще есть в бэкапах (дата, размер, сколько листов/аккаунтов)
  ./dcs-migrate.py --source /opt/backup --list

  # сухой прогон самого свежего экспорта
  ./dcs-migrate.py --source /opt/backup --data-dir /opt/dcs-dev/data --dry-run

  # миграция (пустой каталог данных, пароль по умолчанию 1234)
  ./dcs-migrate.py --source /opt/backup --data-dir /opt/dcs-dev/data \
      --report /opt/backup/migration-report.json

  # конкретный старый бэкап или все сразу (новые перекрывают старые —
  # так можно поднять персонажей, которых позже удалили)
  ./dcs-migrate.py --source /opt/backup --export 2026-05-16 --data-dir ./data --force
  ./dcs-migrate.py --source /opt/backup --all --data-dir ./data --force

  # свои имена аккаунтов и случайные пароли
  ./dcs-migrate.py --source /opt/backup --data-dir ./data \
      --map users.json --random-passwords --report migration-report.json

  users.json: {"<firebase-uid>": "petya", "<firebase-uid2>": "vasya"}

ТРЕБОВАНИЯ
  Python 3.8+ (только стандартная библиотека).
  Распакованный каталог бэкапа — вообще без зависимостей.
  Только для .7z нужен один из: 7z / 7za / 7zr / bsdtar / python-пакет py7zr.

ПРОВЕРКА СОВМЕСТИМОСТИ
  ./dcs-migrate-check.py --data-dir <data> --types <...>/src/lib/types.ts
  сверяет записанные JSON с ТЕКУЩИМИ типами профиля: обязательные поля,
  типы значений, data/users/<uid>/, индекс логинов, passwordHash (scrypt
  приложения или легаси-sha256).

ФОРМАТ БЭКАПА (использовано при разборе)
  Firestore managed export — это LevelDB-лог (doc/log_format.md):
  заголовок <crc32c:4><length:2><type:1>, записи FULL/FIRST/MIDDLE/LAST;
  внутри — App Engine EntityProto (entity_bytes.proto): Property{name=3,
  meaning=1, multiple=4, value=5}, PropertyValue{int64=1, bool=2, bytes=3,
  double=4}, значения ENTITY_PROTO(19) и EMPTY_LIST(24). Ключ документа —
  Reference{path=14 -> Path{element=1 (group){type=2,id=3,name=4}}}.
"""

import argparse
import base64
import csv
import datetime
import hashlib
import json
import os
import random
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

# ─────────────────────────── разбор LevelDB-лога ────────────────────────────

BLOCK_SIZE = 32 * 1024
LOG_HEADER = struct.Struct("<IHB")
RECORD_FULL, RECORD_FIRST, RECORD_MIDDLE, RECORD_LAST = 1, 2, 3, 4


def iter_log_records(path):
    """Итерируется по логическим записям LevelDB-лога."""
    with open(path, "rb") as fh:
        data = fh.read()
    pos, pending = 0, None
    total = len(data)
    while pos + LOG_HEADER.size <= total:
        _crc, length, rtype = LOG_HEADER.unpack_from(data, pos)
        pos += LOG_HEADER.size
        if rtype == 0:  # нулевой хедер — padding до границы блока
            continue
        chunk = data[pos : pos + length]
        pos += length
        if rtype == RECORD_FULL:
            yield chunk
        elif rtype == RECORD_FIRST:
            pending = chunk
        elif rtype == RECORD_MIDDLE:
            pending = (pending or b"") + chunk
        elif rtype == RECORD_LAST:
            yield (pending or b"") + chunk
            pending = None


# ───────────────────────────── protobuf-минимум ─────────────────────────────


def _varint(buf, i):
    shift = result = 0
    while True:
        b = buf[i]
        i += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, i
        shift += 7


def parse_fields(buf):
    """Разбирает protobuf-сообщение в список (field_no, wire, value).

    Поддерживает varint/64/len/группы(3,4)/32 — этого достаточно для EntityProto.
    """
    fields, _ = _parse_fields(buf, 0, None)
    return fields


def _parse_fields(buf, i, end_field):
    out = []
    n = len(buf)
    while i < n:
        key, i = _varint(buf, i)
        fnum, wire = key >> 3, key & 7
        if wire == 0:
            val, i = _varint(buf, i)
        elif wire == 1:
            val, i = buf[i : i + 8], i + 8
        elif wire == 2:
            ln, i = _varint(buf, i)
            val, i = buf[i : i + ln], i + ln
        elif wire == 3:  # start group (в Reference.path)
            val, i = _parse_fields(buf, i, fnum)
        elif wire == 4:  # end group
            return out, i
        elif wire == 5:
            val, i = buf[i : i + 4], i + 4
        else:
            raise ValueError("неподдерживаемый wire type %s (field %s)" % (wire, fnum))
        out.append((fnum, wire, val))
    return out, i


def _first(fields, num, default=None):
    for f, _w, v in fields:
        if f == num:
            return v
    return default


def _all(fields, num):
    return [v for f, _w, v in fields if f == num]


def _int64(value):
    """unsigned varint -> signed int64."""
    return value - (1 << 64) if value >= (1 << 63) else value


# Field numbers из google/appengine/datastore/entity_bytes.proto
ENTITY_KEY, ENTITY_PROPERTY, ENTITY_RAW_PROPERTY = 13, 14, 15
PROP_MEANING, PROP_NAME, PROP_MULTIPLE, PROP_VALUE = 1, 3, 4, 5
VAL_INT64, VAL_BOOL, VAL_BYTES, VAL_DOUBLE = 1, 2, 3, 4
MEANING_ENTITY_PROTO, MEANING_EMPTY_LIST = 19, 24


def decode_document_key(buf):
    """Reference -> [(type, id_or_name), ...] — путь документа."""
    ref = parse_fields(buf)
    path = _first(ref, 14)
    elements = []
    if path:
        for element in _all(parse_fields(path), 1):  # Path.element — группа
            ef = element if isinstance(element, list) else parse_fields(element)
            name = (_first(ef, 4, b"") or b"").decode("utf-8", "replace")
            ident = _first(ef, 3, 0)
            elements.append(
                (
                    (_first(ef, 2, b"") or b"").decode("utf-8", "replace"),
                    name if name else str(ident),
                )
            )
    return elements


def _decode_property_value(pv_fields):
    raw = _first(pv_fields, VAL_BYTES)
    if raw is not None:
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return {"__bytes__": base64.b64encode(raw).decode("ascii")}
    num = _first(pv_fields, VAL_INT64)
    if num is not None:
        return _int64(num)
    dbl = _first(pv_fields, VAL_DOUBLE)
    if dbl is not None:
        return struct.unpack("<d", dbl)[0]
    flag = _first(pv_fields, VAL_BOOL)
    if flag is not None:
        return bool(flag)
    return None


def decode_entity(buf):
    """EntityProto -> {имя_поля: значение} (map'ы — dict, массивы — list)."""
    ef = parse_fields(buf)
    out = {}
    for raw_prop in _all(ef, ENTITY_RAW_PROPERTY) + _all(ef, ENTITY_PROPERTY):
        pf = parse_fields(raw_prop)
        name = (_first(pf, PROP_NAME, b"") or b"").decode("utf-8", "replace")
        if not name:
            continue
        meaning = _first(pf, PROP_MEANING, 0)
        multiple = bool(_first(pf, PROP_MULTIPLE, 0))
        pv = parse_fields(_first(pf, PROP_VALUE, b""))

        if meaning == MEANING_EMPTY_LIST:
            out[name] = []
            continue
        if meaning == MEANING_ENTITY_PROTO:
            inner = decode_entity(_first(pv, VAL_BYTES, b""))
            if multiple:
                cur = out.get(name)
                if isinstance(cur, list):
                    cur.append(inner)
                else:
                    out[name] = [inner]
            else:
                out[name] = inner
            continue

        value = _decode_property_value(pv)
        if multiple:
            cur = out.get(name)
            if isinstance(cur, list):
                cur.append(value)
            elif cur is None:
                out[name] = [value]
            else:  # mixed: сначала одиночное значение
                out[name] = [cur, value]
        else:
            out[name] = value
    return out


# ───────────────────────── источник: .7z / каталог / JSON ────────────────────


def _seven_zip_extract(archive, dest):
    """Распаковывает .7z через внешний 7z/bsdtar или py7zr. Возвращает True/False."""
    for candidate, args in (
        ("7z", ["7z", "x", "-y", "-o" + dest, archive]),
        ("7za", ["7za", "x", "-y", "-o" + dest, archive]),
        ("7zr", ["7zr", "x", "-y", "-o" + dest, archive]),
        ("bsdtar", ["bsdtar", "-xf", archive, "-C", dest]),
    ):
        exe = shutil.which(candidate)
        if not exe:
            continue
        proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        if proc.returncode == 0:
            return True
        print(
            "  ! %s не смог распаковать архив: %s"
            % (candidate, proc.stdout.decode("utf-8", "replace")[:300]),
            file=sys.stderr,
        )
    try:
        import py7zr  # опционально
    except ImportError:
        return False
    with py7zr.SevenZipFile(archive, "r") as zf:
        zf.extractall(dest)
    return True


def find_export_files(root):
    """Ищет файлы output-* в распакованном Firestore-экспорте."""
    root = Path(root)
    files = sorted(p for p in root.rglob("output-*") if p.is_file())
    if not files:
        # вдруг это отдельный файл без имени output-N
        files = sorted(
            p
            for p in root.rglob("*")
            if p.is_file() and p.stat().st_size > 0 and "export_metadata" not in p.name
        )
    return files


def is_export_dir(path):
    """Похож ли каталог на распакованный Firestore-экспорт."""
    path = Path(path)
    if not path.is_dir():
        return False
    if any(path.glob("*.overall_export_metadata")):
        return True
    if (path / "all_namespaces").is_dir():
        return True
    return bool(find_export_files(path))


def _export_sort_key(path):
    """Сортировка экспортов по времени из имени каталога (иначе по mtime)."""
    match = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})", path.name)
    if match:
        try:
            stamp = datetime.datetime.fromisoformat(match.group(1))
            return (stamp.replace(tzinfo=datetime.timezone.utc).timestamp(), path.name)
        except ValueError:
            pass
    try:
        return (path.stat().st_mtime, path.name)
    except OSError:
        return (0.0, path.name)


def discover_export_dirs(root):
    """Список экспортов в каталоге: /opt/backup/<timestamp> или сам экспорт."""
    root = Path(root)
    if is_export_dir(root) and not _looks_like_export_container(root):
        return [root]
    dirs = [p for p in root.iterdir() if p.is_dir() and is_export_dir(p)]
    if dirs:
        return sorted(dirs, key=_export_sort_key)
    if is_export_dir(root):
        return [root]
    return []


def _looks_like_export_container(path):
    """Каталог-контейнер (например /opt/backup) против одного экспорта."""
    path = Path(path)
    if any(path.glob("*.overall_export_metadata")):
        return False
    if (path / "all_namespaces").is_dir() or (path / "output-0").is_file():
        return False
    children = [p for p in path.iterdir() if p.is_dir() and is_export_dir(p)]
    return bool(children)


def parse_export_dir(export_dir, verbose=True):
    """Все документы characterSheets из одного распакованного экспорта."""
    files = find_export_files(export_dir)
    docs = []
    for path in files:
        if verbose:
            print("→ Разбираю %s" % path)
        try:
            records = list(iter_log_records(str(path)))
        except Exception as exc:  # noqa: BLE001
            print("  ! пропускаю %s: %s" % (path, exc), file=sys.stderr)
            continue
        for record in records:
            try:
                fields = parse_fields(record)
                key = _first(fields, ENTITY_KEY)
                path_parts = decode_document_key(key) if key else []
                data = decode_entity(record)
            except Exception as exc:  # noqa: BLE001
                print("  ! битая запись (пропущена): %s" % exc, file=sys.stderr)
                continue
            if not data:
                continue
            uid = doc_id = None
            for idx, (kind, ident) in enumerate(path_parts):
                if kind == "users" and idx + 1 < len(path_parts):
                    uid = ident
                if kind == "characterSheets":
                    doc_id = ident
            if not uid or not doc_id:
                continue
            docs.append({"uid": uid, "doc_id": doc_id, "data": data})
    return docs


def select_exports(export_dirs, select):
    """Выбирает экспорт(ы) по --export / --all / newest."""
    if not export_dirs:
        return []
    dirs = sorted(export_dirs, key=_export_sort_key)
    select = (select or "newest").strip()
    if select == "all":
        return dirs
    if select in ("newest", "latest", "last", ""):
        return [dirs[-1]]
    exact = [d for d in dirs if d.name == select]
    if exact:
        return exact
    prefix = [d for d in dirs if d.name.startswith(select)]
    if len(prefix) == 1:
        return prefix
    if len(prefix) > 1:
        raise SystemExit(
            "Неоднозначный --export %r, подходит несколько:\n  %s"
            % (select, "\n  ".join(d.name for d in prefix))
        )
    raise SystemExit(
        "Экспорт %r не найден. Доступны:\n  %s"
        % (select, "\n  ".join(d.name for d in dirs))
    )


def load_documents(source, select="newest", list_only=False):
    """Возвращает (documents, info). Document = {'uid','doc_id','data'}.

    source: .7z / каталог-экспорт / каталог с несколькими экспортами / JSON-массив.
    list_only: вернуть (None, {'dirs': [...]}) — для --list.
    """
    src = Path(source).expanduser()
    if not src.exists():
        raise SystemExit("Нет такого источника: %s" % src)

    tmpdir = None
    try:
        if src.is_file() and src.suffix.lower() == ".json":
            with open(src, encoding="utf-8") as fh:
                payload = json.load(fh)
            return _documents_from_json(payload), {"text": "JSON-массив: %s" % src}

        workdir = src
        if src.is_file():
            print("→ Распаковываю %s" % src)
            tmpdir = tempfile.mkdtemp(prefix="dcs-migrate-")
            if not _seven_zip_extract(str(src), tmpdir):
                raise SystemExit(
                    "Не удалось распаковать %s.\n"
                    "Поставьте p7zip (apt-get install -y p7zip-full), bsdtar (libarchive-tools) "
                    "или python-пакет py7zr (pip install py7zr), либо распакуйте вручную и "
                    "передайте каталог в --source." % src
                )
            workdir = Path(tmpdir)

        export_dirs = discover_export_dirs(workdir)
        if not export_dirs:
            raise SystemExit(
                "В %s не найдено ни одного экспорта Firestore "
                "(нет ни *.overall_export_metadata, ни all_namespaces/output-*)."
                % workdir
            )

        if list_only:
            print_exports_table(export_dirs)  # до удаления tmpdir (для .7z)
            return None, {"listed": True}

        chosen = select_exports(export_dirs, select)
        print(
            "→ Экспортов в источнике: %d, буду использовать: %d (%s)"
            % (len(export_dirs), len(chosen), ", ".join(d.name for d in chosen))
        )

        merged = {}
        order = []
        for export_dir in chosen:
            docs = parse_export_dir(export_dir, verbose=len(chosen) > 1)
            print("  %s: документов %d" % (export_dir.name, len(docs)))
            for doc in docs:
                key = (doc["uid"], doc["doc_id"])
                if key not in merged:
                    order.append(key)
                merged[key] = doc  # более новый экспорт перекрывает старый

        docs = [merged[key] for key in order]
        return docs, {
            "text": "экспортов: %d из %d" % (len(chosen), len(export_dirs)),
            "chosen": [d.name for d in chosen],
            "all": len(export_dirs),
        }
    finally:
        if tmpdir:
            shutil.rmtree(tmpdir, ignore_errors=True)


def _documents_from_json(payload):
    """Поддержка старого формата: массив объектов (возможно, с 'Document ID')."""
    if isinstance(payload, dict):
        payload = payload.get("documents") or payload.get("items") or []
    docs = []
    for idx, item in enumerate(payload):
        if not isinstance(item, dict):
            continue
        data = dict(item)
        ref = data.pop("Document ID", None) or data.pop("documentId", None)
        uid = data.pop("userId", None)
        doc_id = None
        if isinstance(ref, str):
            match = re.search(r"/users/([^/]+)/characterSheets/([^/]+)", ref)
            if match:
                uid, doc_id = match.group(1), match.group(2)
        if not uid:
            uid = "imported-%03d" % idx
        if not doc_id:
            doc_id = "migrated-%03d" % idx
        docs.append({"uid": uid, "doc_id": doc_id, "data": data})
    return docs


# ─────────────────── совместимость с новой версией приложения ────────────────


def load_auth_export(path):
    """`firebase auth:export users.json` -> {uid: {email, displayName, phone, disabled}}.

    Нужен, когда в Firebase-проекте ещё есть доступ: тогда настоящие логины (e-mail)
    и имена подтягиваются автоматически. Сам Firestore-экспорт этих данных НЕ
    содержит — в нём только uid.
    """
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    users = payload.get("users") if isinstance(payload, dict) else payload
    if not isinstance(users, list):
        raise SystemExit(
            '%s не похож на auth-экспорт: ожидался JSON вида {"users": [...]}' % path
        )
    result = {}
    for user in users:
        if not isinstance(user, dict):
            continue
        uid = user.get("localId") or user.get("uid") or user.get("userUid")
        if not uid:
            continue
        result[str(uid)] = {
            "email": _as_str(user.get("email")).strip(),
            "displayName": _as_str(user.get("displayName")).strip(),
            "phone": _as_str(user.get("phoneNumber")).strip(),
            "disabled": bool(user.get("disabled")),
        }
    return result


UID_NAMESPACE = uuid.UUID("6f1c2a4e-8b7d-5f0a-9e3c-2d4b6a8c0e1f")

# Профиль пишем сразу в текущем формате приложения (src/lib/user-schema.ts):
# сервер умеет нормализовать старый, но канонический вид не требует
# перезаписи user.json при первом чтении.
USER_SCHEMA_VERSION = 4
# Политика приложения (src/lib/security/password.ts): при задании пароля
# меньше 12 символов сервер откажет. Вход длину не проверяет, поэтому
# миграция не блокируется, но значение по умолчанию об этом предупреждает.
MIN_PASSWORD_LENGTH = 12
# scrypt-параметры и формат — как в src/lib/security/scrypt.ts.
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_SALT_LENGTH = 16
SCRYPT_KEY_LENGTH = 32


# Домены старого приложения, которые в локальных логинах не нужны:
#   • Firebase-e-mail вида <login>@verse-scribe.app;
#   • служебный шаблон imported-<uid6>@local.charsheets (аккаунты без auth-экспорта).
# В локальном приложении логин — просто ключ, домен в нём лишний.
LOGIN_DOMAINS_TO_STRIP = ("@verse-scribe.app", "@local.charsheets")


def strip_login_domains(login):
    """petya@verse-scribe.app -> petya; imported-ab12cd@local.charsheets -> imported-ab12cd."""
    for domain in LOGIN_DOMAINS_TO_STRIP:
        if login.endswith(domain):
            return login[: -len(domain)] or login
    return login


def local_uid_for(firebase_uid):
    """Стабильный uid для импортированного аккаунта.

    UUIDv5 от firebase-uid, а НЕ от логина: смена логина больше не меняет
    каталог. Стабильность нужна самому скрипту — повторный прогон с --force
    перезаписывает те же каталоги, а не создаёт дубликаты.
    """
    return str(uuid.uuid5(UID_NAMESPACE, "firebase:" + str(firebase_uid)))


def scrypt_hash(password):
    """Пароль в формате приложения: scrypt$N$r$p$<salt>$<hash> (base64url, без `=`).

    Параметры и формат дублируют `src/lib/security/scrypt.ts`: сервер разбирает
    их из самой строки. Несолёный sha256 он читает только как легаси и
    перезаписывает при первом успешном входе.
    """
    salt = os.urandom(SCRYPT_SALT_LENGTH)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_KEY_LENGTH,
    )

    def b64(raw):
        # base64url без паддинга — так же кодирует Node (Buffer#toString('base64url')).
        return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

    return "scrypt$%d$%d$%d$%s$%s" % (
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        b64(salt),
        b64(derived),
    )


def now_iso():
    """UTC-время в формате ISO-8601 с Z (без устаревшего utcnow())."""
    return (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0, tzinfo=None)
        .isoformat()
        + "Z"
    )


def base_object(name, system):
    return {
        "id": "",
        "name": name or "Без имени",
        "characterClass": "",
        "gameSystem": system,
        "backstory": "",
        "notes": "",
        "questLog": [],
    }


def dnd_defaults():
    """Обязательные поля DnD5eCharacter (см. src/lib/types.ts)."""
    return {
        "level": 1,
        "race": "",
        "background": "",
        "alignment": "",
        "experiencePoints": 0,
        "inspiration": "0",
        "proficiencyBonus": 2,
        "stats": {
            "strength": 10,
            "dexterity": 10,
            "constitution": 10,
            "intelligence": 10,
            "wisdom": 10,
            "charisma": 10,
        },
        "statNotes": {},
        "savingThrows": [],
        "skills": [],
        "armorClass": 10,
        "speed": 30,
        "hitPoints": {"current": 0, "max": 0},
        "temporaryHitPoints": 0,
        "hitDice": "",
        "hitDiceUsed": {},
        "deathSaves": {"successes": 0, "failures": 0},
        "otherProficienciesAndLanguages": [],
        "attacks": [],
        "personalityTraits": [],
        "ideals": [],
        "bonds": [],
        "flaws": [],
        "featuresAndTraits": [],
        "equipment": [],
        "currency": {"cp": 0, "sp": 0, "ep": 0, "gp": 0, "pp": 0},
        "inventory": [],
        "spells": [],
        "spellSlots": {str(i): {"max": 0, "current": 0} for i in range(1, 10)},
        "isMulticlass": False,
        "multiclasses": [],
        "divineBoons": [],
        "attunementItems": [],
        "combatResources": [],
        "companions": [],
        "spellcastingEntries": [],
    }


def dh_defaults():
    """Обязательные поля DarkHeresyCharacter (см. src/lib/types.ts)."""
    stats = [
        "weaponSkill",
        "ballisticSkill",
        "strength",
        "toughness",
        "agility",
        "intelligence",
        "perception",
        "willpower",
        "fellowship",
        "influence",
    ]
    return {
        "edition": "1st",
        "homeWorld": "",
        "worldVariant": "",
        "careerPath": "",
        "rank": "",
        "divination": "",
        "divinationEffect": "",
        "quirk": "",
        "height": "",
        "weight": "",
        "age": "",
        "skinColor": "",
        "hairColor": "",
        "eyeColor": "",
        "experience": 0,
        "totalExpSpent": 0,
        "alternatePath": None,
        "advancedPath": None,
        "stats": {k: 30 for k in stats},
        "statUpgrades": {k: [False, False, False, False] for k in stats},
        "statNotes": {},
        "wounds": {"current": 0, "max": 0, "notes": ""},
        "fatePoints": {"current": 0, "max": 0, "notes": ""},
        "insanityPoints": {"total": 0, "notes": ""},
        "corruptionPoints": {"total": 0, "notes": ""},
        "wealth": {"throneGelt": 0, "monthlyIncome": 0, "notes": ""},
        "movement": {"walkHalf": 0, "walkFull": 0, "charge": 0, "run": 0},
        "equipment": {
            "armor": {
                part: None
                for part in (
                    "Head",
                    "Right arm",
                    "Body",
                    "Left arm",
                    "Right leg",
                    "Left leg",
                )
            },
            "weapons": {"melee": [], "ranged": []},
        },
        "inventory": [],
        "skills": [],
        "talents": [],
        "fatigue1st": {"current": 0, "notes": ""},
        "fatigue2nd": {"current": 0, "notes": ""},
        "criticalConditions": [],
    }


def _as_int(value, default=0):
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value.strip().replace(",", ".")))
        except (ValueError, AttributeError):
            return default
    return default


def _as_str(value, default=""):
    if value is None:
        return default
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "1" if value else "0"
    return str(value)


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _as_dict(value):
    return value if isinstance(value, dict) else {}


def normalize(numbered_value, defaults):
    """Рекурсивно: defaults ← старые данные (с приведением типов по defaults)."""
    if isinstance(defaults, dict):
        out = dict(defaults)
        for key, val in _as_dict(numbered_value).items():
            template = defaults.get(key)
            if template is None and key not in defaults:
                out[key] = val  # незнакомое поле — как есть
            else:
                out[key] = normalize(val, template)
        return out
    if isinstance(defaults, list):
        items = _as_list(numbered_value)
        if not items:
            return []
        if defaults and isinstance(defaults[0], dict):
            return [
                normalize(item, defaults[0]) for item in items if isinstance(item, dict)
            ]
        return items
    if isinstance(defaults, bool):
        value = (
            bool(numbered_value)
            if not isinstance(numbered_value, str)
            else numbered_value.strip().lower() in ("1", "true", "yes", "да")
        )
        return value
    if isinstance(defaults, int):
        return _as_int(numbered_value, defaults)
    if isinstance(defaults, float):
        try:
            return float(numbered_value)
        except (TypeError, ValueError):
            return defaults
    if isinstance(defaults, str):
        text = _as_str(numbered_value, defaults)
        if defaults == "0" and isinstance(numbered_value, (int, float, bool)):
            return _as_str(numbered_value, defaults)
        return text
    return numbered_value if numbered_value is not None else defaults


def _id_for(item, prefix):
    ident = _as_str(item.get("id")).strip()
    if ident:
        return ident
    return "%s-%s" % (
        prefix,
        hashlib.md5(
            json.dumps(item, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()[:10],
    )


def _merge(item, defaults):
    """defaults <- item, с сохранением «лишних» полей старых версий."""
    out = dict(defaults)
    for key, value in item.items():
        if key in defaults:
            template = defaults[key]
            if isinstance(template, bool):
                out[key] = bool(value)
            elif isinstance(template, int):
                out[key] = _as_int(value, template)
            elif isinstance(template, str):
                out[key] = _as_str(value, template)
            else:
                out[key] = value
        else:
            out[key] = value
    return out


DICE_RE = re.compile(r"\s*(\d*\s*[dДдD]\s*\d+)\s*([+-]\s*\d+)?\s*(.*)$")


def _split_damage(raw):
    """'1d8+5 P' -> ('1d8', '+5', 'P'); не распознанное — как есть в dice."""
    text = _as_str(raw).strip()
    match = DICE_RE.match(text)
    if not match:
        return (text or "1d6"), "+0", ""
    dice = re.sub(r"\s+", "", match.group(1)).lower()
    modifier = re.sub(r"\s+", "", match.group(2) or "+0") or "+0"
    rest = (match.group(3) or "").strip()
    return dice, modifier, rest


def fix_items(char):
    """Достраивает поля предметов/атак под актуальные типы (src/lib/types.ts)."""
    if char["gameSystem"] == "Dungeons & Dragons":
        attacks = []
        for atk in _as_list(char.get("attacks")):
            if not isinstance(atk, dict):
                continue
            item = _merge(
                atk,
                {
                    "id": "",
                    "name": "",
                    "ability": "none",
                    "useProficiencyBonus": False,
                    "damageDice": "",
                    "damageModifier": "+0",
                    "notes": "",
                },
            )
            item["id"] = _id_for(atk, "atk")
            notes = _as_str(item.get("notes")).strip()
            if not _as_str(atk.get("damageDice")).strip():
                dice, modifier, rest = _split_damage(
                    atk.get("damageType") or atk.get("damage")
                )
                item["damageDice"] = dice
                item["damageModifier"] = modifier
                bits = []
                if rest:
                    bits.append("тип урона: %s" % rest)
                if atk.get("atkBonus"):
                    bits.append("бонус атаки (старый): %s" % atk["atkBonus"])
                if bits:
                    item["notes"] = "; ".join(bits + ([notes] if notes else []))
            attacks.append(item)
        char["attacks"] = attacks

        char["spells"] = [
            _merge(sp, {"id": "", "name": "", "level": 0, "notes": ""})
            for sp in _as_list(char.get("spells"))
            if isinstance(sp, dict)
        ]
        for spell in char["spells"]:
            spell["id"] = _id_for(spell, "spell")

        char["savingThrows"] = [
            _merge(st, {"name": "", "proficient": False, "value": 0})
            for st in _as_list(char.get("savingThrows"))
            if isinstance(st, dict)
        ]
        char["skills"] = [
            _merge(
                sk,
                {
                    "name": "",
                    "label": "",
                    "proficient": False,
                    "expertise": False,
                    "value": 0,
                },
            )
            for sk in _as_list(char.get("skills"))
            if isinstance(sk, dict)
        ]
    else:
        stats = [
            "weaponSkill",
            "ballisticSkill",
            "strength",
            "toughness",
            "agility",
            "intelligence",
            "perception",
            "willpower",
            "fellowship",
            "influence",
        ]
        upgrades = _as_dict(char.get("statUpgrades"))
        fixed_upgrades = {}
        for stat in stats:
            raw = _as_list(upgrades.get(stat))
            flags = [bool(x) for x in raw][:4]
            flags += [False] * (4 - len(flags))
            fixed_upgrades[stat] = flags
        for stat, value in upgrades.items():
            if stat not in fixed_upgrades:
                fixed_upgrades[stat] = [bool(x) for x in _as_list(value)][:4]
        char["statUpgrades"] = fixed_upgrades

        equipment = _as_dict(char.get("equipment"))
        armor_in = _as_dict(equipment.get("armor"))
        armor = {}
        for part in ("Head", "Right arm", "Body", "Left arm", "Right leg", "Left leg"):
            piece = armor_in.get(part)
            armor[part] = (
                None
                if not isinstance(piece, dict)
                else _merge(piece, {"ap": 0, "type": "", "mods": "", "quality": ""})
            )
        weapons_in = _as_dict(equipment.get("weapons"))
        weapons = {}
        for kind, prefix in (("melee", "melee"), ("ranged", "ranged")):
            items = []
            for weapon in _as_list(weapons_in.get(kind)):
                if not isinstance(weapon, dict):
                    continue
                item = _merge(
                    weapon,
                    {
                        "id": "",
                        "name": "",
                        "type": "",
                        "range": "",
                        # у RangedWeapon нет penetration (это поле MeleeWeapon);
                        # если оно было в старых данных — _merge сохранит его.
                        "damage": "",
                        "traits": "",
                        "equipped": False,
                        "notes": "",
                    },
                )
                item["id"] = _id_for(weapon, prefix)
                items.append(item)
            weapons[kind] = items
        char["equipment"] = {"armor": armor, "weapons": weapons}

        skills = []
        for skill in _as_list(char.get("skills")):
            if not isinstance(skill, dict):
                continue
            item = _merge(skill, {"id": "", "name": "", "notes": "", "type": "basic"})
            item["id"] = _id_for(skill, "skill")
            if item.get("type") not in ("basic", "advanced"):
                item["type"] = "basic"
            training = _as_dict(skill.get("training"))
            item["training"] = {
                "skilled": bool(training.get("skilled")),
                "plus10": bool(training.get("plus10")),
                "plus20": bool(training.get("plus20")),
                "plus30": bool(training.get("plus30")),
            }
            skills.append(item)
        char["skills"] = skills

        char["talents"] = [
            _merge(tl, {"id": "", "name": "", "notes": ""})
            for tl in _as_list(char.get("talents"))
            if isinstance(tl, dict)
        ]
        for talent in char["talents"]:
            talent["id"] = _id_for(talent, "talent")

    char["inventory"] = [
        _merge(item, {"id": "", "name": "", "status": "default", "notes": ""})
        for item in _as_list(char.get("inventory"))
        if isinstance(item, dict)
    ]
    for item in char["inventory"]:
        item["id"] = _id_for(item, "inv")
        if item.get("status") not in ("default", "lost"):
            item["status"] = "default"

    if char["gameSystem"] == "Dungeons & Dragons":
        char["equipment"] = [
            _merge(item, {"id": "", "name": "", "status": "default", "notes": ""})
            for item in _as_list(char.get("equipment"))
            if isinstance(item, dict)
        ]
        for item in char["equipment"]:
            item["id"] = _id_for(item, "eq")
            if item.get("status") not in ("default", "lost"):
                item["status"] = "default"

    stamp = now_iso()
    quests = []
    for quest in _as_list(char.get("questLog")):
        if not isinstance(quest, dict):
            continue
        item = _merge(
            quest,
            {
                "id": "",
                "title": "",
                "status": "active",
                "description": "",
                "createdAt": stamp,
                "updatedAt": stamp,
            },
        )
        item["id"] = _id_for(quest, "quest")
        if item.get("status") not in ("active", "completed"):
            item["status"] = "active"
        quests.append(item)
    char["questLog"] = quests
    return char


def convert_character(doc, uid):
    """Документ из Firestore -> объект персонажа новой версии."""
    data = {k: v for k, v in doc["data"].items() if k not in ("userId", "id", "_key")}
    system = (data.get("gameSystem") or "").strip()

    if system == "Dark Heresy":
        defaults = dict(base_object(_as_str(data.get("name")), "Dark Heresy"))
        defaults.update(dh_defaults())
        char = normalize(data, defaults)
        char["gameSystem"] = "Dark Heresy"
    elif system == "Dungeons & Dragons":
        defaults = dict(base_object(_as_str(data.get("name")), "Dungeons & Dragons"))
        defaults.update(dnd_defaults())
        char = normalize(data, defaults)
        char["gameSystem"] = "Dungeons & Dragons"
        # старые версии писали speed числом или строкой "30ft"
        speed = char.get("speed")
        if isinstance(speed, str):
            match = re.search(r"\d+", speed)
            char["speed"] = int(match.group()) if match else 30
        char["inspiration"] = _as_str(char.get("inspiration"), "0")
        # spellSlots: ключи всегда строками
        slots = _as_dict(char.get("spellSlots"))
        char["spellSlots"] = {
            str(k): {
                "max": _as_int(_as_dict(v).get("max")),
                "current": _as_int(_as_dict(v).get("current")),
            }
            for k, v in slots.items()
        }
        # hitDiceUsed: {str: int}
        used = _as_dict(char.get("hitDiceUsed"))
        char["hitDiceUsed"] = {str(k): _as_int(v) for k, v in used.items()}
    else:
        return None, "неизвестная игровая система: %r" % (system or None), []

    char["id"] = str(doc["doc_id"])
    char["name"] = _as_str(char.get("name")).strip() or "Без имени"
    char["characterClass"] = _as_str(char.get("characterClass"))
    char["backstory"] = _as_str(char.get("backstory"))
    char["notes"] = _as_str(char.get("notes"))
    char["questLog"] = [
        q for q in _as_list(char.get("questLog")) if isinstance(q, dict)
    ]
    if not char["questLog"]:
        char["questLog"] = []
    char["migratedFrom"] = "firestore"
    char["migratedAt"] = now_iso()
    char["migratedFromUid"] = uid
    fix_items(char)
    # что пришлось досочинить (полей нет в старом документе)
    filled = [f for f in REQUIRED_FIELDS.get(char["gameSystem"], []) if f not in data]
    return char, None, filled


REQUIRED_FIELDS = {
    "Dungeons & Dragons": [
        "name",
        "gameSystem",
        "stats",
        "savingThrows",
        "skills",
        "hitPoints",
        "hitDice",
        "deathSaves",
        "currency",
        "spells",
        "inventory",
        "equipment",
    ],
    "Dark Heresy": [
        "name",
        "gameSystem",
        "stats",
        "statUpgrades",
        "wounds",
        "fatePoints",
        "insanityPoints",
        "corruptionPoints",
        "wealth",
        "movement",
        "equipment",
        "fatigue1st",
        "fatigue2nd",
        "criticalConditions",
    ],
}


def validate_character(char):
    problems = []
    for field in REQUIRED_FIELDS.get(char["gameSystem"], []):
        if field not in char or char[field] is None:
            problems.append("нет обязательного поля %r" % field)
    for key in ("stats",):
        if not isinstance(char.get(key), dict):
            problems.append("%s должен быть объектом" % key)
    if not isinstance(char.get("questLog"), list):
        problems.append("questLog должен быть массивом")
    return problems


# ───────────────────────────────── вывод ────────────────────────────────────


def human_table(rows, headers):
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))
    line = "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    sep = "  ".join("-" * widths[i] for i in range(len(headers)))
    print(line)
    print(sep)
    for row in rows:
        print("  ".join(str(cell).ljust(widths[i]) for i, cell in enumerate(row)))


def random_password(length=12):
    """Случайный пароль без визуально похожих символов (l/1/I, O/0)."""
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    rng = random.SystemRandom()
    return "".join(rng.choice(alphabet) for _ in range(length))


# ─────────────────────────────── главный сценарий ───────────────────────────


def _dir_size(path):
    total = 0
    for item in Path(path).rglob("*"):
        try:
            if item.is_file():
                total += item.stat().st_size
        except OSError:
            pass
    return total


def human_size(num):
    for unit in ("Б", "КБ", "МБ", "ГБ"):
        if num < 1024 or unit == "ГБ":
            return ("%.0f %s" if unit == "Б" else "%.1f %s") % (num, unit)
        num /= 1024.0
    return "%d Б" % num


def print_exports_table(export_dirs):
    """--list: что нашлось в источнике и какой экспорт будет взят по умолчанию."""
    rows = []
    newest = export_dirs[-1] if export_dirs else None
    for export_dir in export_dirs:
        try:
            docs = parse_export_dir(export_dir, verbose=False)
            count = len(docs)
            users = len({d["uid"] for d in docs})
        except Exception as exc:  # noqa: BLE001
            count, users = "?", "?"
            print("  ! %s: %s" % (export_dir.name, exc), file=sys.stderr)
        rows.append(
            [
                export_dir.name,
                human_size(_dir_size(export_dir)),
                count,
                users,
                "← будет взят" if export_dir is newest else "",
            ]
        )
    if not rows:
        print("Экспортов не найдено.")
        return
    human_table(rows, ["экспорт (каталог)", "размер", "листов", "аккаунтов", ""])
    print(
        "\nВсего экспортов: %d. По умолчанию берётся самый свежий (%s)."
        % (len(rows), newest.name if newest else "-")
    )
    print("Другой: --export <имя или начало>. Все сразу: --all.")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Перенос листов персонажей из старого бэкапа Firestore в новую файловую структуру.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Подробности и примеры — в docstring в начале файла "
        "(python3 dcs-migrate.py --help | head -40).",
    )
    parser.add_argument(
        "--source",
        required=True,
        help="каталог бэкапов (/opt/backup), один экспорт (<ts>/), .7z "
        "или JSON-массив (import-source.json)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="показать список найденных экспортов (дата, размер, документов) и выйти",
    )
    parser.add_argument(
        "--export",
        metavar="NAME",
        default=None,
        help="взять конкретный экспорт (имя каталога или его начало); "
        "по умолчанию — самый свежий",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="объединить ВСЕ экспорты (новые перекрывают старые — "
        "спасает персонажей, удалённых позже)",
    )
    parser.add_argument(
        "--data-dir",
        default="./data",
        help="каталог данных новой версии (по умолчанию ./data)",
    )
    parser.add_argument(
        "--password",
        default="1234",
        help="общий пароль для создаваемых аккаунтов (по умолчанию 1234; "
        "короче 12 символов — только для локального стенда, печатает предупреждение)",
    )
    parser.add_argument(
        "--random-passwords",
        action="store_true",
        help="сгенерировать случайный пароль каждому аккаунту",
    )
    parser.add_argument(
        "--password-length",
        type=int,
        default=12,
        metavar="N",
        help="длина случайного пароля, 6..64 (по умолчанию 12 — минимум политики "
        "приложения; работает с --random-passwords)",
    )
    parser.add_argument(
        "--credentials",
        metavar="FILE",
        default=None,
        help="выгрузить выданные логины/пароли в CSV (удобно раздавать игрокам)",
    )
    parser.add_argument(
        "--username-template",
        default="imported-{uid6}",
        help="шаблон логина: {uid}, {uid6}, {uid8}, {n} "
        "(по умолчанию imported-{uid6})",
    )
    parser.add_argument(
        "--map", help='JSON {firebase_uid: "логин"} — свои имена аккаунтов'
    )
    parser.add_argument(
        "--auth-export",
        metavar="FILE",
        default=None,
        help="users.json из `firebase auth:export` — взять логины (e-mail) и имена оттуда",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="только показать, что будет сделано"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="писать в непустой --data-dir (перезаписывать существующее)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="падать, если у персонажа нет обязательного поля (а не подставлять дефолт)",
    )
    parser.add_argument("--report", help="сохранить отчёт о миграции в JSON")
    args = parser.parse_args(argv)
    if not 6 <= args.password_length <= 64:
        parser.error("--password-length должен быть 6..64")
    if args.random_passwords and args.password_length < MIN_PASSWORD_LENGTH:
        print(
            "  ! --password-length %d меньше политики приложения (%d): такие "
            "пароли подойдут только для локального стенда"
            % (args.password_length, MIN_PASSWORD_LENGTH),
            file=sys.stderr,
        )
    elif not args.random_passwords and len(args.password) < MIN_PASSWORD_LENGTH:
        print(
            "  ! --password короче %d символов: политика приложения такой пароль "
            "не примет при смене (вход работает). Для стенда: --random-passwords "
            "--password-length 16" % MIN_PASSWORD_LENGTH,
            file=sys.stderr,
        )

    username_map = {}
    if args.map:
        with open(args.map, encoding="utf-8") as fh:
            username_map = {str(k): str(v) for k, v in json.load(fh).items()}

    auth_users = {}
    if args.auth_export:
        auth_users = load_auth_export(args.auth_export)
        if not auth_users:
            print("! в %s не нашлось пользователей" % args.auth_export, file=sys.stderr)

    data_dir = Path(args.data_dir).expanduser()
    if (
        data_dir.exists()
        and any(data_dir.iterdir())
        and not args.dry_run
        and not args.force
    ):
        raise SystemExit(
            "%s уже не пуст. Миграция рассчитана на чистый каталог данных.\n"
            "Сделайте бэкап (tar czf backup.tgz %s) и повторите с --force, "
            "либо укажите другой --data-dir." % (data_dir, data_dir)
        )

    if args.all and args.export:
        parser.error("--all и --export взаимоисключающие")
    select = "all" if args.all else (args.export or "newest")

    docs, info = load_documents(args.source, select=select, list_only=args.list)
    if args.list:
        return 0
    print(
        "→ Источник: %s (%s), документов: %d" % (args.source, info["text"], len(docs))
    )
    if not docs:
        raise SystemExit("В источнике не нашлось документов characterSheets.")

    # группировка по старому uid
    by_user = {}
    skipped = []
    synthesized = {}
    for doc in docs:
        char, error, filled = convert_character(doc, doc["uid"])
        if error:
            skipped.append((doc, error))
            continue
        problems = validate_character(char)
        if problems:
            raise SystemExit(
                "Персонаж %r (%s) не сконвертирован: %s"
                % (char["name"], char["id"], "; ".join(problems))
            )
        if filled:
            if args.strict:
                raise SystemExit(
                    "Персонаж %r (%s): в старых данных нет полей %s "
                    "(без --strict они были бы заполнены значениями по умолчанию)."
                    % (char["name"], char["id"], ", ".join(filled))
                )
            synthesized[char["id"]] = filled
        by_user.setdefault(doc["uid"], []).append(char)

    if skipped:
        print("! пропущено документов: %d" % len(skipped), file=sys.stderr)
        for doc, error in skipped[:10]:
            print("   - %s (%s)" % (doc["doc_id"], error), file=sys.stderr)

    if not by_user:
        raise SystemExit("После разбора не осталось ни одного персонажа.")
    if synthesized:
        print(
            "→ В %d листах не хватало полей — подставлены значения по умолчанию:"
            % len(synthesized)
        )
        for cid, fields in sorted(synthesized.items()):
            print("   - %s: %s" % (cid, ", ".join(fields)))

    # аккаунты
    accounts = []
    used_usernames = set()
    matched_auth, missed_auth, disabled_auth = set(), [], []
    for index, (uid, chars) in enumerate(sorted(by_user.items()), start=1):
        auth = auth_users.get(uid) or {}
        username = username_map.get(uid)
        if not username and auth.get("email"):
            username = auth["email"].strip().lower()
        if not username:
            username = (
                args.username_template.format(
                    uid=uid, uid6=uid[:6], uid8=uid[:8], n=index
                )
                .strip()
                .lower()
            )
        # Логин из auth-экспорта — e-mail; домен старого проекта убираем.
        username = strip_login_domains(username)
        if auth_users:
            if auth:
                matched_auth.add(uid)
                if auth.get("disabled"):
                    disabled_auth.append(username)
            else:
                missed_auth.append(uid)
        if username in used_usernames:
            username = "%s-%d" % (username, index)
        used_usernames.add(username)
        password = (
            random_password(args.password_length)
            if args.random_passwords
            else args.password
        )
        local_uid = local_uid_for(uid)
        # Привязка листа к владельцу: та же величина, что "uid" в user.json.
        # Пишется сервером, а не берётся из клиентского запроса; источник
        # истины всё равно каталог users/<uid>/, поле — для диагностики/бэкапа.
        for c in chars:
            c["userId"] = local_uid
        display_name = (auth.get("displayName") or "").strip() or username.split("@")[0]
        accounts.append(
            {
                "firebase_uid": uid,
                "username": username,
                "display_name": display_name,
                "firebase_email": auth.get("email") or "",
                "password": password,
                "password_hash": scrypt_hash(password),
                "local_uid": local_uid,
                "characters": chars,
            }
        )

    if auth_users:
        print(
            "→ Auth-экспорт: совпало uid %d из %d" % (len(matched_auth), len(by_user))
        )
        if missed_auth:
            sample = ", ".join(u[:8] + "…" for u in missed_auth[:8])
            print(
                "  ! для %d uid нет записи в auth-экспорте (%s) — остаются логины по шаблону"
                % (len(missed_auth), sample),
                file=sys.stderr,
            )
        if disabled_auth:
            print(
                "  ! помечены как disabled в Firebase: %s" % ", ".join(disabled_auth),
                file=sys.stderr,
            )

    print()
    human_table(
        [
            [
                a["username"],
                a["display_name"],
                a["password"],
                a["local_uid"],
                len(a["characters"]),
            ]
            for a in accounts
        ],
        ["логин", "имя", "пароль", "uid", "листов"],
    )
    total_chars = sum(len(a["characters"]) for a in accounts)
    print("\nИтого: %d аккаунт(ов), %d персонаж(ей)" % (len(accounts), total_chars))

    if args.dry_run:
        print("\n--dry-run: ничего не записано.")
        report = build_report(args, accounts, skipped, synthesized)
        if args.report:
            write_report(args.report, report)
            print("Отчёт: %s" % args.report)
        return 0

    # запись
    data_dir.mkdir(parents=True, exist_ok=True)
    users_root = data_dir / "users"
    index_path = data_dir / "index" / "logins.json"

    # Индекс «логин → uid» — производный: приложение пересоберёт его сканом,
    # но при миграции соберём сразу, чтобы вход работал без лишнего прохода.
    index = {}
    if index_path.exists():
        try:
            loaded = json.loads(index_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("logins"), dict):
                index = {
                    str(login).strip().lower(): uid
                    for login, uid in loaded["logins"].items()
                }
        except Exception:  # noqa: BLE001 — битый индекс перезапишем
            index = {}

    written_files = 0
    for account in accounts:
        user_dir = users_root / account["local_uid"]
        chars_dir = user_dir / "characters"
        user_file = user_dir / "user.json"
        if user_file.exists() and not args.force:
            raise SystemExit(
                "%s уже существует — не перезаписываю (--force, чтобы перезаписать)"
                % user_file
            )
        chars_dir.mkdir(parents=True, exist_ok=True)
        created = now_iso()
        user_payload = {
            "schemaVersion": USER_SCHEMA_VERSION,
            "uid": account["local_uid"],
            "username": account["username"],
            "passwordHash": account["password_hash"],
            "displayName": account["display_name"],
            # Поля v4: сервер и так дописывает их на старте, но профиль без них
            # выглядит «неполным» в бэкапе и в admin-инспекции.
            "role": "user",
            "isBlocked": False,
            "createdAt": created,
            "updatedAt": created,
            "migratedFromUid": account["firebase_uid"],
            "migratedAt": created,
        }
        # Полный Firebase-логин остаётся для аудита, даже если домен убран
        # из username (см. strip_login_domains).
        if account.get("firebase_email"):
            user_payload["migratedFromEmail"] = account["firebase_email"]
        with open(user_file, "w", encoding="utf-8") as fh:
            json.dump(user_payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        index[account["username"].strip().lower()] = account["local_uid"]
        written_files += 1
        for char in account["characters"]:
            target = chars_dir / ("%s.json" % char["id"])
            with open(target, "w", encoding="utf-8") as fh:
                json.dump(char, fh, ensure_ascii=False, indent=2)
                fh.write("\n")
            written_files += 1
        account["characters"] = [
            {"id": c["id"], "name": c["name"], "gameSystem": c["gameSystem"]}
            for c in account["characters"]
        ]

    # индекс пишем после аккаунтов, атомарно (tmp + os.replace)
    index_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_index = index_path.with_name(index_path.name + ".tmp")
    with open(tmp_index, "w", encoding="utf-8") as fh:
        json.dump({"version": 1, "logins": index}, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp_index, index_path)
    written_files += 1

    print("\n→ Записано файлов: %d в %s" % (written_files, data_dir))
    report = build_report(args, accounts, skipped, synthesized)
    if args.report:
        write_report(args.report, report)
        print("→ Отчёт: %s" % args.report)
    if args.credentials:
        write_credentials(args.credentials, accounts)
        print(
            "→ Логины/пароли: %s (файл секретный: chmod 600, не в git)"
            % args.credentials
        )
    print("\nГотово. Логиньтесь в новой версии логином/паролем из таблицы выше.")
    print("Пароли хранятся только в этом выводе — сохраните их к себе.")
    return 0


def write_credentials(path, accounts):
    """CSV с доступами: логин, пароль, имя, каталог, листов, персонажи."""
    with open(path, "w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            ["login", "password", "display_name", "data_folder", "sheets", "characters"]
        )
        for account in accounts:
            characters = account["characters"]
            names = []
            for char in characters:
                if isinstance(char, dict):
                    names.append(char.get("name") or char.get("id") or "")
                elif isinstance(char, str):
                    names.append(char)
            writer.writerow(
                [
                    account["username"],
                    account["password"],
                    account["display_name"],
                    account["local_uid"],
                    len(characters),
                    "; ".join(names),
                ]
            )
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def build_report(args, accounts, skipped, synthesized=None):
    return {
        "generatedAt": now_iso(),
        "source": str(args.source),
        "authExport": str(args.auth_export) if args.auth_export else None,
        "dataDir": str(Path(args.data_dir).expanduser()),
        "accounts": [
            {
                "firebaseUid": a["firebase_uid"],
                "username": a["username"],
                "firebaseEmail": a.get("firebase_email", ""),
                "password": a["password"],
                "localUserId": a["local_uid"],
                "characters": [
                    (
                        {
                            "id": c["id"],
                            "name": c["name"],
                            "gameSystem": c["gameSystem"],
                        }
                        if isinstance(c, dict)
                        else c
                    )
                    for c in a["characters"]
                ],
            }
            for a in accounts
        ],
        "skipped": [{"docId": d["doc_id"], "reason": r} for d, r in skipped],
        "synthesizedFields": synthesized or {},
        "totals": {
            "accounts": len(accounts),
            "characters": sum(len(a["characters"]) for a in accounts),
        },
    }


def write_report(path, report):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


if __name__ == "__main__":
    sys.exit(main())
