// ─────────────────────────────────────────────────────────────────────────────
// Seed ghost spots — shared by the web mock (T1) and the server seed (T2/T4).
// Replace coords with locations near the hackathon venue before the demo.
// `curated: true` spots should have pre-generated story + audio (RESEARCH.md §4).
// ─────────────────────────────────────────────────────────────────────────────

import type { GhostSpot } from "./types.js";

export const SEED_SPOTS: GhostSpot[] = [
  {
    id: "weeping-lady",
    title: "The Weeping Lady of Dock Street",
    lat: 51.5079,
    lng: -0.0877,
    unlockRadius: 40,
    icon: "ghost-lady",
    seed: "a heartbroken Victorian dockworker's widow",
    curated: true,
  },
  {
    id: "clockwork-boy",
    title: "The Clockwork Boy",
    lat: 51.5074,
    lng: -0.1278,
    unlockRadius: 40,
    icon: "ghost-child",
    seed: "an apprentice who never left the watchmaker's shop",
    curated: true,
  },
  {
    id: "lantern-keeper",
    title: "The Lantern Keeper",
    lat: 51.5033,
    lng: -0.1196,
    unlockRadius: 45,
    icon: "ghost-lantern",
    seed: "a lighthouse keeper guarding a river that no longer floods",
    curated: true,
  },
  {
    id: "whispering-alley",
    title: "Whispering Alley",
    lat: 51.5155,
    lng: -0.1419,
    unlockRadius: 35,
    icon: "ghost-whisper",
    seed: "voices of a market that burned three centuries ago",
    curated: true,
  },
];

export function getSpot(id: string): GhostSpot | undefined {
  return SEED_SPOTS.find((s) => s.id === id);
}
