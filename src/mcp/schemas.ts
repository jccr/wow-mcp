import {
  regionSchema,
  localeSchema,
  gameSchema,
  namespaceOverrideSchema,
  characterParams,
} from '../blizzard/endpoints/types.js';

export const characterInputSchema = {
  region: regionSchema,
  locale: localeSchema,
  game: gameSchema,
  namespace: namespaceOverrideSchema,
  ...characterParams,
};
