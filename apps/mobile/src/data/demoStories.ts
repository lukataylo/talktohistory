import type { GhostSpot, Story } from "@tth/shared";

export function buildDemoStory(spot: GhostSpot): Story {
  const seed = spot.seed ?? "a local spirit waiting to be noticed";

  return {
    spotId: spot.id,
    title: spot.title,
    narration:
      `You step into the edge of ${spot.title}, and the street seems to hold its breath. ` +
      `The signal sharpens around ${seed}. A cold thread of sound follows your footsteps, ` +
      "then pauses when you do. The story is close enough to answer now: look for one detail " +
      "that feels out of place, frame it, and leave with proof that the past has noticed you.",
    challenge: {
      type: "selfie",
      instruction: "Capture a haunted detail at this stop to seal it into today's memory."
    }
  };
}
