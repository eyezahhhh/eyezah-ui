import { ClickableListEntry } from "@components/clickable-list-entry/clickable-list-entry";
import { WithOptional } from "@components/with-optional/with-optional";
import { createCursorPointer, getOptional, optionalAs } from "@util/ags";
import { Destroyer } from "@util/destroyer";
import { connectToWifi, getConnectingWifiAccessor } from "@util/network";
import { Gtk } from "ags/gtk4";
import AstalNetwork from "gi://AstalNetwork?version=0.1";
import NM from "gi://NM?version=1.0";
import {
	Accessor,
	createBinding,
	createComputed,
	createState,
	onCleanup,
	With,
} from "gnim";
import styles from "./access-point.component.style";
import { setMenu } from "main/menu/menu.manager";
import { NetworkMenuHandler } from "main/menu/handlers/network/network.menu-handler";
import { ToggleButton } from "@components/toggle-button/toggle-button";

interface Props {
	ap: AstalNetwork.AccessPoint | Accessor<AstalNetwork.AccessPoint>;
	onClicked?: (() => void) | Accessor<() => void>;
	isOpen?: boolean | Accessor<boolean>;
}

export function AccessPoint({ ap, onClicked, isOpen }: Props) {
	const network = AstalNetwork.get_default();

	const [showWifiPasswordEntry, setShowWifiPasswordEntry] = createState(false);

	const destroyer = new Destroyer();
	onCleanup(() => destroyer.destroy());

	if (isOpen instanceof Accessor) {
		destroyer.add(
			isOpen.subscribe(() => {
				setShowWifiPasswordEntry(false);
			}),
		);
	}

	const connectToAccessPoint = (password?: string) => {
		setShowWifiPasswordEntry(false);
		connectToWifi(
			getOptional(ap),
			password ||
				(() => {
					if (getOptional(isOpen)) {
						setShowWifiPasswordEntry(true);
					}
				}),
		).catch((e) => {
			console.error(e);
		});
	};

	return (
		<WithOptional value={ap}>
			{(ap) => (
				<box orientation={Gtk.Orientation.VERTICAL}>
					<ClickableListEntry
						cursor={createCursorPointer()}
						active={createBinding(network.wifi, "active_access_point").as(
							(activeAP) => activeAP == ap,
						)}
						label={createComputed(
							[createBinding(ap, "ssid"), createBinding(ap, "bssid")],
							(ssid, bssid) => ssid || bssid,
						)}
						subLabel={createComputed(
							[
								createBinding(network.wifi, "active_access_point"),
								getConnectingWifiAccessor(),
							],
							(activeAP, connectingAP) => {
								if (connectingAP == ap) {
									return "Connecting...";
								}
								if (activeAP == ap) {
									return "Connected";
								}
								return null;
							},
						)}
						endLabel={createBinding(ap, "frequency").as(
							(frequency) => `${Math.round(frequency / 100) / 10}Ghz`,
						)}
						iconName={createBinding(ap, "icon_name")}
						onClicked={() => getOptional(onClicked)?.()}
					/>

					<revealer revealChild={isOpen}>
						<With
							value={
								createComputed(
									[
										createBinding(network.wifi, "active_access_point"),
										showWifiPasswordEntry,
										createBinding(network.client, "connections"),
									],
									(activeAP, showPasswordEntry, remoteConnections) => ({
										isActive: activeAP == ap,
										showPasswordEntry,
										remoteConnection: remoteConnections.find(
											(connection) =>
												connection.get_connection_type() == "802-11-wireless" &&
												connection.get_id() == ap.ssid,
										),
									}),
								) as Accessor<{
									isActive: boolean;
									showPasswordEntry: boolean;
									remoteConnection: NM.RemoteConnection | null;
								}>
							}
						>
							{({ isActive, showPasswordEntry, remoteConnection }) => (
								<box cssClasses={[styles.revealerInner]}>
									{showPasswordEntry ? (
										<box>
											<entry
												placeholderText="WiFi Password"
												hexpand
												visibility={false}
												onMap={(self) => self.grab_focus()}
												onActivate={(self) => connectToAccessPoint(self.text)}
											/>
										</box>
									) : (
										<box cssClasses={[styles.revealer]}>
											<button
												cursor={createCursorPointer()}
												hexpand
												onClicked={() => {
													if (isActive) {
														network.wifi?.device.disconnect_async(
															null,
															(device, result) => {
																device?.disconnect_finish(result);
															},
														);
													} else {
														connectToAccessPoint();
													}
												}}
											>
												<box hexpand>
													<label
														hexpand
														label={isActive ? "Disconnect" : "Connect"}
													/>
												</box>
											</button>
											{remoteConnection && (
												<>
													<ToggleButton
														onClicked={() =>
															setMenu(NetworkMenuHandler, `qrcode_${ap.ssid}`)
														}
														cssClasses={[styles.extraButton]}
													>
														<image iconName="emblem-shared-symbolic" />
													</ToggleButton>
													<ToggleButton
														onClicked={() => {
															remoteConnection.delete_async(
																null,
																(_connection, result) => {
																	try {
																		remoteConnection.delete_finish(result);
																	} catch (e) {
																		console.error(e);
																	}
																},
															);
														}}
														cssClasses={[styles.extraButton]}
													>
														<image iconName="edit-delete-symbolic" />
													</ToggleButton>
												</>
											)}
										</box>
									)}
								</box>
							)}
						</With>
					</revealer>
				</box>
			)}
		</WithOptional>
	);
}
