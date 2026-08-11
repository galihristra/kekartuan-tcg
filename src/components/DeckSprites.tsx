import type { Player } from '../engine/tournament';
import { getPokemon, pokemonSpriteUrl } from '../lib/pokemon';

export default function DeckSprites({
  player,
  size = 'mini',
}: {
  player: Player | undefined;
  size?: 'mini' | 'xs';
}) {
  const deck1 = getPokemon(player?.deckPokemon1);
  const deck2 = getPokemon(player?.deckPokemon2);
  if (!deck1 && !deck2) return null;
  const cls = `tk-deck-sprite-${size}`;
  return (
    <span className="tk-deck-sprites">
      {deck1 && (
        <img
          className={cls}
          src={pokemonSpriteUrl(deck1)}
          alt={deck1.name}
          loading="lazy"
        />
      )}
      {deck2 && (
        <img
          className={cls}
          src={pokemonSpriteUrl(deck2)}
          alt={deck2.name}
          loading="lazy"
        />
      )}
    </span>
  );
}
