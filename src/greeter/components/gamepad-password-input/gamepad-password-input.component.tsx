import {
	Accessor,
	createBinding,
	createComputed,
	createState,
	For,
	onCleanup,
	With,
} from "gnim";
import styles from "./gamepad-password-input.component.style";
import Gamepad from "@service/gamepad";
import { cc } from "@util/string";
import { Destroyer } from "@util/destroyer";
import { Gtk } from "ags/gtk4";
import { IDesktopSession } from "@interface/desktop-session";
import Accounts from "@service/accounts";
import { Group } from "../group/group.component";
import AccountsService from "gi://AccountsService?version=1.0";

const PASSWORD_LENGTH = 6;

const [isFocused, setIsFocused] = createState(false);
export function getIsPasswordInputFocused() {
	return isFocused;
}

abstract class Input {
	public readonly character: string;

	constructor(blockedChars: string) {
		const CHARACTERS = "@#$%&!";
		let character: string;
		do {
			character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
		} while (blockedChars.includes(character));
		this.character = character;
	}

	abstract serialize(): string;
}

class JoystickInput extends Input {
	public readonly type = "joystick";

	constructor(
		blockedChars: string,
		public readonly axisIndex: number,
		public readonly direction: Gamepad.GamepadDirection,
	) {
		super(blockedChars);
	}

	serialize(): string {
		return `j`; // todo: serialize properly
	}
}

class ButtonInput extends Input {
	public readonly type = "button";

	constructor(
		blockedChars: string,
		public readonly buttonIndex: number,
	) {
		super(blockedChars);
	}

	serialize(): string {
		return `b${this.buttonIndex}`;
	}
}

interface Props {
	isLoggingIn: Accessor<boolean>;
	onLoginAttempt: (
		username: string,
		password: string,
		isController: boolean,
	) => void;
}

export function GamepadPasswordInput({ isLoggingIn, onLoginAttempt }: Props) {
	const gamepad = Gamepad.get_default();
	const [password, setPassword] = createState<(JoystickInput | ButtonInput)[]>(
		[],
	);
	const [focusedController, setFocusedController] =
		createState<Gamepad.Gamepad | null>(null);
	const [selectedUserIndex, setSelectedUserIndex] = createState(0);
	const destroyer = new Destroyer();
	const accounts = Accounts.get_default();

	let focusedControllerDestroyer: Destroyer | null = null;
	destroyer.add(() => focusedControllerDestroyer?.destroy());
	focusedController.subscribe(() => {
		focusedControllerDestroyer?.destroy();
		const controller = focusedController.get();
		if (controller) {
			setIsFocused(true);
			console.log("Listening to controller inputs!");
			// todo: add joystick support

			const destroyer = new Destroyer();
			destroyer.add(() => buttonsDestroyer?.destroy());
			focusedControllerDestroyer = destroyer;

			let buttonsDestroyer: Destroyer | null = null;
			const buttonsUpdate = () => {
				buttonsDestroyer?.destroy();
				buttonsDestroyer = new Destroyer();

				const buttons = controller.buttons;
				const buttonsPressed = new Map<Gamepad.ButtonId, boolean>();
				for (const button of buttons) {
					buttonsPressed.set(button.button_id, button.value == 1);
				}

				for (const button of buttons) {
					buttonsDestroyer.addDisconnect(
						button,
						button.connect("notify::value", () => {
							const pressed = button.value == 1;
							if (buttonsPressed.get(button.button_id) != pressed) {
								buttonsPressed.set(button.button_id, pressed);
								if (
									!isLoggingIn.get() &&
									pressed &&
									password.peek().length < PASSWORD_LENGTH
								) {
									const inputs = password.get();
									let blockedChars = "";
									for (
										let i = Math.max(0, inputs.length - 3);
										i < inputs.length;
										i++
									) {
										blockedChars += inputs[i].character;
									}

									const input = new ButtonInput(blockedChars, button.button_id);
									setPassword([...password.get(), input]);
								}
							}
						}),
					);
				}
			};
			controller.connect("notify::buttons", buttonsUpdate);
			buttonsUpdate();
		} else {
			focusedControllerDestroyer = null;
			setIsFocused(false);
		}
	});

	destroyer.add(
		password.subscribe(() => {
			const inputs = password.get();
			const user = accounts.users[selectedUserIndex.get()];
			if (inputs.length >= PASSWORD_LENGTH && user) {
				const serializedPassword = inputs
					.map((input) => input.serialize())
					.join("");

				onLoginAttempt(user.get_user_name(), serializedPassword, true);
			}
		}),
	);

	destroyer.addDisconnect(
		accounts,
		accounts.connect("notify::users", () => {
			const usersCount = accounts.users.length;
			if (selectedUserIndex.get() >= usersCount) {
				setSelectedUserIndex(usersCount - 1);
			}
		}),
	);

	destroyer.add(
		isLoggingIn.subscribe(() => {
			if (!isLoggingIn.get()) {
				setFocusedController(null);
				setPassword([]);
			}
		}),
	);

	onCleanup(() => {
		destroyer.destroy();
	});

	return (
		<box orientation={Gtk.Orientation.VERTICAL}>
			<box hexpand cssClasses={[styles.userSelectContainer]}>
				<Group
					selectedIndex={selectedUserIndex}
					itemCssClasses={[styles.user]}
					itemCssFocusedClass={styles.focused}
					onClicked={setSelectedUserIndex}
				>
					{createBinding(accounts, "users").as((users) =>
						users.map((user) => <label label={user.get_user_name()} hexpand />),
					)}
				</Group>
			</box>

			<button
				cssClasses={createComputed([focusedController], (focusedController) =>
					cc(styles.container, focusedController && styles.focused),
				)}
				onClicked={() => {
					const controller = gamepad.gamepads[0];
					if (controller) {
						setFocusedController(controller);
					}
				}}
				halign={Gtk.Align.CENTER}
				onRealize={(self) => self.grab_focus()}
			>
				<Gtk.EventControllerFocus
					onEnter={(self) => {
						const destroyer = new Destroyer();
						destroyer.add(
							gamepad.connectForAllGamepadButtons(
								"notify::value",
								(gamepad, button) => {
									if (button.value == 1) {
										if (button.button_id == Gamepad.ButtonId.SOUTH) {
											console.log("Focusing password input");
											setFocusedController(gamepad);
										}
									}
								},
							),
						);

						destroyer.addDisconnect(
							self,
							self.connect("leave", () => {
								destroyer.destroy();
								setFocusedController(null);
							}),
						);
					}}
				/>
				<box>
					<box>
						<For each={password}>
							{(input) => (
								<box>
									<label
										label={input.character}
										cssClasses={[styles.character]}
									/>
								</box>
							)}
						</For>
					</box>
					<box>
						<With value={password}>
							{(password) => (
								<box>
									{Array(PASSWORD_LENGTH - password.length)
										.fill(null)
										.map(() => (
											<box>
												<label label="_" cssClasses={[styles.character]} />
											</box>
										))}
								</box>
							)}
						</With>
					</box>
				</box>
			</button>
		</box>
	);
}
