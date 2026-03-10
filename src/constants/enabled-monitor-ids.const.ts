// @ts-nocheck
// ENABLED_MONITORS is injected by AGS

let ids: string[] | null = null;
if (typeof ENABLED_MONITORS == "string") {
	ids = (ENABLED_MONITORS as string).split(":");
}
export const ENABLED_MONITOR_IDS = ids as const;
