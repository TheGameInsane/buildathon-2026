/** Simulated network latency for the mock API layer. */
export function delay(ms = 250 + Math.random() * 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
