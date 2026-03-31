import { CLASS } from "@const/class";
import { Destroyer } from "@util/destroyer";
import { Astal, Gdk, Gtk } from "ags/gtk4";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import {
	Accessor,
	createBinding,
	createState,
	For,
	onCleanup,
	With,
} from "gnim";
import styles from "./workspaces.window.style";
import { cc, compareString } from "@util/string";
import AppRequest from "@service/app-request";
import { getWindowIcon } from "@util/icon";
import app from "ags/gtk4/app";
import { createCursorPointer } from "@util/ags";
import { loop } from "@util/array";

const syncHyprland = async (hyprland: AstalHyprland.Hyprland) => {
	await Promise.all([
		new Promise<void>((resolve) =>
			hyprland.sync_monitors((_, res) => {
				hyprland.sync_monitors_finish(res);
				// console.log("Synced monitors");
				resolve();
			}),
		),
		new Promise<void>((resolve) =>
			hyprland.sync_workspaces((_, res) => {
				hyprland.sync_workspaces_finish(res);
				// console.log("Synced workspaces");
				resolve();
			}),
		),
		new Promise<void>((resolve) =>
			hyprland.sync_clients((_, res) => {
				hyprland.sync_clients_finish(res);
				// console.log("Synced clients");
				resolve();
			}),
		),
	]);
};

interface WorkspaceInfo {
	workspace: AstalHyprland.Workspace;
	clients: AstalHyprland.Client[];
}

interface MonitorInfo {
	name: string;
	monitor: AstalHyprland.Monitor;
	workspaces: WorkspaceInfo[];
	x: number;
	y: number;
}

function determineMonitorLayout(points: { x: number; y: number }[]) {
	if (!points.length) {
		return [];
	}

	// 1. Normalize to positive space
	const minX = Math.min(...points.map((p) => p.x));
	const minY = Math.min(...points.map((p) => p.y));

	const normalized = points.map((p) => ({
		x: p.x - minX,
		y: p.y - minY,
		original: p,
	}));

	// 2. Sort separately to find row/column groupings
	const sortedByX = [...normalized].sort((a, b) => a.x - b.x);
	const sortedByY = [...normalized].sort((a, b) => a.y - b.y);

	// 3. Build clusters (group similar coords)
	function cluster(values: number[], threshold: number): number[] {
		const groups: number[] = [];
		let current = values[0];

		groups.push(current);

		for (let i = 1; i < values.length; i++) {
			if (Math.abs(values[i] - current) > threshold) {
				current = values[i];
				groups.push(current);
			}
		}

		return groups;
	}

	// Estimate spacing from median difference
	function estimateSpacing(values: number[]): number {
		const diffs: number[] = [];
		for (let i = 1; i < values.length; i++) {
			diffs.push(values[i] - values[i - 1]);
		}
		diffs.sort((a, b) => a - b);
		return diffs[Math.floor(diffs.length / 2)] || 1;
	}

	const xs = sortedByX.map((p) => p.x);
	const ys = sortedByY.map((p) => p.y);

	const spacingX = estimateSpacing(xs);
	const spacingY = estimateSpacing(ys);

	const colAnchors = cluster(xs, spacingX / 2);
	const rowAnchors = cluster(ys, spacingY / 2);

	// 4. Assign each point to nearest row/col
	function nearestIndex(value: number, anchors: number[]): number {
		let best = 0;
		let bestDist = Infinity;

		for (let i = 0; i < anchors.length; i++) {
			const d = Math.abs(value - anchors[i]);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		}

		return best;
	}

	// 5. Build final dense grid
	return normalized.map((p) => ({
		original: p.original,
		gridX: nearestIndex(p.x, colAnchors),
		gridY: nearestIndex(p.y, rowAnchors),
	}));
}

export function WorkspacesWindow() {
	const hyprland = AstalHyprland.get_default();
	const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor;
	const [activeWorkspace, setActiveWorkspace] = createState<number | null>(
		null,
	);
	let isStarting = false;

	const changeActiveWorkspace = (increase: number) => {
		const currentWorkspaces = workspaces()
			.flatMap((monitor) => monitor.workspaces)
			.map(({ workspace }, index) => ({ workspace, index }));

		const activeId = activeWorkspace();
		let activeIndex = currentWorkspaces.find(
			({ workspace }) => workspace.id === activeId || activeId === null,
		)!.index;

		activeIndex += increase;
		while (activeIndex < 0) {
			activeIndex += currentWorkspaces.length;
		}
		while (activeIndex >= currentWorkspaces.length) {
			activeIndex -= currentWorkspaces.length;
		}
		const newWorkspace = currentWorkspaces[activeIndex].workspace;
		setActiveWorkspace(newWorkspace.id);
	};

	const [workspaces, setWorkspaces] = createState<MonitorInfo[]>([]);

	const goToWorkspace = (
		workspace: AstalHyprland.Workspace | number | null,
	) => {
		window.visible = false;
		if (typeof workspace == "number") {
			workspace = hyprland.get_workspace(workspace);
		}
		if (workspace) {
			hyprland.message(`dispatch workspace ${workspace.id}`);
		}
		setActiveWorkspace(null);
	};

	const updateWorkspaces = async (resetActiveId?: boolean) => {
		await syncHyprland(hyprland);

		const workspaces: WorkspaceInfo[] = hyprland
			.get_workspaces()
			.sort((a, b) => a.id - b.id)
			.map((workspace) => ({
				workspace,
				clients: hyprland
					.get_clients()
					.filter((client) => client.workspace.id === workspace.id),
			}));

		const monitors = new Map<AstalHyprland.Monitor, MonitorInfo>();
		for (const workspace of workspaces) {
			const info = monitors.get(workspace.workspace.monitor);
			if (info) {
				info.workspaces.push(workspace);
			} else {
				const { monitor } = workspace.workspace;
				const x = monitor.x + monitor.width / 2;
				const y = monitor.y + monitor.height / 2;

				monitors.set(workspace.workspace.monitor, {
					name: workspace.workspace.monitor.name,
					monitor: workspace.workspace.monitor,
					workspaces: [workspace],
					x,
					y,
				});
			}
		}

		const monitorArray = Array.from(monitors.values()).sort((a, b) =>
			compareString(a.name, b.name),
		);

		const grid = determineMonitorLayout(
			monitorArray.map((info) => ({
				x: info.x,
				y: info.y,
			})),
		);

		for (const [index, { gridX, gridY }] of grid.entries()) {
			monitorArray[index].x = gridX;
			monitorArray[index].y = gridY;
		}

		setWorkspaces(monitorArray);

		// setWorkspaces(hyprland.workspaces.sort((a, b) => a.id - b.id));
		if (resetActiveId) {
			setActiveWorkspace(hyprland.get_focused_workspace().id);
		} else {
			const active = activeWorkspace();
			if (!workspaces.some(({ workspace }) => workspace.id == active)) {
				setActiveWorkspace(hyprland.get_focused_workspace().id);
			}
		}
	};

	const destroyer = new Destroyer();
	destroyer.addDisconnect(
		hyprland,
		hyprland.connect("workspace-added", () => updateWorkspaces()),
	);
	destroyer.addDisconnect(
		hyprland,
		hyprland.connect("workspace-removed", () => updateWorkspaces()),
	);

	destroyer.add(
		AppRequest.get_default().addListener("workspaces", async (args) => {
			if (args.length == 1) {
				if (args[0] == "toggle") {
					if (window.visible) {
						window.visible = false;
					} else {
						await syncHyprland(hyprland);
						updateWorkspaces(true);
						window.visible = true;
					}

					return "success";
				}

				if (args[0] == "cancel") {
					console.log("Cancelled!", isStarting);
					return "success";
				}

				if (args[0].startsWith("+") || args[0].startsWith("-")) {
					let number = parseInt(args[0].substring(1));
					if (isNaN(number)) {
						return "Invalid number";
					}
					if (args[0].startsWith("-")) {
						number *= -1;
					}
					if (!window.visible) {
						window.visible = true;
						isStarting = true;

						await syncHyprland(hyprland);
						await updateWorkspaces(true);
						isStarting = false;
					}
					if (window.visible) {
						changeActiveWorkspace(number);
					}
					return "success";
				}
			}

			return "Unknown command";
		}),
	);

	updateWorkspaces();

	onCleanup(() => {
		destroyer.destroy();
	});

	const window = (
		<window
			anchor={TOP | BOTTOM | LEFT | RIGHT}
			name="workspaces"
			namespace={`${CLASS}_workspaces`}
			class={CLASS}
			application={app}
			keymode={Astal.Keymode.EXCLUSIVE}
			layer={Astal.Layer.OVERLAY}
			$={(self) => {
				hyprland.connect("notify", () => {
					// keep focus on window while it's open so we can listen for SUPER release
					if (self.visible) {
						self.grab_focus();
					}
				});
			}}
			cssClasses={[styles.window]}
		>
			<Gtk.EventControllerKey
				onKeyPressed={(_self, keyVal) => {
					if (keyVal == Gdk.KEY_Escape) {
						goToWorkspace(null);
					}
					if (keyVal == Gdk.KEY_leftarrow) {
						changeActiveWorkspace(-1);
					}
					if (keyVal == Gdk.KEY_rightarrow) {
						changeActiveWorkspace(1);
					}
				}}
				onKeyReleased={(_self, keyVal) => {
					if (keyVal == Gdk.KEY_Super_L) {
						goToWorkspace(activeWorkspace());
					}
				}}
			/>
			<box
				hexpand
				cssClasses={[styles.container]}
				orientation={Gtk.Orientation.VERTICAL}
				valign={Gtk.Align.CENTER}
			>
				<With value={workspaces}>
					{(workspaces) => {
						const rows = Math.max(...workspaces.map((w) => w.y + 1), 0);
						const columns = Math.max(...workspaces.map((w) => w.x + 1), 0);
						const maxWorkspaces = Math.max(
							...workspaces.flatMap((w) => w.workspaces.length),
							0,
						);

						return (
							<box orientation={Gtk.Orientation.VERTICAL}>
								{loop(rows, (row) => (
									<box>
										{workspaces
											.filter((info) => info.y == row)
											.map((monitor) => (
												<box
													cssClasses={[styles.monitor]}
													widthRequest={320 * maxWorkspaces}
													halign={Gtk.Align.CENTER}
												>
													<box halign={Gtk.Align.CENTER} hexpand>
														{monitor.workspaces.map(
															({ workspace, clients }) => (
																<Workspace
																	workspace={workspace}
																	clients={clients}
																	active={activeWorkspace.as(
																		(id) => workspace.id === id,
																	)}
																	onClick={() => goToWorkspace(workspace)}
																/>
															),
														)}
													</box>
												</box>
											))}
									</box>
								))}
							</box>
						);
					}}
				</With>
			</box>
		</window>
	) as Gtk.Window;

	return window;
}

interface WorkspaceProps {
	workspace: AstalHyprland.Workspace;
	clients: AstalHyprland.Client[];
	active: Accessor<boolean>;
	// onFocus?: (self: Gtk.Button) => void;
	onClick?: () => void;
}

function Workspace({ workspace, clients, active, onClick }: WorkspaceProps) {
	return (
		<button
			cssClasses={active.as((active) =>
				cc(styles.workspace, active && styles.active),
			)}
			onClicked={onClick}
			cursor={createCursorPointer()}
			halign={Gtk.Align.CENTER}
			hexpand
		>
			<box orientation={Gtk.Orientation.VERTICAL}>
				<label label={workspace.name} />
				<Gtk.Fixed
					cssClasses={[styles.previewContainer]}
					$={(fixed) => {
						const calculateScale = (
							monitorWidth: number,
							monitorHeight: number,
						) => {
							const maxWidth = 300;
							const maxHeight = (300 / 16) * 9;

							return Math.min(
								maxWidth / monitorWidth,
								maxHeight / monitorHeight,
							);
						};

						const monitor = workspace.get_monitor();
						const monitorWidth = monitor.get_width();
						const monitorHeight = monitor.get_height();

						const scale = calculateScale(monitorWidth, monitorHeight);
						const monitorScale = monitor.get_scale();

						fixed.widthRequest = monitorWidth * scale;
						fixed.heightRequest = monitorHeight * scale;

						for (const client of clients) {
							const width = client.get_width() * scale;
							const height = client.get_height() * scale;
							const x = (client.get_x() - monitor.get_x()) * scale;
							const y = (client.get_y() - monitor.get_y()) * scale;

							fixed.put(
								(
									<button
										cssClasses={[styles.previewClient]}
										widthRequest={width * monitorScale}
										heightRequest={height * monitorScale}
									></button>
								) as Gtk.Button,
								x * monitorScale,
								y * monitorScale,
							);

							let iconPixelSize = 20;
							let iconSize = Gtk.IconSize.LARGE;

							if (width < 24 || height < 24) {
								iconPixelSize = 10;
								iconSize = Gtk.IconSize.NORMAL;
							}

							fixed.put(
								(
									<image
										iconName={createBinding(client, "initial_class").as(
											(initialClass) =>
												getWindowIcon(initialClass) || "new-window-symbolic",
										)}
										iconSize={iconSize}
									/>
								) as Gtk.Image,
								(x + (width - iconPixelSize) / 2) * monitorScale,
								(y + (height - iconPixelSize) / 2) * monitorScale,
							);
						}
					}}
				/>
			</box>
		</button>
	);
}
