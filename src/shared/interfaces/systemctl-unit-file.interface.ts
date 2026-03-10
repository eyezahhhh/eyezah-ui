export type ISystemctlUnitFile = {
	unit_file: string;
	state:
		| "enabled"
		| "disabled"
		| "static"
		| "masked"
		| "generated"
		| "indirect"
		| "linked";
	preset: "enabled" | "disabled" | "masked" | "static" | "ignored" | "bad";
};
