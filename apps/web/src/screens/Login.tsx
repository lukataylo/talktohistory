// Login screen. Visuals live in screens.css.
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
      <form className="screen-card login-card glass-panel" onSubmit={submit}>
        <button
          className="icon-button screen-back"
          type="button"
          onClick={onBack}
          aria-label="Back"
        >
          ←
        </button>

        <span className="login-crest" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" fill="currentColor" />
            <circle cx="12" cy="10" r="2.6" fill="#ece8dc" />
          </svg>
        </span>

        <h1>Create your explorer profile</h1>
        <p>Your unlocked places and stickers are saved to this profile.</p>

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Email <em className="field-opt">optional</em></span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <button className="primary-button login-cta" type="submit" disabled={!name.trim()}>
          Start exploring
        </button>

        <p className="login-fineprint">No password, no wait — just a name to pin to your discoveries.</p>
      </form>
    </main>
  );
}
