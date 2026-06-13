// Top-level shell: shows the LANDING page first, then drops the user into the
// map (App). There is NO login gate — the landing's primary CTA enters the map
// directly. Sign-up stays OPTIONAL: the landing's "Sign in" link (and a small
// FAB in the app) open the magic-link screen on demand; until then the user
// explores anonymously.
import { useState } from "react";
import { useAuth, type User } from "./auth";
import { Landing } from "./screens/Landing";
import { Login } from "./screens/Login";
import { App } from "./App";

const ENTERED_KEY = "nearpast.entered.v1";

function readEntered(): boolean {
  try {
    return localStorage.getItem(ENTERED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const { user, signIn, signOut } = useAuth();
  // Returning visitors (and anyone who has signed in) skip straight to the map.
  const [entered, setEntered] = useState(() => readEntered() || Boolean(user));
  const [showLogin, setShowLogin] = useState(false);

  function enter() {
    try {
      localStorage.setItem(ENTERED_KEY, "1");
    } catch {
      // Ignore storage failures (private mode): the user still enters this session.
    }
    setEntered(true);
  }

  // Optional auth screen — only shown if the user chooses to sign in.
  if (showLogin && !user) {
    return (
      <Login
        onAuthed={(u: User) => {
          signIn(u);
          setShowLogin(false);
          enter();
        }}
        onBack={() => setShowLogin(false)}
      />
    );
  }

  // Landing is the entry screen. Both paths are optional-auth, never a gate.
  if (!entered) {
    return <Landing onEnter={enter} onSignIn={() => setShowLogin(true)} />;
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
