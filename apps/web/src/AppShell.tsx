// Top-level router/gate: Landing -> Login -> App (the map experience).
// Auth state decides whether the map is shown. Sub-agents should NOT edit this
// file; it is the integration seam owned by the lead.
import { useState } from "react";
import { useAuth, type User } from "./auth";
import { Landing } from "./screens/Landing";
import { Login } from "./screens/Login";
import { App } from "./App";

type Route = "landing" | "login";

export function AppShell() {
  const { user, signIn, signOut } = useAuth();
  const [route, setRoute] = useState<Route>("landing");

  if (user) {
    // App is owned/edited by another track; render it untouched and overlay a
    // minimal sign-out so we don't modify App.tsx (avoids a concurrent-edit collision).
    return (
      <>
        <App />
        <button className="signout-fab" type="button" onClick={signOut} title={`Sign out ${user.name}`}>
          Sign out
        </button>
      </>
    );
  }

  if (route === "login") {
    return <Login onAuthed={(u: User) => signIn(u)} onBack={() => setRoute("landing")} />;
  }

  return (
    <Landing
      onGetStarted={() => setRoute("login")}
      onGuest={() => signIn({ name: "Guest", guest: true })}
    />
  );
}
