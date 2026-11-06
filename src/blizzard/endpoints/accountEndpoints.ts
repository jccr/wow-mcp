import type { EndpointDef } from './types.js';
import { id } from './types.js';

/**
 * World of Warcraft Account Profile API endpoint definitions.
 * Namespace: profile-{region} (or profile-{game}-{region}).
 *
 * These require a Battle.net *user* access token (authorization code flow,
 * scope `wow.profile`). The user links their account with the
 * `wow_account_login` tool; see src/blizzard/userAuth.ts.
 */
export const accountEndpoints: EndpointDef[] = [
  {
    toolName: 'wow_account_profileSummary',
    title: 'Account Profile Summary',
    description:
      'Returns the logged-in Battle.net account\'s WoW profile: every WoW account and its characters (name, realm, level, class, race, faction, character id, realm id). Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
  {
    toolName: 'wow_account_protectedCharacter',
    title: 'Protected Character Profile',
    description:
      'Returns a protected profile (money, location, bind position, etc.) for one of the logged-in account\'s characters. Get realmId and characterId from wow_account_profileSummary. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/protected-character/{realmId}-{characterId}',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {
      realmId: id('Realm ID (from wow_account_profileSummary)'),
      characterId: id('Character ID (from wow_account_profileSummary)'),
    },
  },
  {
    toolName: 'wow_account_collectionsIndex',
    title: 'Account Collections Index',
    description:
      'Returns an index of the logged-in account\'s collection types. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/collections',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
  {
    toolName: 'wow_account_mountsCollection',
    title: 'Account Mounts Collection',
    description:
      'Returns the logged-in account\'s mount collection. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/collections/mounts',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
  {
    toolName: 'wow_account_petsCollection',
    title: 'Account Pets Collection',
    description:
      'Returns the logged-in account\'s battle pet collection. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/collections/pets',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
  {
    toolName: 'wow_account_toysCollection',
    title: 'Account Toys Collection',
    description:
      'Returns the logged-in account\'s toy collection. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/collections/toys',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
  {
    toolName: 'wow_account_transmogsCollection',
    title: 'Account Transmogs Collection',
    description:
      'Returns the logged-in account\'s transmog (appearance) collection. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/collections/transmogs',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
  {
    toolName: 'wow_account_heirloomsCollection',
    title: 'Account Heirlooms Collection',
    description:
      'Returns the logged-in account\'s heirloom collection. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/collections/heirlooms',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
  {
    toolName: 'wow_account_decorCollection',
    title: 'Account Decor Collection',
    description:
      'Returns the logged-in account\'s housing decor collection. Requires Battle.net login (wow_account_login).',
    path: 'profile/user/wow/collections/decor',
    namespace: 'profile',
    auth: 'user',
    inputSchema: {},
  },
];
