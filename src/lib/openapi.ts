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
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Digital Character Sheets API',
    version: '1.0.0',
    description: [
      'REST API for Digital Character Sheets — D&D 5e and Dark Heresy sheets.',
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
      description: 'Portable JSON export and legacy Firestore import.',
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
          'Signed HttpOnly session cookie. Set by /api/auth, /api/auth/register and /api/auth/recover/verify.',
      },
    },
    parameters: {
      CharacterId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Character sheet id (the file name without `.json`).',
        schema: { type: 'string' },
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
          password: { type: 'string', minLength: 4 },
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
          password: { type: 'string', minLength: 4 },
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
          'buildDate',
          'runtime',
        ],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          commit: {
            type: ['string', 'null'],
            description:
              'Build commit from DCS_GIT_COMMIT / GIT_COMMIT / VERCEL_GIT_COMMIT_SHA.',
          },
          commitShort: {
            type: ['string', 'null'],
            description:
              'First 7 characters of `commit`, lowercased — the form shown in the UI. `null` when `commit` is `null`.',
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
      ProfileUpdateRequest: {
        type: 'object',
        required: ['newUsername', 'newDisplayName'],
        properties: {
          newUsername: { type: 'string' },
          newDisplayName: { type: 'string' },
          newPassword: { type: 'string', minLength: 4 },
          newRecoveryPhrase: {
            type: 'string',
            description: 'Empty string removes the phrase.',
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
      RecoveryRequest: {
        type: 'object',
        required: ['username', 'word1', 'word2', 'word3', 'newPassword'],
        properties: {
          username: { type: 'string' },
          word1: { type: 'string' },
          word2: { type: 'string' },
          word3: { type: 'string' },
          newPassword: { type: 'string', minLength: 4 },
        },
        additionalProperties: false,
      },
      RecoveryVerifyRequest: {
        type: 'object',
        required: [
          'username',
          'word1',
          'word2',
          'word3',
          'recoveryPhraseInput',
        ],
        properties: {
          username: { type: 'string' },
          word1: { type: 'string' },
          word2: { type: 'string' },
          word3: { type: 'string' },
          recoveryPhraseInput: { type: 'string' },
        },
        additionalProperties: false,
      },
      RecoveryUpdateRequest: {
        type: 'object',
        required: ['username', 'newPassword', 'newRecoveryPhrase'],
        properties: {
          username: { type: 'string' },
          newPassword: { type: 'string', minLength: 4 },
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
            enum: ['dnd5e', 'dh1', 'dh2'],
            description: 'Machine game/edition id; discriminant of the sheet.',
          },
          schemaVersion: {
            type: 'integer',
            description: 'Character sheet schema version (2).',
          },
          gameSystem: {
            type: 'string',
            enum: ['Dungeons & Dragons', 'Dark Heresy'],
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
        properties: {
          systemId: {
            type: 'string',
            enum: ['dnd5e', 'dh1', 'dh2'],
            description: 'Machine game/edition id; discriminant of the sheet.',
          },
          schemaVersion: {
            type: 'integer',
            description: 'Character sheet schema version (2).',
          },
          gameSystem: {
            type: 'string',
            enum: ['Dungeons & Dragons', 'Dark Heresy'],
            description: 'Legacy mirror; systemId is preferred.',
          },
          name: { type: 'string' },
          characterClass: { type: 'string' },
          backstory: { type: 'string' },
          notes: { type: 'string' },
          questLog: { type: 'array', items: ref('Quest') },
        },
        additionalProperties: true,
        description:
          'Character payload. `id`/`userId` are assigned by the server.',
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
            enum: ['dnd5e', 'dh1', 'dh2'],
            description: 'Machine game/edition id; discriminant of the sheet.',
          },
          schemaVersion: {
            type: 'integer',
            description: 'Character sheet schema version (2).',
          },
          gameSystem: {
            type: 'string',
            enum: ['Dungeons & Dragons', 'Dark Heresy'],
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
      ImportUser: {
        type: 'object',
        required: [
          'localUserId',
          'username',
          'password',
          'charactersImported',
          'characters',
        ],
        properties: {
          localUserId: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          password: { type: 'string' },
          charactersImported: { type: 'integer' },
          characters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                system: { type: 'string' },
              },
              additionalProperties: true,
            },
          },
        },
        additionalProperties: true,
      },
      ImportResponse: {
        type: 'object',
        required: ['success', 'message', 'users'],
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          defaultPassword: { type: 'string' },
          users: { type: 'array', items: ref('ImportUser') },
          note: { type: 'string' },
        },
        additionalProperties: true,
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
          password: { type: 'string', minLength: 4 },
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
          'Creates a new account with a recovery phrase and immediately signs it in.',
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
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/exists': {
      post: {
        tags: ['Authentication'],
        operationId: 'accountExists',
        summary: 'Check whether a login is taken',
        security: [],
        requestBody: jsonBody(ref('ExistsRequest')),
        responses: {
          200: jsonResponse('Check result.', ref('ExistsResponse')),
          400: { $ref: '#/components/responses/BadRequest' },
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
        description: 'Clears the session cookie.',
        security: [],
        responses: {
          200: jsonResponse('Cookie cleared.', ref('SimpleSuccess')),
        },
      },
    },
    '/api/auth/profile': {
      put: {
        tags: ['Authentication'],
        operationId: 'updateProfile',
        summary: 'Update own profile',
        description:
          'Changes login, display name, password and/or recovery phrase. A blank `newPassword` keeps the current password.',
        requestBody: jsonBody(ref('ProfileUpdateRequest')),
        responses: {
          200: jsonResponse('Updated profile.', ref('AuthUserResponse')),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
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
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/recover': {
      post: {
        tags: ['Authentication'],
        operationId: 'recoverPassword',
        summary: 'Reset a password with recovery words',
        description:
          'Checks three words found in the account sheets plus the recovery phrase, then sets a new password.',
        security: [],
        requestBody: jsonBody(ref('RecoveryRequest')),
        responses: {
          200: jsonResponse('Password reset.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/recover/verify': {
      post: {
        tags: ['Authentication'],
        operationId: 'verifyRecovery',
        summary: 'Verify ownership and sign in',
        description:
          'Checks three words from the sheets and the recovery phrase. On success returns the user and sets the session cookie.',
        security: [],
        requestBody: jsonBody(ref('RecoveryVerifyRequest')),
        responses: {
          200: {
            ...jsonResponse(
              'Recovery verified, cookie set.',
              ref('AuthUserResponse'),
            ),
            headers: { 'Set-Cookie': { schema: { type: 'string' } } },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/auth/recover/update': {
      post: {
        tags: ['Authentication'],
        operationId: 'updateRecoveryCredentials',
        summary: 'Set a new password and recovery phrase',
        security: [],
        requestBody: jsonBody(ref('RecoveryUpdateRequest')),
        responses: {
          200: jsonResponse('Credentials updated.', ref('SimpleSuccess')),
          400: { $ref: '#/components/responses/BadRequest' },
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
          'The server assigns `id` and `userId`; other fields are stored as-is.',
        requestBody: jsonBody(ref('CharacterInput')),
        responses: {
          201: jsonResponse('Created sheet.', ref('Character')),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/characters/{id}': {
      put: {
        tags: ['Characters'],
        operationId: 'updateCharacter',
        summary: 'Update a character sheet',
        description:
          'Partial update. Optional `__page`/`__seq` fields let the server discard a late write.',
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
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
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
    '/api/import': {
      get: {
        tags: ['Import/Export'],
        operationId: 'importLegacyData',
        summary: 'Import a legacy Firestore export',
        description:
          'Legacy maintenance endpoint. Reads `<data-dir>/import-source.json`, creates local accounts and converts sheets. Deletes the import file on success.',
        deprecated: true,
        security: [],
        responses: {
          200: jsonResponse('Import summary.', ref('ImportResponse')),
          400: { $ref: '#/components/responses/BadRequest' },
          404: errorResponse('`data/import-source.json` not found.'),
          500: { $ref: '#/components/responses/ServerError' },
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
              enum: ['dnd5e', 'dh1', 'dh2'],
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
