import { StyleSheet, Text, View } from "react-native";
import type { Memory } from "@tth/shared";

type MemoryDayViewProps = {
  day: string;
  memories: Memory[];
};

export function MemoryDayView({ day, memories }: MemoryDayViewProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Memory day</Text>
        <Text style={styles.title}>{day}</Text>
      </View>

      {memories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No captures yet</Text>
          <Text style={styles.emptyBody}>Unlock a story on the map and save the capture placeholder to start today's route.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {memories.map((memory, index) => (
            <View key={memory.id} style={styles.memoryCard}>
              <View style={styles.sticker}>
                <Text style={styles.stickerText}>{index + 1}</Text>
              </View>
              <Text style={styles.memoryTitle}>{memory.caption ?? "Captured encounter"}</Text>
              <Text style={styles.memoryMeta}>{new Date(memory.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16
  },
  header: {
    gap: 4
  },
  kicker: {
    color: "#6d5f4c",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: "#242620",
    fontSize: 28,
    fontWeight: "900"
  },
  empty: {
    gap: 8,
    padding: 18,
    borderRadius: 8,
    backgroundColor: "#eef1e8",
    borderWidth: 1,
    borderColor: "#cbd5c6"
  },
  emptyTitle: {
    color: "#27312b",
    fontSize: 18,
    fontWeight: "900"
  },
  emptyBody: {
    color: "#4d584f",
    fontSize: 14,
    lineHeight: 20
  },
  grid: {
    gap: 12
  },
  memoryCard: {
    minHeight: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#d8cbb3"
  },
  sticker: {
    width: 72,
    height: 72,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#9f3d55",
    borderWidth: 4,
    borderColor: "#ffffff"
  },
  stickerText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900"
  },
  memoryTitle: {
    flex: 1,
    color: "#242620",
    fontSize: 16,
    fontWeight: "900"
  },
  memoryMeta: {
    color: "#6d7569",
    fontSize: 13,
    fontWeight: "800"
  }
});
