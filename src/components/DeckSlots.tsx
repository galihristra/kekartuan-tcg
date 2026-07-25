import { getPokemon, pokemonSpriteUrl } from '../lib/pokemon';
import PokemonCombobox from './PokemonCombobox';

interface DeckSlotsProps {
  slot1: string | null;
  slot2: string | null;
  onChange1: (id: string | null) => void;
  onChange2: (id: string | null) => void;
}

/** The two-Pokémon deck namesake picker, shared by the organizer's deck editor
 *  and the participant registration form. Each slot shows either the picked
 *  Pokémon as a clearable chip or a search combobox. */
export default function DeckSlots({
  slot1,
  slot2,
  onChange1,
  onChange2,
}: DeckSlotsProps) {
  const renderSlot = (
    id: string | null,
    onChange: (id: string | null) => void,
    excludeId: string | null,
  ) => {
    const entry = getPokemon(id ?? undefined);
    if (entry) {
      return (
        <div className="tk-deck-chip">
          <img
            className="tk-deck-sprite"
            src={pokemonSpriteUrl(entry)}
            alt=""
            width={32}
            height={32}
          />
          <span>{entry.name.toLowerCase()}</span>
          <button
            className="tk-x"
            onClick={() => onChange(null)}
            aria-label={`Remove ${entry.name}`}
          >
            ×
          </button>
        </div>
      );
    }
    return (
      <PokemonCombobox onChange={onChange} excludeId={excludeId ?? undefined} />
    );
  };

  return (
    <div className="tk-deck-slots">
      {renderSlot(slot1, onChange1, slot2)}
      {renderSlot(slot2, onChange2, slot1)}
    </div>
  );
}
