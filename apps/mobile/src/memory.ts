let nextMemoryId = 1;

export function makeMemoryId() {
  nextMemoryId += 1;
  return `local-memory-${Date.now()}-${nextMemoryId}`;
}
