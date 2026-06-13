import type { GhostSpot, Story } from "@tth/shared";

export function buildDemoStory(spot: GhostSpot): Story {
  const seed = spot.seed ?? "a local favorite waiting to be noticed";

  return {
    spotId: spot.id,
    title: spot.title,
    narration:
      `You step into ${spot.title}, and the map starts to feel personal. ` +
      `The signal sharpens around ${seed}. A detail you would normally miss pulls into focus, ` +
      "then another. The place is close enough to answer now: frame one object, texture, or corner " +
      "that explains why someone would save this spot.",
    challenge: {
      type: "selfie",
      instruction: "Capture the detail that makes this stop feel like someone's favorite place."
    }
  };
}
