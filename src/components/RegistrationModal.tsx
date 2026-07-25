import { useState } from 'react';
import {
  DuplicateRegistrationError,
  InvalidRegistrationError,
  REGISTRATION_EMAIL_MAX_LENGTH,
  REGISTRATION_NAME_MAX_LENGTH,
  submitRegistration,
} from '../lib/eventStore';
import { markRegisteredLocally } from '../lib/selfRegistration';
import DeckSlots from './DeckSlots';
import Modal from './Modal';

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  /** Called after a successful submit so the page can swap the join button for
   *  the "you're registered" state. */
  onRegistered: () => void;
}

/** Participant self-sign-up for the running event. No account needed — the
 *  submission lands in the organizer's pending list for admission. */
export default function RegistrationModal({
  open,
  onClose,
  eventId,
  eventName,
  onRegistered,
}: RegistrationModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [slot1, setSlot1] = useState<string | null>(null);
  const [slot2, setSlot2] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const nameValid = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!nameValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitRegistration({
        eventId,
        name,
        email,
        deckPokemon1: slot1,
        deckPokemon2: slot2,
      });
      markRegisteredLocally(eventId, name.trim());
      setDone(true);
      onRegistered();
    } catch (e) {
      if (
        e instanceof DuplicateRegistrationError ||
        e instanceof InvalidRegistrationError
      ) {
        setError(e.message);
      } else {
        console.error('Registration failed', e);
        setError(
          "Couldn't submit your registration. Check your connection and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={`You're in — ${eventName}`}
        className="tk-modal--wide"
      >
        <p className="tk-hint tk-reg-done">
          Thanks, {name.trim()}. The organizer will confirm you shortly and your
          name will appear in the participants list. Need to change your deck?
          Just let the organizer know at the event.
        </p>
        <button className="tk-btn tk-deck-save" onClick={onClose}>
          Done
        </button>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Join ${eventName}`}
      className="tk-modal--wide"
    >
      <div className="tk-reg-field">
        <label htmlFor="tk-reg-name">Your name</label>
        <input
          id="tk-reg-name"
          className="tk-modal-input"
          value={name}
          maxLength={REGISTRATION_NAME_MAX_LENGTH}
          placeholder="Name the organizer will call you by"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="tk-reg-field">
        <label htmlFor="tk-reg-email">
          Email <span className="tk-hint">(optional)</span>
        </label>
        <input
          id="tk-reg-email"
          className="tk-modal-input"
          type="email"
          value={email}
          maxLength={REGISTRATION_EMAIL_MAX_LENGTH}
          placeholder="So the organizer can reach you"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="tk-reg-field">
        <label>
          Your deck <span className="tk-hint">(optional)</span>
        </label>
        <DeckSlots
          slot1={slot1}
          slot2={slot2}
          onChange1={setSlot1}
          onChange2={setSlot2}
        />
      </div>

      {error && <p className="tk-error tk-reg-error">{error}</p>}

      <button
        className="tk-btn tk-deck-save"
        disabled={!nameValid || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Submitting…' : 'Join event'}
      </button>
    </Modal>
  );
}
