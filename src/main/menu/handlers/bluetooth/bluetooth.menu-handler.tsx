import GObject from "gnim/gobject";
import { MenuHandler } from "../menu-handler";
import styles from "./bluetooth.menu-handler.style";
import AstalBluetooth from "gi://AstalBluetooth?version=0.1";
import { Gtk } from "ags/gtk4";
import { Accessor, createBinding, createState, For, With } from "gnim";
import { ToggleButton } from "@components/toggle-button/toggle-button";
import { BluetoothDevice } from "@components/bluetooth-device/bluetooth-device";
import { doesCommandExist } from "@util/cli";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import { setMenu } from "main/menu/menu.manager";

export class BluetoothMenuHandler extends MenuHandler {
	private isBluemanInstalled: Accessor<boolean>;

	constructor() {
		super("bluetooth");

		const [isBluemanInstalled, setIsBluemanInstalled] = createState(false);
		this.isBluemanInstalled = isBluemanInstalled;

		doesCommandExist("blueman-manager", "--help").then((exists) => {
			setIsBluemanInstalled(exists);
		});
	}

	public getContent(
		window: GObject.Object,
		data: string | number | null,
	): GObject.Object {
		const bt = AstalBluetooth.get_default();

		const [openDevice, setOpenDevice] =
			createState<AstalBluetooth.Device | null>(null);

		return (
			<box orientation={Gtk.Orientation.VERTICAL} widthRequest={250}>
				<box cssClasses={[styles.buttons]}>
					<ToggleButton
						cssClasses={[styles.button]}
						onClicked={() => {
							const adapter = bt.get_adapter();
							if (adapter) {
								adapter.set_powered(!adapter.powered);
							}
						}}
					>
						<With
							value={
								createBinding(bt, "adapter") as Accessor<AstalBluetooth.Adapter>
							}
						>
							{(adapter) => (
								<image
									iconName={createBinding(adapter, "powered").as((powered) =>
										powered
											? "bluetooth-active-symbolic"
											: "bluetooth-disabled-symbolic",
									)}
								/>
							)}
						</With>
					</ToggleButton>
					<box>
						<With value={this.isBluemanInstalled}>
							{(installed) =>
								installed && (
									<ToggleButton
										cssClasses={[styles.button]}
										onClicked={() => {
											AstalHyprland.get_default().message(
												`dispatch exec blueman-manager`,
											);
											setMenu(null);
										}}
									>
										<image iconName="org.gnome.Settings-symbolic" />
									</ToggleButton>
								)
							}
						</With>
					</box>
				</box>
				<box orientation={Gtk.Orientation.VERTICAL}>
					<For
						each={
							createBinding(bt, "devices") as Accessor<AstalBluetooth.Device[]>
						}
					>
						{(value) => (
							<BluetoothDevice
								device={value}
								isOpen={openDevice.as((openDevice) => openDevice == value)}
								onClicked={() =>
									setOpenDevice((openDevice) => {
										if (openDevice == value) {
											return null;
										}
										return value;
									})
								}
							/>
						)}
					</For>
				</box>
			</box>
		);

		// throw new Error("Method not implemented.");
	}
}
