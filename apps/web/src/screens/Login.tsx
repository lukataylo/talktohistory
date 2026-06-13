// Login screen (skeleton). A sub-agent will polish visuals into screens.css.
// Contract: collect a name (and optional email), then call onAuthed(user).
import { useState } from "react";
import type { User } from "../auth";

export function Login({
  onAuthed,
  onBack,
}: {
  onAuthed: (user: User) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAuthed({ name: trimmed, email: email.trim() || undefined });
  }

  return (
    <main className="screen login">
      <form className="screen-card glass-panel" onSubmit={submit}>
        <button className="icon-button screen-back" type="button" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h1>Create your explorer profile</h1>
        <p>Your unlocked places and stickers are saved to this profile.</p>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus />
        </label>
        <label className="field">
          <span>Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <button className="primary-button" type="submit" disabled={!name.trim()}>
          Start exploring
        </button>
      </form>
    </main>
  );
}
