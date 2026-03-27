import { ClickableListEntry } from "@components/clickable-list-entry/clickable-list-entry";
import { createCursorPointer, getOptional } from "@util/ags";
import { Gtk } from "ags/gtk4";
import AstalBluetooth from "gi://AstalBluetooth?version=0.1";
import { Accessor, createBinding, createComputed, createState } from "gnim";

interface Props {
	device: AstalBluetooth.Device;
	isOpen?: boolean | Accessor<boolean>;
	onClicked?: (() => void) | Accessor<() => void>;
}

export function BluetoothDevice({ device, isOpen, onClicked }: Props) {
	const isConnected = createBinding(device, "connected");
	const isConnecting = createBinding(device, "connecting");
	const isPaired = createBinding(device, "paired");
	const [isDisconnecting, setIsDisconnecting] = createState(false);

	return (
		<box orientation={Gtk.Orientation.VERTICAL}>
			<ClickableListEntry
				label={createBinding(device, "alias")}
				cursor={createCursorPointer()}
				subLabel={createComputed(() => {
					if (isDisconnecting()) {
						return "Disconnecting...";
					}
					if (isConnected()) {
						return "Connected";
					}
					if (isConnecting()) {
						return "Connecting...";
					}
					if (isPaired()) {
						return "Paired";
					}

					return null;
				})}
				iconName={createBinding(device, "icon")}
				endLabel={createBinding(device, "battery_percentage").as((percent) => {
					if (percent == -1) {
						return null;
					}
					return `${percent * 100}%`;
				})}
				onClicked={getOptional(onClicked)}
			/>
			<revealer revealChild={isOpen}>
				<box>
					<button
						hexpand
						cursor={createCursorPointer()}
						onClicked={() => {
							if (isDisconnecting()) {
								return;
							}
							if (isConnected() || isConnecting()) {
								setIsDisconnecting(true);
								device.disconnect_device((_device, result) => {
									try {
										device.disconnect_device_finish(result);
									} catch (e) {
										console.error(`Failed to disconnect Bluetooth device:`, e);
									} finally {
										setIsDisconnecting(false);
									}
								});
							} else {
								device.connect_device((_device, result) => {
									try {
										device.connect_device_finish(result);
									} catch (e) {
										console.error(`Failed to connect to Bluetooth device:`, e);
									}
								});
							}
						}}
					>
						<label
							label={createComputed(() => {
								if (isConnected() || isConnecting()) {
									return "Disconnect";
								}
								return "Connect";
							})}
						/>
					</button>
				</box>
			</revealer>
		</box>
	);
}
