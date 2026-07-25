import { useState } from 'react';
import type { Player } from '../engine/tournament';
import DeckSlots from './DeckSlots';
import Modal from './Modal';

interface DeckEditModalProps {
  open: boolean;
  onClose: () => void;
  eventName: string;
  player: Player;
  onSave: (deckPokemon1: string | null, deckPokemon2: string | null) => void;
}

export default function DeckEditModal({
  open,
  onClose,
  eventName,
  player,
  onSave,
}: DeckEditModalProps) {
  const [slot1, setSlot1] = useState<string | null>(
    player.deckPokemon1 ?? null,
  );
  const [slot2, setSlot2] = useState<string | null>(
    player.deckPokemon2 ?? null,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${player.name}'s deck for ${eventName}`}
      className="tk-modal--wide"
    >
      <DeckSlots
        slot1={slot1}
        slot2={slot2}
        onChange1={setSlot1}
        onChange2={setSlot2}
      />
      <button
        className="tk-btn tk-deck-save"
        onClick={() => onSave(slot1, slot2)}
      >
        Save
      </button>
    </Modal>
  );
}
