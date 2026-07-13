import { setDefaultResultOrder } from "node:dns";
import { setGlobalDispatcher, Agent } from "undici";

// Some hosts advertise an IPv6 (AAAA) record that isn't actually reachable
// from this environment's network, and the IPv6 connection attempt hangs
// until timeout instead of failing over to IPv4 quickly the way curl's
// OS-level connect() does. Forcing IPv4-only avoids that stall — this
// matters because the platform calls arbitrary developer-hosted endpoints
// (worker execution), third-party APIs (verification agents), and its own
// infra (Neon over WebSocket, Redis), none of whose DNS/network setup we
// control.
//
// Two separate fixes are needed: `fetch()` (undici) has its own connector
// and ignores Node's DNS order, so it needs the explicit IPv4-only
// dispatcher; everything else that goes through Node's standard net/dns
// (the `ws` package for Neon, `ioredis`, etc.) is fixed by the DNS result
// order alone.
export function forceIPv4Outbound() {
  setDefaultResultOrder("ipv4first");
  setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
}
