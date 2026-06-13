import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GhostSpot, Story } from "@tth/shared";

type StoryCardProps = {
  spot: GhostSpot | null;
  story: Story | null;
  distanceLabel: string;
  isUnlocked: boolean;
  onDemoUnlock: () => void;
  onCapture: () => void;
};

export function StoryCard({
  spot,
  story,
  distanceLabel,
  isUnlocked,
  onDemoUnlock,
  onCapture
}: StoryCardProps) {
  if (!spot) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Select a pin</Text>
        <Text style={styles.title}>Find a ghost story nearby</Text>
        <Text style={styles.body}>Tap any ghost pin to preview the stop, then use demo proximity or live location to unlock it.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{isUnlocked ? "Unlocked" : "Locked"}</Text>
        </View>
        <Text style={styles.distance}>{distanceLabel}</Text>
      </View>
      <Text style={styles.title}>{spot.title}</Text>

      {story && isUnlocked ? (
        <>
          <Text style={styles.body}>{story.narration}</Text>
          <View style={styles.challenge}>
            <Text style={styles.challengeLabel}>Challenge</Text>
            <Text style={styles.challengeText}>{story.challenge.instruction}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onCapture} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Capture placeholder</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Move within this stop's unlock radius, or trigger a synthetic approach for the hackathon demo.
          </Text>
          <Pressable accessibilityRole="button" onPress={onDemoUnlock} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Demo proximity unlock</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#d8cbb3"
  },
  row: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#352f2a"
  },
  statusText: {
    color: "#fffaf0",
    fontSize: 12,
    fontWeight: "800"
  },
  distance: {
    color: "#5f6358",
    fontSize: 13,
    fontWeight: "700"
  },
  kicker: {
    color: "#6d5f4c",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#242620",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27
  },
  body: {
    color: "#42463d",
    fontSize: 15,
    lineHeight: 22
  },
  challenge: {
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#e8eee6",
    borderWidth: 1,
    borderColor: "#c7d2c3"
  },
  challengeLabel: {
    color: "#315241",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  challengeText: {
    color: "#2f3b34",
    fontSize: 14,
    lineHeight: 20
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#9f3d55"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  }
});
