// Top-level shell: drops the user STRAIGHT into the map (App) — no login gate.
// Sign-up is OPTIONAL: a small "Sign in" affordance opens the magic-link screen
// on demand; until then the user explores anonymously.
import { useState } from "react";
import { useAuth, type User } from "./auth";
import { Login } from "./screens/Login";
import { App } from "./App";

export function AppShell() {
  const { user, signIn, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // Optional auth screen — only shown if the user chooses to sign in.
  if (showLogin && !user) {
    return (
      <Login
        onAuthed={(u: User) => {
          signIn(u);
          setShowLogin(false);
        }}
        onBack={() => setShowLogin(false)}
      />
    );
  }

  return (
    <>
      <App />
      {user && !user.guest ? (
        <button
          className="signout-fab"
          type="button"
          onClick={signOut}
          title={`Sign out ${user.email}`}
        >
          Sign out
        </button>
      ) : (
        <button className="signout-fab" type="button" onClick={() => setShowLogin(true)}>
          Sign in
        </button>
      )}
    </>
  );
}
