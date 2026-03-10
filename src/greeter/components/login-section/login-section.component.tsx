import { Destroyer } from "@util/destroyer";
import { Accessor, createState, onCleanup, With } from "gnim";
import { GamepadPasswordInput } from "../gamepad-password-input/gamepad-password-input.component";
import { KeyboardPasswordInput } from "../keyboard-password-input/keyboard-password-input.component";
import { IDesktopSession } from "@interface/desktop-session";
import AstalGreet from "gi://AstalGreet?version=0.1";
import Gamepad from "@service/gamepad";

interface Props {
	controllerMode: Accessor<boolean>;
	session: Accessor<IDesktopSession | null>;
}

export function LoginSection({ controllerMode, session }: Props) {
	const gamepadService = Gamepad.get_default();
	const [cachedControllerMode, setCachedControllerMode] = createState(
		!!gamepadService.gamepads.length,
	);
	const [isLoggingIn, setIsLoggingIn] = createState(false);

	const destroyer = new Destroyer();

	destroyer.add(
		controllerMode.subscribe(() => {
			if (!isLoggingIn.get()) {
				setCachedControllerMode(controllerMode.get());
			}
		}),
	);
	destroyer.add(
		isLoggingIn.subscribe(() => {
			if (!isLoggingIn.get()) {
				setCachedControllerMode(controllerMode.get());
			}
		}),
	);
	destroyer.addDisconnect(
		gamepadService,
		gamepadService.connect("notify::gamepads", () => {
			setCachedControllerMode(true);
		}),
	);

	const login = (username: string, password: string, isController: boolean) => {
		const currentSession = session.get();
		if (!currentSession) {
			return;
		}
		console.log(
			`Login attempt: ${username} ${password} ${currentSession.name}`,
		);
		setIsLoggingIn(true);

		AstalGreet.login(username, password, currentSession.exec, (_, result) => {
			try {
				AstalGreet.login_finish(result);
				console.log("Login successful?");
			} catch (e) {
				console.error(e);
				setIsLoggingIn(false);
			}
		});

		setTimeout(() => {
			setIsLoggingIn(false);
		}, 1_500);
	};

	onCleanup(() => {
		destroyer.destroy();
	});

	return (
		<box>
			<With value={cachedControllerMode}>
				{(controllerMode) =>
					controllerMode ? (
						<GamepadPasswordInput
							isLoggingIn={isLoggingIn}
							onLoginAttempt={login}
						/>
					) : (
						<KeyboardPasswordInput
							isLoggingIn={isLoggingIn}
							onLoginAttempt={login}
						/>
					)
				}
			</With>
		</box>
	);
}
