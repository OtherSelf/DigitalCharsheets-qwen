/**
 * ─── LANDMARK: OPENAPI DOCUMENT ────────────────────────────────────────────
 * Источник истины для /api/docs (Scalar) и /api/openapi.json.
 *
 * Спека написана вручную: API-роуты используют обычные NextResponse и
 * серверные функции, а не zod-схемы, поэтому генерация «из кода» дала бы
 * больше магии, чем пользы. Зато tests/unit/openapi.test.ts сверяет спеку с
 * реальными route.ts: если добавить/удалить метод и забыть доку, тест упадёт.
 *
 * Cookie-сессия описана как apiKey в cookie: Swagger/Scalar показывают замок,
 * но HttpOnly-cookie выставляется только после логина, вручную её не ввести.
 */
import { CURRENT_SCHEMA_VERSION } from '@/games/plugin-api';
import { listGameModules, listGamePlugins } from '@/games/registry';

const jsonContent = (schema: unknown) => ({
  'application/json': { schema },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const paramRef = (name: string) => ({
  $ref: `#/components/parameters/${name}`,
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ref('ErrorResponse')),
});

const jsonResponse = (description: string, schema: unknown) => ({
  description,
  content: jsonContent(schema),
});

const jsonBody = (schema: unknown, required = true) => ({
  required,
  content: jsonContent(schema),
});

/**
 * Значения для схем берутся из реестра и манифестов (этап 2): новая игра
 * появляется в OpenAPI без правок этого файла, а legacy-имена `gameSystem` —
 * из `plugin.json#aliases`.
 */
const SYSTEM_IDS = listGameModules().map((gameModule) => gameModule.id);
const GAME_SYSTEM_NAMES = [
  ...new Set(
    listGamePlugins().flatMap((plugin) =>
      (plugin.manifest.aliases ?? [])
        .map((alias) => alias.gameSystem)
        .filter((value): value is string => Boolean(value)),
    ),
  ),
];
const GAME_TITLES = [
  ...new Map(
    listGamePlugins().map((plugin) => [
      plugin.manifest.game.id,
      plugin.manifest.game.name.en,
    ]),
  ).values(),
];

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Digital Character Sheets API',
    version: '1.0.0',
    description: [
      `REST API for Digital Character Sheets — ${GAME_TITLES.join(' and ')} sheets.`,
      '',
      'Authentication uses the HttpOnly `dcs_session` cookie. Obtain it via',
      '`POST /api/auth` (login) or `POST /api/auth/register`, then send it with',
      '`credentials: include` / the browser cookie jar.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'Same origin (relative URLs)' }],
  tags: [
    {
      name: 'Authentication',
      description: 'Login, registration, sessions and account recovery.',
    },
    {
      name: 'Characters',
      description: 'Character sheet CRUD for the signed-in user.',
    },
    {
      name: 'Import/Export',
      description:
        'Portable JSON export. The legacy Firestore import is an offline migration and is not part of the runtime API.',
    },
    {
      name: 'Admin',
      description: 'User management. Requires an active administrator.',
    },
    {
      name: 'System',
      description: 'Health and build information (public, no authentication).',
    },
  ],
  security: [{ cookieAuth: [] }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'dcs_session',
        description:
          'Signed HttpOnly session cookie `<uid>.<exp>.<jti>.<hmac>`, 14 days, `Secure` in production. Set only by /api/auth and /api/auth/register; revocation is server-side (logout, credential change, administrator action).',
      },
    },
    parameters: {
      CharacterId: {
        name: 'id',
        in: 'path',
        required: true,
        description:
          'Character sheet id (the file name without `.json`). Must match `^[A-Za-z0-9_-]{1,64}$`; anything else is rejected with `400` before touching the disk.',
        schema: {
          type: 'string',
          pattern: '^[A-Za-z0-9_-]{1,64}$',
          maxLength: 64,
        },
      },
      CharacterIdQuery: {
        name: 'characterId',
        in: 'query',
        required: false,
        description:
          'Return a single sheet. Without it the export contains an array of all sheets.',
        schema: { type: 'string' },
      },
      UserUid: {
        name: 'uid',
        in: 'path',
        required: true,
        description: 'Immutable user id (UUID).',
        schema: { type: 'string', format: 'uuid' },
      },
    },
    responses: {
      BadRequest: errorResponse(
        'Invalid input, malformed JSON or failed server-side validation.',
      ),
      Unauthorized: errorResponse(
        'No valid session: missing/expired cookie, deleted account or blocked account.',
      ),
      Forbidden: errorResponse(
        'Session is valid, but the account has no administrator role.',
      ),
      NotFound: errorResponse('The requested resource was not found.'),
      Conflict: errorResponse(
        'The requested change conflicts with the current state (taken login, last administrator, etc.).',
      ),
      ServerError: errorResponse('Unexpected server error.'),
      RateLimited: {
        description:
          "Too many attempts for this IP/login pair. The body carries a machine-readable `reason: 'rate_limited'`; wait for the number of seconds in `Retry-After`.",
        headers: {
          'Retry-After': {
            description: 'Seconds to wait before the next attempt.',
            schema: { type: 'integer' },
          },
        },
        content: jsonContent(ref('ErrorResponse')),
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Always `false` when present.',
          },
          error: { type: 'string' },
          reason: {
            type: 'string',
            description:
              'Machine-readable reason, e.g. `no_account`, `invalid_password`, `blocked`, `exists`, `invalid_input`, `last_admin`, `username_taken`, `self`.',
          },
        },
        additionalProperties: true,
      },
      AuthUser: {
        type: 'object',
        required: [
          'uid',
          'username',
          'displayName',
          'hasRecoveryPhrase',
          'role',
          'isBlocked',
          'mustChangePassword',
        ],
        properties: {
          uid: { type: 'string', format: 'uuid' },
          username: { type: 'string', description: 'Normalized login.' },
          displayName: { type: 'string' },
          hasRecoveryPhrase: { type: 'boolean' },
          role: { type: 'string', enum: ['user', 'tester', 'admin'] },
          isBlocked: { type: 'boolean' },
          mustChangePassword: {
            type: 'boolean',
            description:
              'True for the generated bootstrap administrator until the password is changed.',
          },
        },
        additionalProperties: true,
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            description: 'Login (case-insensitive).',
          },
          password: {
            type: 'string',
            description:
              'Not length-checked on login: accounts created before the 12-character policy must still be able to sign in.',
          },
          displayName: {
            type: 'string',
            description: 'Optional, only used if the account is created.',
          },
        },
        additionalProperties: false,
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'password', 'displayName', 'recoveryPhrase'],
        properties: {
          username: { type: 'string' },
          password: {
            type: 'string',
            minLength: 12,
            maxLength: 128,
            description:
              'Password policy: at least 12 characters. Stored as a salted scrypt hash.',
          },
          displayName: { type: 'string' },
          recoveryPhrase: { type: 'string', minLength: 5 },
        },
        additionalProperties: false,
      },
      ExistsRequest: {
        type: 'object',
        required: ['username'],
        properties: { username: { type: 'string' } },
        additionalProperties: false,
      },
      ExistsResponse: {
        type: 'object',
        required: ['success', 'exists'],
        properties: {
          success: { type: 'boolean' },
          exists: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      AuthSessionResponse: {
        type: 'object',
        required: ['success', 'user'],
        properties: {
          success: { type: 'boolean' },
          isNewUser: { type: 'boolean' },
          user: ref('AuthUser'),
        },
        additionalProperties: false,
      },
      AuthUserResponse: {
        type: 'object',
        required: ['success', 'user'],
        properties: {
          success: { type: 'boolean' },
          user: ref('AuthUser'),
        },
        additionalProperties: false,
      },
      SimpleSuccess: {
        type: 'object',
        required: ['success'],
        properties: { success: { type: 'boolean' } },
        additionalProperties: true,
      },
      ShareCreateRequest: {
        type: 'object',
        properties: {
          expiresInDays: {
            type: ['integer', 'null'],
            enum: [7, 30, 90, null],
            default: 30,
            description:
              'Lifetime in days, or `null` for a link that lives until revoked. Unsupported values are rejected with `400 reason: invalid_expiry`.',
          },
          includeHistory: {
            type: 'boolean',
            default: false,
            description:
              'Show the read-only change history to the guest. The API copies no owner identifiers; unsupported values are rejected with `400 reason: invalid_include_history`.',
          },
        },
        additionalProperties: false,
      },
      ShareStatus: {
        type: 'object',
        required: ['success', 'active'],
        properties: {
          success: { type: 'boolean' },
          active: {
            type: 'boolean',
            description:
              'Whether an unexpired link exists. The token itself is never returned here — only the POST response shows it once.',
          },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: {
            type: ['string', 'null'],
            format: 'date-time',
            description: '`null` means the link lives until revoked.',
          },
          includeHistory: {
            type: 'boolean',
            description:
              'Whether the shared page shows the read-only change history. Off by default.',
          },
        },
        additionalProperties: false,
      },
      ShareCreated: {
        type: 'object',
        required: ['success', 'token', 'path', 'createdAt', 'expiresAt'],
        properties: {
          success: { type: 'boolean' },
          token: {
            type: 'string',
            pattern: '^[A-Za-z0-9_-]{43}$',
            description:
              'Bearer token for `/share/<token>`. Shown only once; only its SHA-256 is stored.',
          },
          path: {
            type: 'string',
            description: 'Relative share URL, e.g. `/share/<token>`.',
          },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: ['string', 'null'], format: 'date-time' },
          includeHistory: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      HistoryChange: {
        type: 'object',
        required: ['kind', 'path'],
        properties: {
          kind: {
            type: 'string',
            enum: [
              'changed',
              'added',
              'removed',
              'array-add',
              'array-remove',
              'bulk',
            ],
          },
          path: {
            type: 'string',
            description:
              'Field path (`stats.strength`) or collection path for a keyed item.',
          },
          key: { type: 'string' },
          label: { type: 'string' },
          field: { type: 'string' },
          before: { type: 'object', additionalProperties: true },
          after: { type: 'object', additionalProperties: true },
          values: { type: 'array', items: { type: 'object' } },
          beforeCount: { type: 'integer' },
          afterCount: { type: 'integer' },
          count: { type: 'integer' },
        },
        additionalProperties: true,
      },
      HistorySession: {
        type: 'object',
        required: [
          'id',
          'startedAt',
          'endedAt',
          'revisionCount',
          'changes',
          'markers',
          'truncated',
        ],
        properties: {
          id: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          endedAt: { type: 'string', format: 'date-time' },
          revisionCount: { type: 'integer' },
          changes: {
            type: 'array',
            items: ref('HistoryChange'),
          },
          markers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source', 'at'],
              properties: {
                source: { type: 'string', enum: ['create', 'migration'] },
                at: { type: 'string', format: 'date-time' },
              },
              additionalProperties: false,
            },
          },
          truncated: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      HistoryPage: {
        type: 'object',
        required: [
          'sessions',
          'nextCursor',
          'totalSessions',
          'totalRevisions',
          'storage',
        ],
        properties: {
          sessions: {
            type: 'array',
            items: ref('HistorySession'),
          },
          nextCursor: { type: ['string', 'null'] },
          totalSessions: { type: 'integer' },
          totalRevisions: { type: 'integer' },
          storage: {
            type: 'object',
            required: ['bytes', 'truncated', 'oldestAt'],
            properties: {
              bytes: { type: 'integer' },
              truncated: { type: 'boolean' },
              oldestAt: { type: ['string', 'null'], format: 'date-time' },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      HistoryClearResult: {
        type: 'object',
        required: ['success', 'deleted'],
        properties: {
          success: { type: 'boolean' },
          deleted: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      MessageResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
        },
        additionalProperties: false,
      },
      HealthResponse: {
        type: 'object',
        required: ['status', 'version', 'uptime', 'timestamp', 'checks'],
        properties: {
          status: {
            type: 'string',
            enum: ['ok', 'degraded'],
            description: '`degraded` is returned with HTTP 503.',
          },
          version: { type: 'string', description: 'Application version.' },
          uptime: {
            type: 'integer',
            description: 'Process uptime in seconds.',
          },
          timestamp: { type: 'string', format: 'date-time' },
          checks: {
            type: 'object',
            required: ['dataDir'],
            additionalProperties: false,
            properties: {
              dataDir: {
                type: 'string',
                enum: ['ok', 'error'],
                description:
                  'Whether the data directory exists and is writable. No path is exposed.',
              },
            },
          },
        },
        additionalProperties: false,
      },
      VersionResponse: {
        type: 'object',
        required: [
          'name',
          'version',
          'commit',
          'commitShort',
          'branch',
          'buildDate',
          'runtime',
        ],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          commit: {
            type: ['string', 'null'],
            description:
              'Commit SHA from DCS_GIT_COMMIT / GIT_COMMIT / VERCEL_GIT_COMMIT_SHA, otherwise read from the local `.git` checkout (HEAD). `null` in an image without `.git` and without env.',
          },
          commitShort: {
            type: ['string', 'null'],
            description:
              'First 7 characters of `commit`, lowercased — the form shown in the UI. `null` when `commit` is `null`.',
          },
          branch: {
            type: ['string', 'null'],
            description:
              'Branch name from DCS_GIT_BRANCH / GIT_BRANCH / VERCEL_GIT_COMMIT_REF, otherwise the HEAD branch of the local checkout. `null` for a detached HEAD, an image without `.git` or env without a branch. Shown only in the version tooltip.',
          },
          buildDate: {
            type: ['string', 'null'],
            format: 'date-time',
            description: 'Build date from DCS_BUILD_DATE.',
          },
          runtime: {
            type: 'object',
            required: ['node'],
            additionalProperties: false,
            properties: {
              node: { type: 'string' },
            },
          },
        },
        additionalProperties: false,
      },
      LogoutRequest: {
        type: 'object',
        properties: {
          all: {
            type: 'boolean',
            description:
              'Revoke every session of the account, not only the current one.',
          },
        },
        additionalProperties: false,
      },
      ProfileUpdateRequest: {
        type: 'object',
        required: ['newUsername', 'newDisplayName'],
        properties: {
          newUsername: { type: 'string' },
          newDisplayName: { type: 'string' },
          newPassword: {
            type: 'string',
            minLength: 12,
            maxLength: 128,
            description:
              'Password policy: at least 12 characters. Omit or send an empty string to keep the current password.',
          },
          newRecoveryPhrase: {
            type: 'string',
            description: 'Empty string removes the phrase.',
          },
          currentPassword: {
            type: 'string',
            description:
              'Required when `newPassword` is set: re-authentication before rotating the password.',
          },
        },
        additionalProperties: false,
      },
      DeleteAccountRequest: {
        type: 'object',
        required: ['password'],
        properties: { password: { type: 'string' } },
        additionalProperties: false,
      },
      PhraseRequest: {
        type: 'object',
        required: ['phrase'],
        properties: { phrase: { type: 'string', minLength: 5 } },
        additionalProperties: false,
      },
      RecoveryToken: {
        type: 'string',
        description:
          'Single-use token from POST /api/auth/recover/verify. Valid for 15 minutes, burned on a successful exchange, and never returned as a session cookie.',
      },
      RecoveryRequest: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: ref('RecoveryToken'),
          newPassword: { type: 'string', minLength: 12, maxLength: 128 },
          newRecoveryPhrase: {
            type: 'string',
            minLength: 5,
            description: 'Optional; when omitted the current phrase is kept.',
          },
        },
        additionalProperties: false,
      },
      RecoveryVerifyRequest: {
        type: 'object',
        required: ['username', 'recoveryPhrase'],
        properties: {
          username: { type: 'string' },
          recoveryPhrase: {
            type: 'string',
            description:
              'The whole phrase. Case and extra spaces are ignored; the set and order of words are not.',
          },
        },
        additionalProperties: false,
      },
      RecoveryVerifyResponse: {
        type: 'object',
        required: ['success', 'token', 'expiresAt'],
        properties: {
          success: { type: 'boolean' },
          token: ref('RecoveryToken'),
          expiresAt: { type: 'string', format: 'date-time' },
        },
        additionalProperties: false,
      },
      RecoveryUpdateRequest: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: ref('RecoveryToken'),
          newPassword: { type: 'string', minLength: 12, maxLength: 128 },
          newRecoveryPhrase: { type: 'string', minLength: 5 },
        },
        additionalProperties: false,
      },
      Quest: {
        type: 'object',
        required: [
          'id',
          'title',
          'status',
          'description',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['active', 'completed'] },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        additionalProperties: true,
      },
      Character: {
        type: 'object',
        required: [
          'id',
          'userId',
          'gameSystem',
          'name',
          'characterClass',
          'backstory',
          'notes',
          'questLog',
        ],
        properties: {
          id: { type: 'string' },
          userId: { type: 'string', format: 'uuid' },
          systemId: {
            type: 'string',
            enum: SYSTEM_IDS,
            description: 'Machine game/edition id; discriminant of the sheet.',
          },
          schemaVersion: {
            type: 'integer',
            description: `Character sheet schema version (${CURRENT_SCHEMA_VERSION}).`,
          },
          gameSystem: {
            type: 'string',
            enum: GAME_SYSTEM_NAMES,
            description: 'Legacy human-readable mirror of systemId.',
          },
          name: { type: 'string' },
          characterClass: { type: 'string' },
          backstory: { type: 'string' },
          notes: { type: 'string' },
          questLog: { type: 'array', items: ref('Quest') },
        },
        additionalProperties: true,
        description:
          'A character sheet. Fields depend on the game/edition; unknown fields are preserved.',
      },
      CharacterInput: {
        type: 'object',
        required: ['name', 'characterClass'],
        description:
          'Validated against the edition schema (`module.schema`). Server-owned fields (`id`, `userId`, `systemId`) and fields outside the schema are ignored, missing fields are filled from the edition defaults, and a payload that does not match the schema is rejected with `400` and a list of `issues`. Maximum body size: 1 MiB (`413`).',
        properties: {
          systemId: {
            type: 'string',
            enum: SYSTEM_IDS,
            description: 'Machine game/edition id; discriminant of the sheet.',
          },
          schemaVersion: {
            type: 'integer',
            description: `Character sheet schema version (${CURRENT_SCHEMA_VERSION}).`,
          },
          gameSystem: {
            type: 'string',
            enum: GAME_SYSTEM_NAMES,
            description: 'Legacy mirror; systemId is preferred.',
          },
          name: { type: 'string' },
          characterClass: { type: 'string' },
          backstory: { type: 'string' },
          notes: { type: 'string' },
          questLog: { type: 'array', items: ref('Quest') },
        },
        additionalProperties: true,
      },
      PortableCharacter: {
        type: 'object',
        required: [
          'id',
          'systemId',
          'schemaVersion',
          'gameSystem',
          'name',
          'characterClass',
        ],
        properties: {
          id: { type: 'string' },
          systemId: {
            type: 'string',
            enum: SYSTEM_IDS,
            description: 'Machine game/edition id; discriminant of the sheet.',
          },
          schemaVersion: {
            type: 'integer',
            description: `Character sheet schema version (${CURRENT_SCHEMA_VERSION}).`,
          },
          gameSystem: {
            type: 'string',
            enum: GAME_SYSTEM_NAMES,
            description: 'Legacy mirror of systemId.',
          },
          name: { type: 'string' },
          characterClass: { type: 'string' },
          backstory: { type: 'string' },
          notes: { type: 'string' },
          questLog: { type: 'array', items: ref('Quest') },
        },
        additionalProperties: true,
        description:
          'Export shape: no `userId`, no migration provenance, no Firestore leftovers.',
      },
      ExportResponse: {
        oneOf: [
          { type: 'array', items: ref('PortableCharacter') },
          ref('PortableCharacter'),
        ],
        description:
          'An array (all sheets) or a single sheet when `characterId` is provided.',
      },
      AdminUser: {
        type: 'object',
        required: [
          'uid',
          'username',
          'displayName',
          'role',
          'isBlocked',
          'characterCount',
          'hasRecoveryPhrase',
          'mustChangePassword',
        ],
        properties: {
          uid: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          displayName: { type: 'string' },
          role: { type: 'string', enum: ['user', 'tester', 'admin'] },
          isBlocked: { type: 'boolean' },
          createdAt: { type: ['string', 'null'], format: 'date-time' },
          updatedAt: { type: ['string', 'null'], format: 'date-time' },
          lastLoginAt: { type: ['string', 'null'], format: 'date-time' },
          characterCount: { type: 'integer' },
          hasRecoveryPhrase: { type: 'boolean' },
          mustChangePassword: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      AdminStats: {
        type: 'object',
        required: ['totalUsers', 'admins', 'blocked', 'totalCharacters'],
        properties: {
          totalUsers: { type: 'integer' },
          admins: { type: 'integer' },
          blocked: { type: 'integer' },
          totalCharacters: { type: 'integer' },
        },
        additionalProperties: false,
      },
      AdminUsersResponse: {
        type: 'object',
        required: ['success', 'users', 'stats'],
        properties: {
          success: { type: 'boolean' },
          users: { type: 'array', items: ref('AdminUser') },
          stats: ref('AdminStats'),
        },
        additionalProperties: false,
      },
      AdminUserResponse: {
        type: 'object',
        required: ['success', 'user'],
        properties: {
          success: { type: 'boolean' },
          user: ref('AdminUser'),
        },
        additionalProperties: false,
      },
      AdminUserPatch: {
        type: 'object',
        minProperties: 1,
        properties: {
          displayName: { type: 'string' },
          username: { type: 'string' },
          password: { type: 'string', minLength: 12, maxLength: 128 },
          role: { type: 'string', enum: ['user', 'tester', 'admin'] },
          isBlocked: { type: 'boolean' },
        },
        additionalProperties: false,
        description:
          'At least one field. You cannot demote/block yourself or remove the last active administrator.',
      },
      AdminCharacterSummary: {
        type: 'object',
        required: [
          'id',
          'name',
          'gameSystem',
          'characterClass',
          'level',
          'rank',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          gameSystem: { type: 'string' },
          characterClass: { type: 'string' },
          level: { type: ['integer', 'null'] },
          rank: { type: ['string', 'null'] },
          updatedAt: { type: ['string', 'null'], format: 'date-time' },
        },
        additionalProperties: false,
      },
      AdminCharactersResponse: {
        type: 'object',
        required: ['success', 'uid', 'characters'],
        properties: {
          success: { type: 'boolean' },
          uid: { type: 'string', format: 'uuid' },
          characters: {
            type: 'array',
            items: ref('AdminCharacterSummary'),
          },
        },
        additionalProperties: false,
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        operationId: 'health',
        summary: 'Service health',
        description:
          'Liveness/readiness probe for Docker, reverse proxies and monitoring. No authentication. Returns 200 when the data directory is writable, otherwise 503 with `status: degraded`. Does not expose paths or secrets.',
        security: [],
        responses: {
          200: jsonResponse('Healthy.', ref('HealthResponse')),
          503: jsonResponse(
            'Degraded: the data directory is missing or not writable.',
            ref('HealthResponse'),
          ),
        },
      },
    },
    '/api/version': {
      get: {
        tags: ['System'],
        operationId: 'version',
        summary: 'Application version and build info',
        description:
          'Application name, version, commit/build date (from environment, otherwise null), a 7-character `commitShort` for UI badges, and the Node runtime version. No authentication and no dependency list.',
        security: [],
        responses: {
          200: jsonResponse('Build information.', ref('VersionResponse')),
        },
      },
    },
    '/api/auth': {
      post: {
        tags: ['Authentication'],
        operationId: 'login',
        summary: 'Log in',
        description:
          'Checks the password and sets the `dcs_session` cookie. Does not create accounts: unknown login returns 404.',
        security: [],
        requestBody: jsonBody(ref('LoginRequest')),
        responses: {
          200: {
            ...jsonResponse('Session cookie set.', ref('AuthSessionResponse')),
            headers: {
              'Set-Cookie': {
                description: '`dcs_session=<uid>.<exp>.<hmac>`',
                schema: { type: 'string' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: errorResponse('Account is blocked by an administrator.'),
          404: errorResponse('No account with this login.'),
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        operationId: 'register',
        summary: 'Create an account',
        description:
          'Creates a new account with a recovery phrase and immediately signs it in. The password policy (12–128 characters) is enforced here; registrations are limited to 10 per 10 minutes per IP + login.',
        security: [],
        requestBody: jsonBody(ref('RegisterRequest')),
        responses: {
          200: {
            ...jsonResponse(
              'Account created, cookie set.',
              ref('AuthSessionResponse'),
            ),
            headers: {
              'Set-Cookie': { schema: { type: 'string' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          409: errorResponse('This login is already registered.'),
          429: { $ref: '#/components/responses/RateLimited' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/exists': {
      post: {
        tags: ['Authentication'],
        operationId: 'accountExists',
        summary: 'Check whether a login is taken',
        description:
          'An enumeration oracle, so it is rate limited: 20 checks per 10 minutes per IP + login, then `429` with `Retry-After`.',
        security: [],
        requestBody: jsonBody(ref('ExistsRequest')),
        responses: {
          200: jsonResponse('Check result.', ref('ExistsResponse')),
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/RateLimited' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/session': {
      get: {
        tags: ['Authentication'],
        operationId: 'currentSession',
        summary: 'Current profile snapshot',
        description:
          'Returns the actual role/username/block state for the session cookie.',
        responses: {
          200: jsonResponse('Current user.', ref('AuthUserResponse')),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        operationId: 'logout',
        summary: 'Log out',
        description:
          'Deletes the server-side session record for the current `jti` and clears the cookie, so a copied cookie stops working immediately. Body `{ "all": true }` ends every session of the account («sign out everywhere»).',
        security: [],
        requestBody: {
          required: false,
          content: jsonContent(ref('LogoutRequest')),
        },
        responses: {
          200: jsonResponse(
            'Cookie cleared, session revoked.',
            ref('SimpleSuccess'),
          ),
        },
      },
    },
    '/api/auth/profile': {
      put: {
        tags: ['Authentication'],
        operationId: 'updateProfile',
        summary: 'Update own profile',
        description:
          'Changes login, display name, password and/or recovery phrase. A blank `newPassword` keeps the current password; a new password must satisfy the 12–128 character policy. Limited to 10 changes per 10 minutes.',
        requestBody: jsonBody(ref('ProfileUpdateRequest')),
        responses: {
          200: jsonResponse('Updated profile.', ref('AuthUserResponse')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: errorResponse('Current password is incorrect.'),
          429: { $ref: '#/components/responses/RateLimited' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      delete: {
        tags: ['Authentication'],
        operationId: 'deleteProfile',
        summary: 'Delete own account',
        description:
          'Irreversibly removes the profile, all character sheets and the login index entry. Requires the current password.',
        requestBody: jsonBody(ref('DeleteAccountRequest')),
        responses: {
          200: jsonResponse('Account deleted.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: errorResponse('Incorrect password.'),
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/phrase': {
      post: {
        tags: ['Authentication'],
        operationId: 'setRecoveryPhrase',
        summary: 'Set own recovery phrase',
        requestBody: jsonBody(ref('PhraseRequest')),
        responses: {
          200: jsonResponse('Phrase saved.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/recover': {
      post: {
        tags: ['Authentication'],
        operationId: 'recoverPassword',
        summary: 'Reset a password with a recovery token',
        description:
          'Legacy alias of POST /api/auth/recover/update: a single-use token from POST /api/auth/recover/verify is required. The old `username` + three-word contract is gone — words from character sheets do not prove account ownership.',
        security: [],
        requestBody: jsonBody(ref('RecoveryRequest')),
        responses: {
          200: jsonResponse('Password reset.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: errorResponse(
            'Missing, expired or already used recovery token.',
          ),
          429: { $ref: '#/components/responses/RateLimited' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/recover/verify': {
      post: {
        tags: ['Authentication'],
        operationId: 'verifyRecovery',
        summary: 'Verify the recovery phrase and get a single-use token',
        description:
          'Compares the whole phrase (case and extra spaces ignored, word order enforced) and returns a single-use token. No session cookie is set: only POST /api/auth/recover/update can change the credentials. Failures share one status and text so the response does not reveal whether the account exists.',
        security: [],
        requestBody: jsonBody(ref('RecoveryVerifyRequest')),
        responses: {
          200: jsonResponse(
            'Phrase accepted, token issued.',
            ref('RecoveryVerifyResponse'),
          ),
          400: { $ref: '#/components/responses/BadRequest' },
          429: { $ref: '#/components/responses/RateLimited' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/recover/update': {
      post: {
        tags: ['Authentication'],
        operationId: 'updateRecoveryCredentials',
        summary: 'Set a new password and recovery phrase with a token',
        security: [],
        requestBody: jsonBody(ref('RecoveryUpdateRequest')),
        responses: {
          200: jsonResponse('Credentials updated.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: errorResponse(
            'Missing, expired or already used recovery token.',
          ),
          429: { $ref: '#/components/responses/RateLimited' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/characters': {
      get: {
        tags: ['Characters'],
        operationId: 'listCharacters',
        summary: 'List own character sheets',
        responses: {
          200: jsonResponse('Array of sheets.', {
            type: 'array',
            items: ref('Character'),
          }),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Characters'],
        operationId: 'createCharacter',
        summary: 'Create a character sheet',
        description:
          'The server assigns `id` and `userId`. The payload is validated by the edition schema: unknown fields are dropped, missing ones are filled from the edition defaults, and invalid structures are rejected.',
        requestBody: jsonBody(ref('CharacterInput')),
        responses: {
          201: jsonResponse('Created sheet.', ref('Character')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          413: errorResponse('Request body exceeds 1 MiB.'),
        },
      },
    },
    '/api/characters/{id}': {
      put: {
        tags: ['Characters'],
        operationId: 'updateCharacter',
        summary: 'Update a character sheet',
        description:
          'Partial update, validated against the edition schema on top of the current sheet: unknown fields and `id`/`userId` are dropped, an invalid structure is rejected with `400` and `issues`. Optional `__page`/`__seq` fields let the server discard a late write.',
        parameters: [paramRef('CharacterId')],
        requestBody: jsonBody(
          {
            type: 'object',
            additionalProperties: true,
            properties: {
              __page: { type: 'string' },
              __seq: { type: 'integer' },
            },
          },
          true,
        ),
        responses: {
          200: jsonResponse('Updated sheet.', ref('Character')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          413: errorResponse('Request body exceeds 1 MiB.'),
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      delete: {
        tags: ['Characters'],
        operationId: 'deleteCharacter',
        summary: 'Delete a character sheet',
        parameters: [paramRef('CharacterId')],
        responses: {
          200: jsonResponse('Deleted.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/characters/{id}/share': {
      get: {
        tags: ['Characters'],
        operationId: 'getCharacterShare',
        summary: 'Current read-only link for a sheet',
        description:
          'Returns link metadata without the token: the token is stored only as a hash and is shown once by POST. A missing or expired link answers `200 { active: false }`.',
        parameters: [paramRef('CharacterId')],
        responses: {
          200: jsonResponse('Link status.', ref('ShareStatus')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      post: {
        tags: ['Characters'],
        operationId: 'createCharacterShare',
        summary: 'Create or rotate a read-only link',
        description:
          'Creates one active link per sheet and revokes the previous one. The token is returned exactly once; only its SHA-256 is stored. The link grants read-only access to the sheet without a session.',
        parameters: [paramRef('CharacterId')],
        requestBody: jsonBody(ref('ShareCreateRequest')),
        responses: {
          201: jsonResponse('Link created; copy it now.', ref('ShareCreated')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          413: errorResponse('Request body exceeds 1 MiB.'),
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      delete: {
        tags: ['Characters'],
        operationId: 'deleteCharacterShare',
        summary: 'Revoke the read-only link',
        description:
          'Idempotent: succeeds even when the link is already gone or the sheet was deleted.',
        parameters: [paramRef('CharacterId')],
        responses: {
          200: jsonResponse('Link revoked.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/characters/{id}/history': {
      get: {
        tags: ['Characters'],
        operationId: 'getCharacterHistory',
        summary: 'Read the character change history',
        description:
          'Owner-only. Returns sessions grouped by a 30-minute gap, newest first, with a `before` cursor for the next page. The response is capped at 50 sessions and about 2000 changes.',
        parameters: [
          paramRef('CharacterId'),
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Sessions per page, 1…100.',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
          {
            name: 'before',
            in: 'query',
            required: false,
            description:
              'ISO timestamp of the oldest session on the previous page.',
            schema: { type: 'string', format: 'date-time' },
          },
        ],
        responses: {
          200: jsonResponse('History page.', ref('HistoryPage')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      delete: {
        tags: ['Characters'],
        operationId: 'deleteCharacterHistory',
        summary: 'Clear the character change history',
        description:
          'Owner-only and irreversible: removes the JSONL log, not the sheet. Idempotent when the log is already gone.',
        parameters: [paramRef('CharacterId')],
        responses: {
          200: jsonResponse('History cleared.', ref('HistoryClearResult')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/export': {
      get: {
        tags: ['Import/Export'],
        operationId: 'exportCharacters',
        summary: 'Export sheets in the portable format',
        parameters: [paramRef('CharacterIdQuery')],
        responses: {
          200: jsonResponse('One sheet or an array.', ref('ExportResponse')),
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/games': {
      get: {
        tags: ['Games'],
        operationId: 'listGames',
        summary: 'Visible games and editions',
        description:
          'Public catalog filtered by the role from the session cookie: published for guests/user, plus test for tester, plus hidden for admin. Also returns the optional site title override.',
        security: [],
        responses: {
          200: jsonResponse('Visible games and current settings.', {
            type: 'object',
            additionalProperties: true,
          }),
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/admin/games': {
      get: {
        tags: ['Admin'],
        operationId: 'adminListGames',
        summary: 'Game catalog (admin)',
        description:
          'Every module from the registry with its default and current visibility status, plus the site title override.',
        responses: {
          200: jsonResponse('Game catalog.', {
            type: 'object',
            additionalProperties: true,
          }),
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      put: {
        tags: ['Admin'],
        operationId: 'adminUpdateGames',
        summary: 'Update visibility or site title (admin)',
        description:
          'Changes the status of one edition (`published`, `test`, `hidden`) and/or the optional site title. Hiding affects creation and menus, not opening existing sheets.',
        requestBody: jsonBody({
          type: 'object',
          properties: {
            systemId: {
              type: 'string',
              enum: SYSTEM_IDS,
            },
            status: {
              type: 'string',
              enum: ['published', 'test', 'hidden'],
            },
            siteTitle: {
              type: ['string', 'null'],
              maxLength: 80,
            },
          },
          additionalProperties: false,
        }),
        responses: {
          200: jsonResponse('Updated catalog.', {
            type: 'object',
            additionalProperties: true,
          }),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        operationId: 'adminListUsers',
        summary: 'List users (admin)',
        description:
          'Returns every valid profile with role, block state, last login and character count.',
        responses: {
          200: jsonResponse(
            'Users and aggregate stats.',
            ref('AdminUsersResponse'),
          ),
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/admin/users/{uid}': {
      patch: {
        tags: ['Admin'],
        operationId: 'adminUpdateUser',
        summary: 'Update a user (admin)',
        description:
          'Updates profile fields, password, role or block state. Self-demotion/block and removal of the last active administrator are rejected.',
        parameters: [paramRef('UserUid')],
        requestBody: jsonBody(ref('AdminUserPatch')),
        responses: {
          200: jsonResponse('Updated user.', ref('AdminUserResponse')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      delete: {
        tags: ['Admin'],
        operationId: 'adminDeleteUser',
        summary: 'Delete a user (admin)',
        description:
          'Deletes the profile, its sheets and login index entries. You cannot delete yourself or the last active administrator.',
        parameters: [paramRef('UserUid')],
        responses: {
          200: jsonResponse('User deleted.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/admin/users/{uid}/characters': {
      get: {
        tags: ['Admin'],
        operationId: 'adminListUserCharacters',
        summary: "List a user's sheets (admin, read-only)",
        parameters: [paramRef('UserUid')],
        responses: {
          200: jsonResponse(
            'Sheet summaries (no content editing).',
            ref('AdminCharactersResponse'),
          ),
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
};

export type OpenApiDocument = typeof openApiDocument;
