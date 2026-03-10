import GObject from "gnim/gobject";
import { MenuHandler } from "../menu-handler";
import AstalNetwork from "gi://AstalNetwork?version=0.1";
import styles from "./network.menu-handler.style";
import { Gtk } from "ags/gtk4";
import {
	Accessor,
	createBinding,
	createComputed,
	createState,
	For,
	onCleanup,
	With,
} from "gnim";
import { getRescanningWifiAccessor, rescanWifi } from "@util/network";
import { createCommandProcess, doesCommandExist } from "@util/cli";
import NM from "gi://NM?version=1.0";
import GLib from "gi://GLib?version=2.0";
import { CACHE_DIRECTORY } from "constants/cache-directory.const";
import { setMenu } from "main/menu/menu.manager";
import { makeDirectoryRecursive } from "@util/file";
import Gio from "gi://Gio?version=2.0";
import Thumbnail from "@components/thumbnail/thumbnail";
import { AccessPoint } from "@components/access-point/access-point";
import { ToggleButton } from "@components/toggle-button/toggle-button";
import WireGuard from "@service/wireguard";
import { WireguardConnection } from "@components/wireguard-connection/wireguard-connection";
import { Expandable } from "@components/expandable/expandable";
import { Destroyer } from "@util/destroyer";

export class NetworkMenuHandler extends MenuHandler {
	private qrCodeSupported = false;

	constructor() {
		super("network");

		doesCommandExist("qrencode").then((supported) => {
			this.qrCodeSupported = supported;
			if (supported) {
				console.log(`WiFi QR-code generation is enabled.`);
			} else {
				console.log(
					`WiFi QR-code generation is not enabled. Install qrencode.`,
				);
			}
		});
	}

	private getWifiPassword(connection: NM.RemoteConnection) {
		// enterprise (wpa-eap) not supported
		return new Promise<string>((resolve, reject) => {
			connection.get_secrets_async(
				"802-11-wireless-security",
				null,
				(_connection, result) => {
					try {
						const variant = connection.get_secrets_finish(result);
						const data = variant.deepUnpack() as any;
						const psk = data["802-11-wireless-security"]["psk"] as
							| GLib.Variant
							| undefined;
						if (!psk) {
							throw new Error("WiFi doesn't have PSK secret");
						}

						const password = psk.get_string()[0];
						resolve(password);
					} catch (e) {
						reject(e);
					}
				},
			);
		});
	}

	private async generateWifiQrCode(connection: NM.RemoteConnection) {
		if (!this.qrCodeSupported) {
			throw new Error("QR-code generation isn't enabled");
		}
		if (connection.get_connection_type() != "802-11-wireless") {
			throw new Error("Connection isn't WiFi network");
		}

		const escapeString = (string: string) => {
			return string.replace(/([\\;,:])/g, "\\$1");
		};

		const wireless = connection.get_setting_wireless();
		const ssidBytes = wireless.get_ssid().get_data()!;
		const ssid = [...ssidBytes]
			.map((char) => String.fromCharCode(char))
			.join("");
		const ssidHex = ssid
			.split("")
			.map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
			.join("");

		const wirelessSecurity = connection.get_setting_wireless_security();

		const securityType =
			{
				none: "nopass",
				"wpa-psk": "WPA",
				"wpa-eap": "WPA2-EAP",
			}[wirelessSecurity.get_key_mgmt()] || "unknown";

		let password: string | null = null;

		if (securityType != "nopass") {
			try {
				password = await this.getWifiPassword(connection);
			} catch (e) {
				if (e instanceof Error && e.message == "WiFi doesn't have PSK secret") {
					password = null;
				} else {
					throw e;
				}
			}
		}

		const hidden = wireless.get_hidden();

		let code = `WIFI:T:${securityType};S:${escapeString(ssid)};`;
		if (password) {
			code += `P:${escapeString(password)};`;
		}

		if (hidden) {
			code += "H:true;";
		}

		code += ";";

		const directory = `${CACHE_DIRECTORY}/wifi-qr`;
		await makeDirectoryRecursive(Gio.File.new_for_path(directory));
		const file = `${directory}/${ssidHex}.svg`;
		await createCommandProcess([
			"qrencode",
			"-o",
			file,
			code,
			"--background",
			"00000000",
			"--margin",
			"0",
			"--size",
			"20",
			"-t",
			"SVG",
		]);

		return {
			file,
			wireless,
			ssid,
			password,
		};
	}

	public getContent(
		_window: GObject.Object,
		data: string | number | null,
	): GObject.Object {
		const network = AstalNetwork.get_default();
		if (typeof data == "string" && data.startsWith("qrcode_")) {
			const ssid = data.substring("qrcode_".length);
			const connection = network.client
				.get_connections()
				.find(
					(connection) =>
						connection.get_connection_type() == "802-11-wireless" &&
						connection.get_id() == ssid,
				);
			if (connection) {
				const [info, setInfo] = createState<null | {
					password?: string;
					file?: string;
				}>(null);

				this.generateWifiQrCode(connection)
					.then((info) => {
						setInfo({
							file: info.file,
							password: info.password || undefined,
						});
					})
					.catch(async (error) => {
						console.error(error);
						try {
							const password = await this.getWifiPassword(connection);
							setInfo({
								password,
							});
						} catch (e) {
							console.error(e);
							setMenu(null);
						}
					});

				return (
					<box widthRequest={250}>
						<With value={info}>
							{(info) =>
								info?.password ? (
									<box
										orientation={Gtk.Orientation.VERTICAL}
										cssClasses={[styles.passwordRevealContainer]}
									>
										{info?.file && (
											<box widthRequest={250} heightRequest={250}>
												<Thumbnail
													path={info.file}
													contentFit={Gtk.ContentFit.CONTAIN}
												/>
											</box>
										)}
										<box
											halign={Gtk.Align.CENTER}
											cssClasses={[styles.passwordTextContainer]}
										>
											<image
												iconName="lock-symbolic"
												cssClasses={[styles.passwordLockIcon]}
											/>
											<label label={info.password} />
										</box>
									</box>
								) : (
									<box>
										<label label="Loading WiFi details..." />
									</box>
								)
							}
						</With>
					</box>
				);
			}
		}

		const destroyer = new Destroyer();
		onCleanup(() => destroyer.destroy());

		const wireguard = WireGuard.get_default();
		const [openWifiNetwork, setOpenWifiNetwork] = createState<string | null>(
			null,
		);

		const [activeWg, setActiveWg] = createState<WireGuard.Connection[]>([]);
		const [inactiveWg, setInactiveWg] = createState<WireGuard.Connection[]>([]);
		let activeWgDestroyer: Destroyer | null = null;
		destroyer.add(() => activeWgDestroyer?.destroy());

		const updateActiveWg = () => {
			activeWgDestroyer?.destroy();

			const scan = () => {
				const newActiveList = wireguard.connections.filter(
					(connection) => connection.status != WireGuard.Status.DISABLED,
				);
				const newInactiveList = wireguard.connections.filter(
					(connection) => connection.status == WireGuard.Status.DISABLED,
				);
				const currentActiveList = activeWg.get();
				const currentInactiveList = inactiveWg.get();
				let updateActive = newActiveList.length != currentActiveList.length;
				if (!updateActive) {
					for (let entry of newActiveList) {
						if (!currentActiveList.includes(entry)) {
							updateActive = true;
							break;
						}
					}
					if (!updateActive) {
						for (let entry of currentActiveList) {
							if (!newActiveList.includes(entry)) {
								updateActive = true;
								break;
							}
						}
					}
				}
				let updateInactiveWg =
					newInactiveList.length != currentInactiveList.length;
				if (!updateInactiveWg) {
					for (let entry of newInactiveList) {
						if (!currentInactiveList.includes(entry)) {
							updateInactiveWg = true;
							break;
						}
					}
					if (!updateInactiveWg) {
						for (let entry of currentInactiveList) {
							if (!newInactiveList.includes(entry)) {
								updateInactiveWg = true;
								break;
							}
						}
					}
				}

				if (updateActive) {
					setActiveWg(newActiveList);
				}
				if (updateInactiveWg) {
					setInactiveWg(newInactiveList);
				}
			};

			const destroyer = new Destroyer();
			activeWgDestroyer = destroyer;

			for (const connection of wireguard.connections) {
				destroyer.addDisconnect(
					connection,
					connection.connect("notify::status", scan),
				);
			}

			scan();
		};

		destroyer.addDisconnect(
			wireguard,
			wireguard.connect("notify::connections", () => updateActiveWg()),
		);
		updateActiveWg();

		return (
			<box orientation={Gtk.Orientation.VERTICAL} widthRequest={250}>
				<box>
					<With
						value={
							createBinding(wireguard, "connections").as(
								(connections) => !!connections.length,
							) as Accessor<boolean>
						}
					>
						{(show) =>
							show && (
								<box
									cssClasses={[styles.wireguardSection]}
									orientation={Gtk.Orientation.VERTICAL}
								>
									<box>
										<With value={activeWg}>
											{(list) =>
												list.length ? (
													<box orientation={Gtk.Orientation.VERTICAL}>
														{list.map((connection) => (
															<box cssClasses={[styles.wireguardConnection]}>
																<WireguardConnection connection={connection} />
															</box>
														))}
													</box>
												) : (
													<box>
														<label
															label="No active WG connections"
															justify={Gtk.Justification.CENTER}
															hexpand
															cssClasses={[styles.noneActive]}
														/>
													</box>
												)
											}
										</With>
									</box>
									<box>
										<With
											value={inactiveWg.as((inactiveWg) => !inactiveWg.length)}
										>
											{(hide) =>
												hide ? (
													<box />
												) : (
													<Expandable>
														<For each={inactiveWg}>
															{(connection) => (
																<box cssClasses={[styles.wireguardConnection]}>
																	<WireguardConnection
																		connection={connection}
																	/>
																</box>
															)}
														</For>
													</Expandable>
												)
											}
										</With>
									</box>
								</box>
							)
						}
					</With>
				</box>

				<box>
					<With
						value={
							createBinding(
								network,
								"wifi",
							) as Accessor<AstalNetwork.Wifi | null>
						}
					>
						{(wifi) =>
							wifi ? (
								<box orientation={Gtk.Orientation.VERTICAL}>
									<box cssClasses={[styles.wifiSectionButtons]}>
										<ToggleButton
											disabled={createBinding(wifi, "enabled").as(
												(enabled) => !enabled,
											)}
											onClicked={() =>
												network.wifi.set_enabled(!network.wifi.enabled)
											}
											cssClasses={[styles.wifiSectionButton]}
										>
											<image iconName="network-wireless-symbolic" />
										</ToggleButton>
										<ToggleButton
											disabled={createComputed(
												[
													getRescanningWifiAccessor(),
													createBinding(wifi, "enabled"),
												],
												(rescanning, enabled) => rescanning || !enabled,
											)}
											onClicked={() => rescanWifi().catch(() => {})}
											cssClasses={[styles.wifiSectionButton]}
										>
											<image iconName="view-refresh-symbolic" />
										</ToggleButton>
									</box>
									<With
										value={
											createBinding(wifi, "access_points").as((accessPoints) =>
												accessPoints.sort((a, b) => b.strength - a.strength),
											) as Accessor<AstalNetwork.AccessPoint[]>
										}
									>
										{(accessPoints) =>
											!!accessPoints.length && (
												<box
													orientation={Gtk.Orientation.VERTICAL}
													cssClasses={[styles.accessPoints]}
												>
													{accessPoints.map((accessPoint) => (
														<AccessPoint
															ap={accessPoint}
															onClicked={openWifiNetwork.as(
																(openAP) => () =>
																	setOpenWifiNetwork(
																		openAP == accessPoint.bssid
																			? null
																			: accessPoint.bssid,
																	),
															)}
															isOpen={openWifiNetwork.as(
																(openAP) => openAP == accessPoint.bssid,
															)}
														/>
													))}
												</box>
											)
										}
									</With>
								</box>
							) : (
								<box>
									<label label="WiFi is not enabled" />
								</box>
							)
						}
					</With>
				</box>
			</box>
		);
	}
}
