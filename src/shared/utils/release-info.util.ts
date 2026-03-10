import { exec } from "ags/process";

export type ReleaseInfoParameter =
	| "DISTRIB_CODENAME"
	| "DISTRUB_ID"
	| "DISTRIB_RELEASE"
	| "LSB_VERSION"
	| "ANSI_COLOR"
	| "BUG_REPORT_URL"
	| "BUILD_ID"
	| "CPE_NAME"
	| "DEFAULT_HOSTNAME"
	| "DOCUMENTATION_URL"
	| "HOME_URL"
	| "ID"
	| "ID_LIKE"
	| "IMAGE_VERSION"
	| "LOGO"
	| "NAME"
	| "PRETTY_NAME"
	| "SUPPORT_URL"
	| "VARIANT"
	| "VARIANT_ID"
	| "VENDOR_NAME"
	| "VENDOR_URL"
	| "VERSION"
	| "VERSION_CODENAME"
	| "VERSION_ID";

const releaseInfo = new Map<string, string>();
let releaseInfoRetrieved = false;

export function getReleaseInfo(key: ReleaseInfoParameter) {
	if (!releaseInfoRetrieved) {
		const lines = exec(`sh -c "cat /etc/*-release"`).split("\n");

		for (let line of lines) {
			const key = line.substring(0, line.indexOf("="));
			let value = line.substring(key.length + 1);
			if (value.startsWith(`"`)) {
				value = value.substring(1);
			}
			if (value.endsWith(`"`)) {
				value = value.substring(0, value.length - 1);
			}
			releaseInfo.set(key, value);
		}
	}
	return releaseInfo.get(key) || "";
}
