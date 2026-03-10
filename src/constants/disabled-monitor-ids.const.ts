// @ts-nocheck
// DISABLED_MONITORS is injected by AGS

let ids: string[] | null = null;
if (typeof DISABLED_MONITORS == "string") {
	ids = (DISABLED_MONITORS as string).split(":");
}
export const DISABLED_MONITOR_IDS = ids as const;
