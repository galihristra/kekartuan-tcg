import { useMemo, useState } from 'react';
import { useCombobox } from 'downshift';
import {
  filterPokemon,
  pokemonSpriteUrl,
  type PokemonEntry,
} from '../lib/pokemon';

interface PokemonComboboxProps {
  onChange: (id: string) => void;
  excludeId?: string;
  placeholder?: string;
}

export default function PokemonCombobox({
  onChange,
  excludeId,
  placeholder = 'Search Pokémon…',
}: PokemonComboboxProps) {
  const [inputValue, setInputValue] = useState('');

  const items = useMemo(() => {
    const results = filterPokemon(inputValue);
    return excludeId ? results.filter((e) => e.id !== excludeId) : results;
  }, [inputValue, excludeId]);

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
  } = useCombobox<PokemonEntry>({
    items,
    inputValue,
    itemToString: (item) => item?.name ?? '',
    onInputValueChange: ({ inputValue: next }) => setInputValue(next ?? ''),
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) onChange(selectedItem.id);
    },
  });

  return (
    <div className="tk-combobox">
      <input
        className="tk-combobox-input"
        placeholder={placeholder}
        {...getInputProps()}
      />
      {isOpen && inputValue.length > 2 && (
        <ul className="tk-combobox-list" {...getMenuProps()}>
          {items.map((item, index) => (
            <li
              className={`tk-combobox-option ${
                highlightedIndex === index ? 'highlighted' : ''
              }`}
              key={item.id}
              {...getItemProps({ item, index })}
            >
              <img
                className="tk-deck-sprite"
                src={pokemonSpriteUrl(item)}
                alt=""
                loading="lazy"
                width={32}
                height={32}
              />
              <span>{item.name}</span>
            </li>
          ))}
          {isOpen && items.length === 0 && inputValue.trim() && (
            <li className="tk-combobox-empty">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}
