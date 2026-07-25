import pokemonList from '../data/pokemon.json';

export interface PokemonEntry {
  id: string;
  name: string;
  sprite: string;
}

export const POKEMON_LIST: PokemonEntry[] = pokemonList;

/** The shape of a national dex id, mirroring the `deck_pokemon_*` check
 *  constraints in supabase/schema.sql.
 *
 *  Five digits, not four: alternate/mega/regional forms sit in the 10001-10326
 *  range, and a four-digit limit silently made 97 of these entries impossible to
 *  self-register with. `registrationAdmission.test.ts` asserts every id here
 *  still matches, so refreshing the data can't quietly reintroduce that. */
export const DECK_ID_PATTERN = /^[0-9]{1,5}$/;

const POKEMON_BY_ID = new Map<string, PokemonEntry>(
  POKEMON_LIST.map((entry) => [entry.id, entry]),
);

export function getPokemon(id: string | undefined): PokemonEntry | undefined {
  return id ? POKEMON_BY_ID.get(id) : undefined;
}

export function pokemonSpriteUrl(entry: PokemonEntry): string {
  return `/pokemon-sprites/${entry.sprite}`;
}

export function filterPokemon(
  query: string,
  list: PokemonEntry[] = POKEMON_LIST,
  limit = 25,
): PokemonEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: PokemonEntry[] = [];
  for (const entry of list) {
    if (entry.name.toLowerCase().includes(q)) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}
