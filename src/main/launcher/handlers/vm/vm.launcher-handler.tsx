import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import LibvirtGLib from "gi://LibvirtGLib?version=1.0";
import LibvirtGObject from "gi://LibvirtGObject";
import AstalHyprland from "gi://AstalHyprland";
import { onCleanup } from "gnim";
import { Destroyer } from "@util/destroyer";
import styles from "./vm.launcher-handler.style";
import { QEMU_CONNECTION } from "@const/qemu-connection";
import { doesCommandExist } from "@util/cli";

const PREFIX = "vm";

export class VMLauncherHandler extends LauncherHandler {
	private connection: LibvirtGObject.Connection | null = null;
	private hasPrefix = false;
	private query = "";
	private hasLookingGlass = false;

	constructor(setQuery: (query: string) => void) {
		super("Virtual Machines", setQuery, false);

		const enabled = LibvirtGLib.init_check(null);
		if (enabled) {
			const connection = new LibvirtGObject.Connection({
				uri: QEMU_CONNECTION,
			});
			this.connection = connection;

			connection.open_async(null, (_, res) => {
				try {
					const enabled = connection.open_finish(res);
					this.setEnabled(enabled);
					if (enabled) {
						this.updateDomains();

						doesCommandExist("looking-glass-client", "--help").then(
							(enabled) => {
								if (enabled) {
									this.hasLookingGlass = enabled;
									this.triggerUpdate(null);
								}
							},
						);
					}
				} catch {}
			});
		}
	}

	private updateDomains() {
		return new Promise<void>((resolve) => {
			if (!this.connection) {
				return resolve();
			}

			const connection = this.connection;

			connection.fetch_domains_async(null, (_, res) => {
				connection.fetch_domains_finish(res);
				resolve();
			});
		});
	}

	private formatDomainName(name: string) {
		return name.split("-").join(" ");
	}

	private getDomainStateName(state: LibvirtGObject.DomainState) {
		switch (state) {
			case LibvirtGObject.DomainState.BLOCKED:
				return "Blocked";
			case LibvirtGObject.DomainState.CRASHED:
				return "Crashed";
			case LibvirtGObject.DomainState.NONE:
				return "None";
			case LibvirtGObject.DomainState.PAUSED:
				return "Paused";
			case LibvirtGObject.DomainState.PMSUSPENDED:
				return "Suspended";
			case LibvirtGObject.DomainState.RUNNING:
				return "Running";
			case LibvirtGObject.DomainState.SHUTDOWN:
				return "Shutting Down";
			case LibvirtGObject.DomainState.SHUTOFF:
				return "Off";
		}
	}

	public update(query: string): void {
		this.query = query;
		this.hasPrefix =
			query.toLowerCase() == PREFIX ||
			query.toLowerCase().startsWith(`${PREFIX} `);
		this.triggerUpdate(query);
	}

	public getContent(
		entryId: string,
		window: Astal.Window,
	): GObject.Object | null {
		if (!this.connection) {
			return null;
		}

		if (entryId == "all") {
			const domains = this.connection.get_domains();

			return (
				<box orientation={Gtk.Orientation.VERTICAL}>
					{domains
						.filter((domain) => !domain.get_name().endsWith("-template"))
						.map((domain) => (
							<button
								onClicked={() =>
									this.setQuery(
										`vm ${this.formatDomainName(domain.get_name())}`,
									)
								}
								hexpand
								cssClasses={[styles.entry]}
							>
								<label
									halign={Gtk.Align.START}
									label={this.formatDomainName(domain.get_name())}
								/>
							</button>
						))}
				</box>
			);
		}

		const domain = this.connection.get_domain(entryId);
		if (!domain) {
			return <label>No domain found</label>;
		}

		const signals = [
			"pmsuspended",
			"resumed",
			"started",
			"stopped",
			"suspended",
			"updated",
		];

		const destroyer = new Destroyer();
		signals.forEach((signal) => {
			destroyer.addDisconnect(
				domain,
				domain.connect(signal, () => this.triggerUpdate(null)),
			);
		});
		onCleanup(() => {
			destroyer.destroy();
		});

		const info = domain.get_info();

		const name = this.formatDomainName(domain.get_name());

		const start = () => (
			<button
				onClicked={async () => {
					// const notifId = await sendNotification("Starting virtual machine", {
					// 	...this.getNotificationTemplate(),
					// 	body: `VM ${name} is starting...`,
					// });
					domain.start_async(0, null, (_, res) => {
						const success = domain.start_finish(res);
						if (success) {
							// sendNotification("Started virtual machine", {
							// 	...this.getNotificationTemplate(),
							// 	body: `VM ${name} started successfully.`,
							// 	replaceId: notifId,
							// });
						}
					});
				}}
			>
				<image
					iconName="media-playback-start-symbolic"
					iconSize={Gtk.IconSize.LARGE}
				/>
			</button>
		);

		const shutdown = () => (
			<button
				onClicked={async () => {
					// await sendNotification("Shutting down virtual machine", {
					// 	...this.getNotificationTemplate(),
					// 	body: `VM ${name} is shutting down...`,
					// });
					domain.shutdown(0);
				}}
			>
				<image
					iconName="media-playback-stop-symbolic"
					iconSize={Gtk.IconSize.LARGE}
				/>
			</button>
		);

		const restart = () => (
			<button
				onClicked={async () => {
					domain.reboot(0);
					// await sendNotification("Restarting virtual machine", {
					// 	...this.getNotificationTemplate(),
					// 	body: `VM ${name} is restarting...`,
					// });
				}}
			>
				<image
					iconName="system-restart-symbolic"
					iconSize={Gtk.IconSize.LARGE}
				/>
			</button>
		);

		const suspend = () => (
			<button
				onClicked={async () => {
					domain.suspend();
					// await sendNotification("Suspended virtual machine", {
					// 	...this.getNotificationTemplate(),
					// 	body: `VM ${name} has been suspended.`,
					// });
				}}
			>
				<image
					iconName="system-suspend-symbolic"
					iconSize={Gtk.IconSize.LARGE}
				/>
			</button>
		);

		const resume = () => (
			<button
				onClicked={async () => {
					// const notifId = await sendNotification("Resuming virtual machine", {
					// 	...this.getNotificationTemplate(),
					// 	body: `VM ${name} is resuming...`,
					// });
					domain.resume_async(null, async (_, res) => {
						const success = domain.resume_finish(res);
						if (success) {
							// await sendNotification("Resumed virtual machine", {
							// 	...this.getNotificationTemplate(),
							// 	body: `VM ${name} has been resumed.`,
							// 	replaceId: notifId,
							// });
						}
					});
				}}
			>
				<image
					iconName="media-playback-start-symbolic"
					iconSize={Gtk.IconSize.LARGE}
				/>
			</button>
		);

		const lookingGlass = () => {
			if (!this.hasLookingGlass) {
				return null;
			}

			return (
				<button
					onClicked={() => {
						const hyprland = AstalHyprland.get_default();
						hyprland.message("dispatch exec looking-glass-client");
						window.visible = false;
					}}
				>
					<image iconName="computer-symbolic" iconSize={Gtk.IconSize.LARGE} />
				</button>
			);
		};

		return (
			<box
				orientation={Gtk.Orientation.VERTICAL}
				hexpand
				valign={Gtk.Align.CENTER}
			>
				<label cssClasses={[styles.name]} label={name} />
				<label
					cssClasses={[styles.status]}
					label={this.getDomainStateName(info.state)}
				/>
				<box halign={Gtk.Align.CENTER} cssClasses={[styles.buttons]}>
					{(() => {
						if (info.state == LibvirtGObject.DomainState.SHUTOFF) {
							return [start()];
						}

						if (info.state == LibvirtGObject.DomainState.PAUSED) {
							return [resume(), shutdown(), restart()];
						}

						return [suspend(), shutdown(), restart(), lookingGlass()];
					})()}
				</box>
			</box>
		);
	}

	public getEntries(): LauncherEntry[] {
		if (!this.connection) {
			return [];
		}

		const modifiedQuery = this.query
			.substring(this.hasPrefix ? PREFIX.length + 1 : 0)
			.toLowerCase();

		if (this.hasPrefix && !modifiedQuery) {
			const { RUNNING, PAUSED, PMSUSPENDED } = LibvirtGObject.DomainState;

			const onlineDomains = this.connection.get_domains().filter((domain) => {
				const state = domain.get_info().state;
				return state == RUNNING || state == PAUSED || state == PMSUSPENDED;
			});

			return [
				...onlineDomains.map((domain) => ({
					id: domain.get_uuid(),
					name: this.formatDomainName(domain.get_name()),
					icon: null,
				})),
				{
					id: "all",
					name: "All Virtual Machines",
					icon: null,
				},
			];
		}

		const domains = this.connection
			.get_domains()
			.filter((domain) =>
				this.formatDomainName(domain.get_name())
					.toLowerCase()
					.startsWith(modifiedQuery),
			);

		return domains.map((domain) => ({
			id: domain.get_uuid(),
			name: this.formatDomainName(domain.get_name()),
			icon: null,
		}));
	}

	public getIcon(): string {
		return "computer-symbolic";
	}
}
