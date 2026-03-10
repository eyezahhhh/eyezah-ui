import { ISystemctlUnitFile } from "./systemctl-unit-file.interface";

export type IWireguardSystemctlUnitFile = ISystemctlUnitFile & {
	interface: string;
};
