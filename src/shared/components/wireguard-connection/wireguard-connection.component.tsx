import { ToggleButton } from "@components/toggle-button/toggle-button";
import { WithOptional } from "@components/with-optional/with-optional";
import WireGuard from "@service/wireguard";
import { Gtk } from "ags/gtk4";
import { Accessor, createBinding, createComputed } from "gnim";
import styles from "./wireguard-connection.component.style";

interface Props {
	connection: WireGuard.Connection | Accessor<WireGuard.Connection>;
}

export function WireguardConnection({ connection }: Props) {
	return (
		<box>
			<WithOptional value={connection}>
				{(connection) => (
					<box>
						<ToggleButton
							cssClasses={[styles.button]}
							valign={Gtk.Align.CENTER}
							onClicked={() => {
								connection
									.setActive(!connection.nm_connection)
									.catch(console.error);
							}}
						>
							<image
								iconName={createComputed(
									[
										createBinding(connection, "is_loading"),
										createBinding(connection, "nm_connection"),
									],
									(isLoading, nmConnection) => {
										if (isLoading) {
											return "network-vpn-acquiring-symbolic";
										}
										if (nmConnection) {
											return "network-vpn-symbolic";
										}
										return "network-vpn-offline-symbolic";
									},
								)}
							/>
						</ToggleButton>
						<box orientation={Gtk.Orientation.VERTICAL} hexpand>
							<label
								hexpand
								halign={Gtk.Align.START}
								label={createComputed(
									[
										createBinding(connection, "name"),
										createBinding(connection, "alias"),
									],
									(name, alias) => alias || name,
								)}
								cssClasses={[styles.label]}
							/>
							<label
								hexpand
								halign={Gtk.Align.START}
								label={createComputed(
									[
										createBinding(connection, "ping"),
										createBinding(connection, "status"),
									],
									(ping, status) => {
										if (ping >= 0) {
											return `${status} - ${ping}ms`;
										}
										return status;
									},
								)}
								cssClasses={[styles.subLabel]}
							/>
						</box>
					</box>
				)}
			</WithOptional>
		</box>
	);
}
