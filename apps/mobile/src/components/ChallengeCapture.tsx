import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GhostSpot } from "@tth/shared";

type ChallengeCaptureProps = {
  spot: GhostSpot | null;
  visible: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function ChallengeCapture({ spot, visible, onSave, onCancel }: ChallengeCaptureProps) {
  if (!visible || !spot) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.preview}>
        <View style={styles.focusMark} />
        <Text style={styles.previewText}>Camera placeholder</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Seal this encounter</Text>
        <Text style={styles.body}>
          The production flow will open the camera, send the capture for sticker generation, and save it under today's memory.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSave} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Save memory</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 14,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#242620",
    borderWidth: 1,
    borderColor: "#4f5a4d"
  },
  preview: {
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#11130f",
    borderWidth: 1,
    borderColor: "#5d6759"
  },
  focusMark: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "#f4c95d"
  },
  previewText: {
    color: "#f8f0d8",
    fontSize: 15,
    fontWeight: "800"
  },
  copy: {
    gap: 6
  },
  title: {
    color: "#fffaf0",
    fontSize: 18,
    fontWeight: "900"
  },
  body: {
    color: "#d8d2c1",
    fontSize: 14,
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  secondaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#3c4138"
  },
  primaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f4c95d"
  },
  secondaryText: {
    color: "#fffaf0",
    fontSize: 14,
    fontWeight: "900"
  },
  primaryText: {
    color: "#2f2718",
    fontSize: 14,
    fontWeight: "900"
  }
});
