import { Gtk } from "ags/gtk4";
import { Accessor, createState } from "gnim";
import styles from "./keyboard-password-input.component.style";

interface Props {
	isLoggingIn: Accessor<boolean>;
	onLoginAttempt: (
		username: string,
		password: string,
		isController: boolean,
	) => void;
}

export function KeyboardPasswordInput({ isLoggingIn, onLoginAttempt }: Props) {
	const [username, setUsername] = createState("");
	const [password, setPassword] = createState("");
	let passwordEntry: Gtk.Entry | null = null;

	const login = () => {
		const user = username.get();
		const pass = password.get();

		if (!user.trim() || !pass.trim()) {
			return;
		}

		onLoginAttempt(user, pass, false);
	};

	return (
		<revealer
			revealChild={isLoggingIn.as((loggingIn) => !loggingIn)}
			transitionType={Gtk.RevealerTransitionType.CROSSFADE}
			transitionDuration={300}
		>
			<box
				orientation={Gtk.Orientation.VERTICAL}
				cssClasses={[styles.container]}
			>
				<entry
					onRealize={(self) => self.grab_focus()}
					onNotifyText={(self) => setUsername(self.text)}
					placeholderText="Username"
					cssClasses={[styles.entry]}
					onActivate={() => passwordEntry?.grab_focus()}
				/>
				<entry
					onNotifyText={(self) => setPassword(self.text)}
					placeholderText="Password"
					visibility={false}
					invisibleChar={"*".charCodeAt(0)}
					cssClasses={[styles.entry]}
					$={(self) => {
						passwordEntry = self;
					}}
					onActivate={login}
				/>
			</box>
		</revealer>
	);
}
