#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dcs-migrate-check.py — проверка, что результат dcs-migrate.py соответствует
ТЕКУЩЕЙ версии профиля персонажа (src/lib/types.ts) проекта DigitalCharsheets.

Что проверяет:
  * все обязательные (не `?`) поля DnD5eCharacter / DarkHeresyCharacter,
    включая вложенные интерфейсы (stats, skills, equipment, questLog, ...);
  * типы значений (number / string / boolean / массив / объект / литерал);
  * длины кортежей (statUpgrades: [boolean x4]);
  * лишние поля (предупреждение — приложение их игнорирует/сохраняет как есть);
  * структуру user.json (schemaVersion 4, неизменяемый uid = имя каталога);
  * индекс логинов data/index/logins.json (логин → uid);
  * привязку листа к владельцу: userId в characters/<id>.json = имя каталога
    (--fix-owner дописывает её в уже перенесённые листы);
  * по флагу --strip-login-domain убирает домены @verse-scribe.app и
    @local.charsheets из уже перенесённых логинов и пересобирает индекс
    (листы не трогает).

Парсер типов — не полноценный TypeScript, а разбор `interface`/`type` из
types.ts: покрывает то, что реально используется в профиле персонажа.

ПРИМЕРЫ
  ./dcs-migrate-check.py --data-dir .tmp-migrate/data \
      --types DigitalCharsheets-qwen/src/lib/types.ts

  # кратко: только ошибки и итог
  ./dcs-migrate-check.py --data-dir data --brief

Код возврата: 0 — всё сходится, 1 — есть ошибки (несовместимость).
"""

import argparse
import json
import os
import re
from pathlib import Path

# ─────────────────────────── разбор types.ts ────────────────────────────────


def strip_comments(text):
    out, i, n = [], 0, len(text)
    quote = None
    while i < n:
        ch = text[i]
        if quote:
            out.append(ch)
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in "'\"":
            quote = ch
            out.append(ch)
            i += 1
            continue
        if text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i)
            i = n if j < 0 else j + 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _balanced(text, start, open_ch="{", close_ch="}"):
    """Индекс закрывающей скобки для text[start] == open_ch."""
    depth = 0
    i = start
    quote = None
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == quote:
                quote = None
        elif ch in "'\"":
            quote = ch
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("несбалансированные скобки")


def split_top_level(expr, sep):
    """Разбивает выражение по разделителю верхнего уровня."""
    members, depth, cur, quote = [], 0, [], None
    for ch in expr:
        if quote:
            cur.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
            cur.append(ch)
            continue
        if ch in "{[(":
            depth += 1
            cur.append(ch)
            continue
        if ch in "}])":
            depth -= 1
            cur.append(ch)
            continue
        if ch == sep and depth == 0:
            members.append("".join(cur).strip())
            cur = []
            continue
        cur.append(ch)
    members.append("".join(cur).strip())
    return [m for m in members if m]


def split_type_members(expr):
    return split_top_level(expr, "|")


def split_props(body):
    """Режет тело интерфейса/объекта по `;` верхнего уровня."""
    props, depth, cur, quote = [], 0, [], None
    for ch in body:
        if quote:
            cur.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
            cur.append(ch)
            continue
        if ch in "{[(":
            depth += 1
        elif ch in "}])":
            depth -= 1
        if ch == ";" and depth == 0:
            props.append("".join(cur).strip())
            cur = []
            continue
        cur.append(ch)
    tail = "".join(cur).strip()
    if tail:
        props.append(tail)
    return [p for p in props if p]


class TypeParser:
    def __init__(self, text):
        self.text = strip_comments(text)
        self.interfaces = {}
        self.aliases = {}
        self.const_arrays = {}
        self._parse()

    def _parse(self):
        for match in re.finditer(
            r"(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w\s,]+))?\s*\{",
            self.text,
        ):
            name, bases = match.group(1), match.group(2)
            body_start = match.end() - 1
            body_end = _balanced(self.text, body_start)
            props = self._parse_props(self.text[body_start + 1 : body_end])
            base_list = [b.strip() for b in (bases or "").split(",") if b.strip()]
            self.interfaces[name] = {"bases": base_list, "props": props}

        for match in re.finditer(
            r"(?:export\s+)?type\s+(\w+)\s*=\s*([^;]+);", self.text
        ):
            self.aliases[match.group(1)] = match.group(2).strip()

        for match in re.finditer(
            r"(?:export\s+)?const\s+(\w+)\s*=\s*\[([^\]]*)\]\s*as\s+const", self.text
        ):
            self.const_arrays[match.group(1)] = re.findall(
                r"""['"]([^'"]*)['"]""", match.group(2)
            )

    @staticmethod
    def _parse_props(body):
        props = {}
        for chunk in split_props(body):
            m = re.match(r"^(\w+)(\?)?\s*:\s*([\s\S]+)$", chunk)
            if not m:
                continue
            props[m.group(1)] = {
                "optional": bool(m.group(2)),
                "type": m.group(3).strip(),
            }
        return props

    def parse_type(self, expr):
        expr = expr.strip()
        members = split_type_members(expr)
        if len(members) > 1:
            return {"kind": "union", "members": [self.parse_type(m) for m in members]}
        if expr.endswith("[]"):
            return {"kind": "array", "elem": self.parse_type(expr[:-2])}
        if expr.startswith("Record<") and expr.endswith(">"):
            inner = expr[len("Record<") : -1]
            parts = split_type_members(inner) or [inner]
            key, val = (parts + [parts[-1]])[:2]
            return {"kind": "record", "key": key.strip(), "val": self.parse_type(val)}
        if expr.startswith("[") and expr.endswith("]"):
            inner = expr[1:-1]
            return {
                "kind": "tuple",
                "items": [self.parse_type(p) for p in split_top_level(inner, ",")],
            }
        if expr.startswith("{") and expr.endswith("}"):
            return {
                "kind": "object",
                "props": self._parse_props(expr[1:-1]),
                "name": "<inline>",
            }
        m = re.match(r"^typeof\s+(\w+)\[number\]$", expr)
        if m and m.group(1) in self.const_arrays:
            values = self.const_arrays[m.group(1)]
            return {
                "kind": "union",
                "members": [{"kind": "literal", "value": v} for v in values],
            }
        if expr in ("number", "string", "boolean", "any", "null", "undefined", "void"):
            return {"kind": "prim", "name": expr}
        m = re.match(r"^'([^']*)'$", expr)
        if m:
            return {"kind": "literal", "value": m.group(1)}
        if expr in self.interfaces:
            return {"kind": "ref", "name": expr}
        if expr in self.aliases:
            return self.parse_type(self.aliases[expr])
        return {"kind": "unknown", "name": expr}

    def props_of(self, name, seen=None):
        """Собирает обязательные/опциональные поля с учётом `extends`."""
        seen = seen or set()
        if name in seen:
            return {}
        seen.add(name)
        iface = self.interfaces.get(name)
        if iface is None:
            return {}
        props = {}
        for base in iface["bases"]:
            props.update(self.props_of(base, seen))
        for prop, info in iface["props"].items():
            props[prop] = dict(info, parsed=self.parse_type(info["type"]))
        return props


# ───────────────────────────── проверка значений ────────────────────────────


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def check_value(value, typ, path, errors, extras, parser, resolve_ref=True):
    kind = typ["kind"]

    if kind == "unknown":
        return
    if kind == "prim":
        name = typ["name"]
        if name in ("any", "undefined", "void"):
            return
        if name == "null":
            if value is not None:
                errors.append("%s: ожидался null" % path)
            return
        if name == "number" and not _is_number(value):
            errors.append("%s: ожидалось число, а %r" % (path, value))
        if name == "string" and not isinstance(value, str):
            errors.append("%s: ожидалась строка, а %r" % (path, value))
        if name == "boolean" and not isinstance(value, bool):
            errors.append("%s: ожидался boolean, а %r" % (path, value))
        return
    if kind == "literal":
        if value != typ["value"]:
            errors.append("%s: ожидалось %r, а %r" % (path, typ["value"], value))
        return
    if kind == "union":
        members = typ["members"]
        if all(m["kind"] == "literal" for m in members):
            allowed = [m["value"] for m in members]
            if value not in allowed:
                errors.append("%s: ожидалось одно из %s, а %r" % (path, allowed, value))
            return
        for member in members:
            errs, exs = [], []
            check_value(value, member, path, errs, exs, parser)
            if not errs:
                return
        errors.append(
            "%s: значение %r не подходит ни под один из вариантов: %s"
            % (path, value, " | ".join(_expr(m) for m in members))
        )
        return
    if kind == "array":
        if not isinstance(value, list):
            errors.append("%s: ожидался массив, а %r" % (path, value))
            return
        for i, item in enumerate(value):
            check_value(item, typ["elem"], "%s[%d]" % (path, i), errors, extras, parser)
        return
    if kind == "tuple":
        if not isinstance(value, list):
            errors.append("%s: ожидался кортеж (массив), а %r" % (path, value))
            return
        if len(value) != len(typ["items"]):
            errors.append(
                "%s: ожидалось %d элементов кортежа, а %d"
                % (path, len(typ["items"]), len(value))
            )
        for i, (item, item_type) in enumerate(zip(value, typ["items"])):
            check_value(item, item_type, "%s[%d]" % (path, i), errors, extras, parser)
        return
    if kind == "record":
        if not isinstance(value, dict):
            errors.append("%s: ожидался объект (Record), а %r" % (path, value))
            return
        for key, item in value.items():
            check_value(
                item, typ["val"], "%s[%r]" % (path, str(key)), errors, extras, parser
            )
        return
    if kind == "ref":
        if not isinstance(value, dict):
            errors.append("%s: ожидался объект %s, а %r" % (path, typ["name"], value))
            return
        check_object(value, typ["name"], path, errors, extras, parser)
        return
    if kind == "object":
        if not isinstance(value, dict):
            errors.append("%s: ожидался объект, а %r" % (path, value))
            return
        check_props(value, typ["props"], "<inline>", path, errors, extras, parser)
        return
    # object
    if not isinstance(value, dict):
        errors.append("%s: ожидался объект, а %r" % (path, value))


def _expr(typ):
    if typ["kind"] == "prim":
        return typ["name"]
    if typ["kind"] == "literal":
        return repr(typ["value"])
    if typ["kind"] == "ref":
        return typ["name"]
    if typ["kind"] == "union":
        return " | ".join(_expr(m) for m in typ["members"])
    return typ["kind"]


def check_object(value, name, path, errors, extras, parser):
    props = parser.props_of(name)
    check_props(value, props, name, path, errors, extras, parser)


def check_props(value, props, owner, path, errors, extras, parser):
    for prop, info in props.items():
        typ = info.get("parsed") or parser.parse_type(info["type"])
        if prop not in value:
            if not info["optional"]:
                errors.append(
                    "%s: нет обязательного поля %r (%s)" % (path, prop, _expr(typ))
                )
            continue
        check_value(value[prop], typ, "%s.%s" % (path, prop), errors, extras, parser)

    for key in value:
        if key not in props and key not in EXTRA_IGNORED:
            extras.append("%s: лишнее поле %r" % (path, key))


# Поля, которые миграция/старые данные добавляют намеренно (не влияют на
# совместимость: приложение их игнорирует, но и не ломается).
EXTRA_IGNORED = {
    "migratedFrom",
    "migratedAt",
    "migratedFromUid",
    "userId",
    "_key",
}


# ────────────────────────────── user.json / каталог ─────────────────────────


UID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

# Те же домены, что убирает dcs-migrate.py из логинов.
LOGIN_DOMAINS_TO_STRIP = ("@verse-scribe.app", "@local.charsheets")


def strip_login_domains(login):
    """petya@verse-scribe.app -> petya; imported-ab12cd@local.charsheets -> imported-ab12cd."""
    for domain in LOGIN_DOMAINS_TO_STRIP:
        if login.endswith(domain):
            return login[: -len(domain)] or login
    return login


def _write_json_atomic(path_obj, payload):
    tmp = path_obj.with_name(path_obj.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path_obj)


def strip_domain_from_logins(data_dir):
    """Убрать @verse-scribe.app из username и пересобрать index/logins.json.

    Ничего, кроме user.json (username + migratedFromEmail) и индекса, не
    трогает: листы персонажей остаются как есть. Если после сокращения два
    логина совпадают — не меняем ничего и возвращаем ошибки.

    :return: (сколько логинов сокращено, список ошибок)
    """
    users_dir = Path(data_dir) / "users"
    planned, errors = {}, []
    current = {}

    for user_dir in sorted(p for p in users_dir.glob("*") if p.is_dir()):
        user_file = user_dir / "user.json"
        try:
            user = json.loads(user_file.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001 — битые профили проверит основной чек
            continue
        login = user.get("username") or user.get("email")
        if not isinstance(login, str) or not login.strip():
            continue
        login = login.strip().lower()
        current[user_dir.name] = login
        short = strip_login_domains(login)
        if short != login:
            planned[user_dir.name] = (login, short)

    if not planned:
        return 0, []

    # Проверка коллизий: сокращённый логин не должен совпасть ни с одним другим.
    final = {}
    for uid, login in current.items():
        final_login = planned[uid][1] if uid in planned else login
        if final_login in final:
            errors.append(
                "логин %r после сокращения совпадает у %s и %s — ничего не меняю"
                % (final_login, final[final_login], uid)
            )
        final[final_login] = uid
    if errors:
        return 0, errors

    for uid, (old_login, new_login) in planned.items():
        user_file = users_dir / uid / "user.json"
        user = json.loads(user_file.read_text(encoding="utf-8"))
        user["username"] = new_login
        # Полный e-mail сохраняем для аудита.
        if not user.get("migratedFromEmail"):
            user["migratedFromEmail"] = old_login
        _write_json_atomic(user_file, user)

    index_payload = {
        "version": 1,
        "logins": {login: uid for login, uid in sorted(final.items())},
    }
    _write_json_atomic(Path(data_dir) / "index" / "logins.json", index_payload)
    return len(planned), []


def check_data_dir(data_dir, parser, fix_owner=False):
    errors, extras, ok = [], [], 0
    fixed = []
    accounts = 0
    chars = 0
    users_dir = Path(data_dir) / "users"
    expected_logins = {}

    if not users_dir.is_dir():
        errors.append("%s: нет каталога users/ (схема хранения v2)" % data_dir)

    for user_dir in sorted(p for p in users_dir.glob("*") if p.is_dir()):
        accounts += 1
        user_file = user_dir / "user.json"
        if not user_file.exists():
            errors.append("%s: нет user.json" % user_dir.name)
            continue
        try:
            user = json.loads(user_file.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            errors.append("%s/user.json: не JSON (%s)" % (user_dir.name, exc))
            continue

        # Схема v4: uid неизменяем и совпадает с именем каталога.
        uid = user.get("uid")
        if not isinstance(uid, str) or not UID_RE.fullmatch(uid):
            errors.append("%s/user.json: uid %r не UUID" % (user_dir.name, uid))
        elif uid != user_dir.name:
            errors.append(
                "%s: uid в user.json (%s) не совпадает с именем каталога"
                % (user_dir.name, uid)
            )
        if user.get("schemaVersion") != 4:
            errors.append(
                "%s/user.json: schemaVersion %r, ожидалось 4"
                % (user_dir.name, user.get("schemaVersion"))
            )

        username = user.get("username") or user.get("email")
        if not isinstance(username, str) or not username.strip():
            errors.append("%s/user.json: нет username" % user_dir.name)
        else:
            expected_logins[username.strip().lower()] = user_dir.name

        pw = user.get("passwordHash")
        # Канон — scrypt-строка приложения; 64 hex — легаси sha256, который
        # сервер сам перезапишет при первом входе.
        if not isinstance(pw, str) or not (
            re.fullmatch(r"[0-9a-f]{64}", pw)
            or re.fullmatch(
                r"scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+", pw
            )
        ):
            errors.append(
                "%s/user.json: passwordHash не scrypt и не легаси sha256-hex"
                % user_dir.name
            )
        if not isinstance(user.get("displayName"), str):
            errors.append("%s/user.json: нет displayName" % user_dir.name)

        chars_dir = user_dir / "characters"
        if not chars_dir.exists():
            errors.append("%s: нет каталога characters" % user_dir.name)
            continue
        for char_file in sorted(chars_dir.glob("*.json")):
            chars += 1
            try:
                char = json.loads(char_file.read_text(encoding="utf-8"))
            except Exception as exc:  # noqa: BLE001
                errors.append("%s: не JSON (%s)" % (char_file.name, exc))
                continue

            # Владелец: та же величина, что "uid" в user.json. Источник истины —
            # каталог, поле нужно для диагностики и «плоских» бэкапов.
            owner = char.get("userId")
            if owner != user_dir.name:
                if fix_owner:
                    char["userId"] = user_dir.name
                    # tmp + replace: обрыв не оставит обрезанный лист.
                    tmp_file = char_file.with_name(char_file.name + ".tmp")
                    with open(tmp_file, "w", encoding="utf-8") as fh:
                        json.dump(char, fh, ensure_ascii=False, indent=2)
                        fh.write("\n")
                    os.replace(tmp_file, char_file)
                    fixed.append("%s/%s" % (user_dir.name, char_file.name))
                else:
                    errors.append(
                        "%s/%s: userId %r не совпадает с каталогом %s "
                        "(исправить: --fix-owner)"
                        % (user_dir.name, char_file.name, owner, user_dir.name)
                    )

            system = char.get("gameSystem")
            if system not in ("Dungeons & Dragons", "Dark Heresy"):
                errors.append(
                    "%s: неизвестная gameSystem %r" % (char_file.name, system)
                )
                continue
            if char.get("id") != char_file.stem:
                errors.append(
                    "%s: id %r не совпадает с именем файла"
                    % (char_file.name, char.get("id"))
                )
            iface = (
                "DnD5eCharacter"
                if system == "Dungeons & Dragons"
                else "DarkHeresyCharacter"
            )
            char_errors, char_extras = [], []
            check_object(
                char,
                iface,
                "%s/%s" % (user_dir.name, char_file.name),
                char_errors,
                char_extras,
                parser,
            )
            errors.extend(char_errors)
            extras.extend(char_extras)
            if not char_errors:
                ok += 1

    # Индекс «логин → uid»: производный, но должен соответствовать каталогам.
    index_path = Path(data_dir) / "index" / "logins.json"
    if not index_path.exists():
        errors.append(
            "index/logins.json отсутствует — вход по логину не найдёт аккаунты"
        )
    else:
        try:
            index = json.loads(index_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            errors.append("index/logins.json: не JSON (%s)" % exc)
            index = {}
        logins = index.get("logins") if isinstance(index, dict) else None
        if not isinstance(logins, dict):
            errors.append("index/logins.json: нет объекта logins")
        else:
            for login, uid in sorted(expected_logins.items()):
                actual = logins.get(login)
                if actual != uid:
                    errors.append(
                        "index/logins.json: %r -> %r, ожидалось %r"
                        % (login, actual, uid)
                    )
            for login in sorted(set(logins) - set(expected_logins)):
                errors.append(
                    "index/logins.json: лишняя запись %r (такого логина нет в users/)"
                    % login
                )

    return {
        "accounts": accounts,
        "characters": chars,
        "ok": ok,
        "errors": errors,
        "extras": extras,
        "fixed": fixed,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Сверка JSON-данных миграции с текущим src/lib/types.ts."
    )
    parser.add_argument("--data-dir", required=True, help="каталог данных (data/)")
    parser.add_argument(
        "--types",
        default="DigitalCharsheets-qwen/src/lib/types.ts",
        help="путь к types.ts (по умолчанию DigitalCharsheets-qwen/src/lib/types.ts)",
    )
    parser.add_argument("--brief", action="store_true", help="не печатать лишние поля")
    parser.add_argument(
        "--fix-owner",
        action="store_true",
        help="дописать/исправить userId в characters/*.json (= имя каталога владельца)",
    )
    parser.add_argument(
        "--strip-login-domain",
        action="store_true",
        help="убрать @verse-scribe.app и @local.charsheets из username и пересобрать индекс",
    )
    args = parser.parse_args(argv)

    types_path = Path(args.types)
    if not types_path.exists():
        raise SystemExit("нет файла типов: %s" % types_path)
    type_parser = TypeParser(types_path.read_text(encoding="utf-8"))

    if args.strip_login_domain:
        changed, strip_errors = strip_domain_from_logins(args.data_dir)
        if strip_errors:
            for line in strip_errors:
                print("  ✗ " + line)
            return 1
        print("Логинов сокращено: %d" % changed)

    result = check_data_dir(args.data_dir, type_parser, fix_owner=args.fix_owner)
    print(
        "Аккаунтов: %d, листов: %d, без ошибок: %d"
        % (result["accounts"], result["characters"], result["ok"])
    )
    if result.get("fixed"):
        print("Исправлен userId в листах: %d" % len(result["fixed"]))
    if result["extras"] and not args.brief:
        print("\nЛишние поля (не входят в текущий профиль, приложением игнорируются):")
        for line in result["extras"]:
            print("  ~ " + line)
    if result["errors"]:
        print("\nОшибки совместимости (%d):" % len(result["errors"]))
        for line in result["errors"]:
            print("  ✗ " + line)
        print(
            "\nИТОГ: миграция НЕ соответствует текущему профилю (%d ошибок)."
            % len(result["errors"])
        )
        return 1
    print("\nИТОГ: миграция соответствует текущему профилю.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
