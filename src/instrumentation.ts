export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { forceIPv4Outbound } = await import("@/lib/network");
    forceIPv4Outbound();
  }
}
