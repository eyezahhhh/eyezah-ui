import { CommandTerminationError } from "@interface/command-termination-error";
import { ISystemctlUnitFile } from "@interface/systemctl-unit-file";
import { IVpnPingAddress } from "@interface/vpn-ping-address";
import { IWireguardSystemctlUnitFile } from "@interface/wireguard-systemctl-unit-file";
import { Destroyer } from "@util/destroyer";
import { ping } from "@util/network";
import { compareString } from "@util/string";
import { readFileAsync } from "ags/file";
import { execAsync } from "ags/process";
import { timeout } from "ags/time";
import AstalNetwork from "gi://AstalNetwork?version=0.1";
import Gio from "gi://Gio?version=2.0";
import NM from "gi://NM?version=1.0";
import GObject, { getter, register, setter } from "gnim/gobject";

const PING_ADDRESS_FILE = "/etc/wireguard-ping-address";

namespace WireGuard {
	export enum Status {
		UNKNOWN = "Unknown",
		DISABLED = "Disabled",
		CONNECTING = "Connecting",
		MISSING_IP = "Missing IP address",
		CONNECTED = "Connected",
		DISCONNECTED = "Disconnected",
	}

	@register()
	export class Connection extends GObject.Object {
		private readonly network = AstalNetwork.get_default();
		private readonly destroyer = new Destroyer();

		private _unitFile: IWireguardSystemctlUnitFile;
		private readonly _name: string;
		private _nmConnection: NM.ActiveConnection | null = null;
		private _pingAddress: string | null;
		// private _isLoading = false
		private _ping = -1;
		private _status = Status.UNKNOWN;
		private _testCancellable: Gio.Cancellable | null = null;
		private _isLoading = false;
		private _alias: string | null;

		constructor(
			unitFile: IWireguardSystemctlUnitFile,
			options: {
				pingAddress: string | null;
				alias: string | null;
			},
		) {
			super();
			this._unitFile = unitFile;
			this._name = unitFile.interface;
			this._pingAddress = options.pingAddress;
			this._alias = options.alias;

			this.destroyer.addDisconnect(
				this.network.client,
				this.network.client.connect("active-connection-added", () =>
					this._updateConnection(),
				),
			);

			this.destroyer.addDisconnect(
				this.network.client,
				this.network.client.connect("active-connection-removed", () =>
					this._updateConnection(),
				),
			);

			let disconnectWifi: (() => void) | null = null;
			const checkWifi = () => {
				if (disconnectWifi) {
					this.destroyer.remove(disconnectWifi);
					disconnectWifi();
				}
				const wifi = this.network.get_wifi();
				if (wifi) {
					const id = wifi.connect("state-changed", () =>
						this._updateConnection(),
					);
					disconnectWifi = () => wifi.disconnect(id);
					this.destroyer.add(disconnectWifi);
				} else {
					disconnectWifi = null;
				}
			};

			this.network.connect("notify::wifi", () => checkWifi());
			checkWifi();
			this._updateConnection();
		}

		@getter(Object)
		get unit_file() {
			return this._unitFile;
		}

		set unit_file(unitFile: IWireguardSystemctlUnitFile) {
			if (this._unitFile == unitFile) {
				return;
			}
			if (unitFile.interface != this.name) {
				throw new Error("Unit file is not for this WireGuard connection");
			}
			this._unitFile = unitFile;
			this.notify("unit_file");
		}

		@getter(String)
		get name() {
			return this._name;
		}

		@getter<String | null>(String)
		get ping_address() {
			return this._pingAddress;
		}

		set ping_address(address: string | null) {
			if (this._pingAddress == address) {
				return;
			}
			this._pingAddress = address;
			this.notify("ping_address");
			this.checkConnection();
		}

		@getter(Number)
		get ping() {
			return this._ping;
		}

		private set ping(ping: number) {
			if (
				ping != this._ping &&
				this.status != Status.DISABLED &&
				!this.is_loading
			) {
				this._ping = ping;
				this.notify("ping");
			}
		}

		@getter<Object | null>(Object)
		get nm_connection() {
			return this._nmConnection;
		}

		private set nm_connection(connection: NM.ActiveConnection | null) {
			if (connection != this._nmConnection) {
				this._nmConnection = connection;
				this.notify("nm_connection");
			}
		}

		@getter(String)
		get status() {
			return this._status;
		}

		private set status(status: Status) {
			if (status != this._status) {
				this._status = status;
				this.notify("status");
			}
		}

		@getter(Boolean)
		get is_loading() {
			return this._isLoading;
		}

		private set is_loading(isLoading: boolean) {
			if (this.is_loading != isLoading) {
				this._isLoading = isLoading;
				this.notify("is_loading");
			}
		}

		@getter<string | null>(String)
		get alias() {
			return this._alias;
		}

		@setter<string | null>(String)
		set alias(alias: string | null) {
			if (alias != this._alias) {
				this._alias = alias;
				this.notify("alias");
			}
		}

		public destroy() {
			this.destroyer.destroy();
		}

		private _updateConnection() {
			const activeConnections = this.network.client.get_active_connections();
			this.nm_connection =
				activeConnections.find((conn) => conn.get_id() == this.name) || null;

			if (this.nm_connection) {
				this.checkConnection();
			} else {
				this.status = Status.DISABLED;
				this.ping = -1;
			}
		}

		public checkConnection() {
			this._testCancellable?.cancel();
			const cancellable = new Gio.Cancellable();
			this._testCancellable = cancellable;

			const connection = this.nm_connection;
			const pingAddress = this.ping_address;

			if (!connection) {
				this.status = Status.DISABLED;
				return;
			}

			if (!pingAddress) {
				this.status = Status.UNKNOWN;
				return;
			}

			if ([Status.UNKNOWN, Status.DISABLED].includes(this.status)) {
				this.status = Status.CONNECTING;
			}

			// timeout for ipv4 config to load
			const timer = timeout(100, () => {
				const ipv4Config = connection.get_ip4_config();
				if (!ipv4Config) {
					console.log(
						`No IPv4 config for VPN ${this.name}! Can't check status`,
					);
					this.status = Status.MISSING_IP;
					return;
				}

				if (![Status.CONNECTED, Status.DISCONNECTED].includes(this.status)) {
					this.status = Status.CONNECTING;
				}

				// console.log(`Wireguard pinging ${pingAddress}...`);
				const pinger = ping(pingAddress, {
					timeout: 10_000,
					attempts: 3,
					interface: this.name,
				});
				cancellable.connect(() => pinger.kill());

				pinger
					.then((ping) => {
						if (cancellable.is_cancelled()) {
							return;
						}
						this.ping = ping;
						this.status = Status.CONNECTED;
						const timer = timeout(10_000, () => this.checkConnection());
						cancellable.connect(() => timer.cancel());
					})
					.catch((error) => {
						if (
							cancellable.is_cancelled() ||
							error instanceof CommandTerminationError
						) {
							return;
						}
						this.ping = -1;
						this.status = Status.DISCONNECTED;
						const timer = timeout(10_000, () => this.checkConnection());
						cancellable.connect(() => timer.cancel());
					});
			});

			cancellable.connect(() => timer.cancel());
		}

		public async setActive(active: boolean) {
			if (this.is_loading) {
				return;
			}
			this.is_loading = true;

			const COMMAND = `sudo /etc/manage-wg.sh ${active ? "start" : "stop"} ${
				this.name
			}`;
			try {
				await execAsync(COMMAND);
			} catch (e) {
				throw e;
			} finally {
				this.is_loading = false;
			}
		}
	}

	@register()
	export class WireGuardService extends GObject.Object {
		private readonly network = AstalNetwork.get_default();
		private _connections: Connection[] = [];

		constructor() {
			super();

			this.network.connect("notify::connections", () => {
				this.reloadInterfaces().catch(console.error);
			});
			this.reloadInterfaces().catch(console.error);
		}

		public async reloadInterfaces(
			options: {
				skipSystemd?: boolean;
			} = {},
		) {
			const wireguardUnits: IWireguardSystemctlUnitFile[] = [];

			const promises: Promise<void>[] = [];
			if (options.skipSystemd) {
				wireguardUnits.push(
					...this._connections.map((connection) => connection.unit_file),
				);
			} else {
				promises.push(
					execAsync(
						"systemctl list-unit-files --type=service --all --no-pager --output=json",
					).then((result) => {
						const units = JSON.parse(result) as ISystemctlUnitFile[];
						wireguardUnits.push(
							...units
								.filter(
									(unit) =>
										unit.unit_file.startsWith("wg-quick-") ||
										unit.unit_file.startsWith("wg-quick@"),
								)
								.map((unit) => ({
									...unit,
									interface: unit.unit_file.substring(
										9,
										unit.unit_file.length - 8,
									),
								})),
						);
					}),
				);
			}

			const pingAddresses: IVpnPingAddress[] = [];

			if (true) {
				// todo make this optional
				promises.push(
					readFileAsync(PING_ADDRESS_FILE)
						.then((result) => {
							const lines = result
								.split("\n")
								.map((line) => {
									const parts = line.split(" ");
									const name = parts.shift();
									const pingAddress = parts.shift();
									const alias = parts.join(" ");

									if (name && pingAddress) {
										return {
											name,
											pingAddress,
											alias,
										};
									}
									return null;
								})
								.filter((entry) => !!entry);
							pingAddresses.push(...lines);
						})
						.catch((e) => {
							console.error(
								`Failed to parse wireguard ping address file (${PING_ADDRESS_FILE}):`,
								e,
							);
						}),
				);
			}

			await Promise.all(promises);

			const connections = Array.from(this._connections); // clone array
			let changed = false;

			for (let i = connections.length - 1; i >= 0; i--) {
				const connection = connections[i];
				if (
					!wireguardUnits.some((unit) =>
						this._matchesUnitFile(connection, unit),
					)
				) {
					connections.splice(i, 1);
					changed = true;
				}
			}

			for (let unit of wireguardUnits) {
				const existingConnection = connections.find((connection) =>
					this._matchesUnitFile(connection, unit),
				);
				const pingAddress = pingAddresses.find(
					(address) => address.name == unit.interface,
				);
				if (existingConnection) {
					existingConnection.unit_file = unit;
					existingConnection.ping_address = pingAddress?.pingAddress || null;
					existingConnection.alias = pingAddress?.alias || null;
				} else {
					const connection = new Connection(unit, {
						pingAddress: pingAddress?.pingAddress || null,
						alias: pingAddress?.alias || null,
					});
					connections.push(connection);
					changed = true;
				}
			}

			if (changed) {
				connections.sort((a, b) => compareString(a.name, b.name));

				this._connections = connections;
				this.notify("connections");
			}
		}

		private _matchesUnitFile(
			connection: Connection,
			unitFile: IWireguardSystemctlUnitFile,
		) {
			return connection.name === unitFile.interface;
		}

		@getter(Object)
		get connections() {
			return Array.from(this._connections);
		}
	}

	let instance: WireGuardService | null = null;
	export function get_default() {
		if (!instance) {
			instance = new WireGuardService();
		}
		return instance;
	}
}

export default WireGuard;
