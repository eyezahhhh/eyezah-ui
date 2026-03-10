import { CLASS } from "@const/class";
import { Astal, Gdk, Gtk } from "ags/gtk4";
import styles from "./greeter.window.style";
import app from "ags/gtk4/app";
import {
	Accessor,
	createBinding,
	createComputed,
	createState,
	onCleanup,
	With,
} from "gnim";
import Gamepad from "@service/gamepad";
import { Destroyer } from "@util/destroyer";
import { getIsPasswordInputFocused } from "./components/gamepad-password-input/gamepad-password-input.component";
import { getDesktopSessions } from "@util/desktop-sessions";
import { IDesktopSession } from "@interface/desktop-session";
import { SessionSelector } from "./components/session-selector/session-selector.component";
import { PowerButtonGroup } from "./components/power-button-group/power-button-group.component";
import { LoginSection } from "./components/login-section/login-section.component";
import { IS_DEV } from "@const/is-dev";
import { SESSIONS_DIRECTORY } from "@const/sessions-directory";
import Wallpaper from "@service/wallpaper";

export function GreeterWindow(gdkMonitor: Gdk.Monitor) {
	const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor;
	const [controllerMode, setControllerMode] = createState(false);
	const [sessions, setSessions] = createState<IDesktopSession[] | null>(null);
	const [selectedSessionIndex, setSelectedSessionIndex] = createState(0);
	const gamepad = Gamepad.get_default();
	const destroyer = new Destroyer();
	let window: Gtk.Window | null = null;
	const wallpaperService = Wallpaper.get_default();

	getDesktopSessions([SESSIONS_DIRECTORY])
		.then(setSessions)
		.catch((error) => {
			console.error(error);
			setSessions([]);
		});

	destroyer.add(
		sessions.subscribe(() => {
			const sessionsList = sessions.get();
			const index = selectedSessionIndex.get();
			if (sessionsList && sessionsList.length <= index) {
				setSelectedSessionIndex(0);
			}
		}),
	);

	let gamepadsDestroyer: Destroyer | null = null;
	const destroyers: Destroyer[] = [];
	const onGamepadsUpdate = () => {
		gamepadsDestroyer?.destroy();
		const destroyer = new Destroyer();
		gamepadsDestroyer = destroyer;
		destroyers.push(destroyer);
		const isPasswordInputFocused = getIsPasswordInputFocused();

		for (const controller of gamepad.gamepads) {
			destroyer.addDisconnect(
				controller,
				controller.connect("notify::direction", () => {
					if (window && !isPasswordInputFocused.get()) {
						const directions: Record<
							Gamepad.GamepadDirection,
							Gtk.DirectionType | null
						> = {
							[Gamepad.GamepadDirection.UP]: Gtk.DirectionType.UP,
							[Gamepad.GamepadDirection.DOWN]: Gtk.DirectionType.DOWN,
							[Gamepad.GamepadDirection.LEFT]: Gtk.DirectionType.LEFT,
							[Gamepad.GamepadDirection.RIGHT]: Gtk.DirectionType.RIGHT,
							[Gamepad.GamepadDirection.NONE]: null,
						};
						const direction = directions[controller.direction];
						if (direction) {
							window.child_focus(direction);
						}
					}
				}),
			);

			let buttonsDestroyer: Destroyer | null = null;
			const onButtonsUpdate = () => {
				buttonsDestroyer?.destroy();
				buttonsDestroyer = new Destroyer();
				const buttons = controller.buttons;
				for (const [index, button] of buttons.entries()) {
					buttonsDestroyer.addDisconnect(
						button,
						button.connect("notify::value", () => {
							setControllerMode(true);
						}),
					);
				}
			};
			destroyer.addDisconnect(
				controller,
				controller.connect("notify::buttons", onButtonsUpdate),
			);
			destroyer.add(() => buttonsDestroyer?.destroy());
			onButtonsUpdate();
		}
	};
	destroyer.addDisconnect(
		gamepad,
		gamepad.connect("notify::gamepads", onGamepadsUpdate),
	);
	onGamepadsUpdate();
	destroyer.add(() => gamepadsDestroyer?.destroy());

	onCleanup(() => {
		destroyer.destroy();
	});

	return (
		<window
			visible
			name="greeter"
			namespace={`${CLASS}_greeter`}
			gdkmonitor={gdkMonitor}
			cssClasses={[styles.window]}
			anchor={TOP | RIGHT}
			application={app}
			class={CLASS}
			keymode={IS_DEV ? Astal.Keymode.ON_DEMAND : Astal.Keymode.EXCLUSIVE}
			$={(self) => {
				window = self;
			}}
		>
			<Gtk.EventControllerKey onKeyPressed={() => setControllerMode(false)} />
			<Gtk.GestureClick onBegin={() => setControllerMode(false)} />
			<box
				cssClasses={[styles.container]}
				orientation={Gtk.Orientation.VERTICAL}
			>
				<Gtk.Overlay
					$={(overlay) => {
						overlay.add_overlay(
							(
								<box hexpand vexpand orientation={Gtk.Orientation.VERTICAL}>
									<box>
										<PowerButtonGroup />
									</box>
									<box
										halign={Gtk.Align.CENTER}
										valign={Gtk.Align.CENTER}
										vexpand
									>
										<LoginSection
											controllerMode={controllerMode}
											session={createComputed(
												[sessions, selectedSessionIndex],
												(sessions, index) => (sessions || [])[index] || null,
											)}
										/>
									</box>
									<box>
										<box hexpand>
											<SessionSelector
												sessions={sessions}
												selectedIndex={selectedSessionIndex}
												onChange={(index) => {
													const sessionsList = sessions.get();
													if (sessionsList && sessionsList.length > index) {
														setSelectedSessionIndex(index);
														console.log(`Setting selected button:`, index);
													}
												}}
											/>
										</box>
									</box>
								</box>
							) as Gtk.Widget,
						);
					}}
				>
					{/* <box hexpand vexpand /> */}
					<revealer
						cssClasses={[styles.background]}
						hexpand
						vexpand
						transitionType={Gtk.RevealerTransitionType.CROSSFADE}
						revealChild={createComputed(
							() =>
								createBinding(wallpaperService, "is_current_set")() &&
								!createBinding(wallpaperService, "is_loading_colors")(),
						)}
						child={createComputed(() => {
							if (!createBinding(wallpaperService, "is_current_set")()) {
								return (<box />) as Gtk.Widget;
							}
							const picture = Gtk.Picture.new_for_filename(
								createBinding(wallpaperService, "current")().getPath(),
							);
							picture.set_content_fit(Gtk.ContentFit.COVER);
							return picture;
						})}
						// child={createBinding(wallpaperService, "current").as(
						// 	(current) => {
						// 		const picture = Gtk.Picture.new_for_filename(
						// 			current.getPath(),
						// 		);
						// 		picture.set_content_fit(Gtk.ContentFit.COVER);
						// 		return picture;
						// 	},
						// )}
					/>
				</Gtk.Overlay>
			</box>
		</window>
	);
}
