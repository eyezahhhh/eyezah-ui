import Gamepad from "@service/gamepad";
import { Destroyer } from "@util/destroyer";
import { Gdk, Gtk } from "ags/gtk4";
import { Accessor, createComputed, createState, For, onCleanup } from "gnim";
import styles from "./group.component.style";
import { asAccessor, createCursorPointer } from "@util/ags";
import { cc } from "@util/string";

interface Props {
	// children: Gtk.Widget[] | Accessor<Gtk.Widget[]>;
	children: any[] | Accessor<any[]>;
	selectedIndex: number | Accessor<number>;
	onClicked?: (index: number) => void;
	containerCssClasses?: string[] | Accessor<string[]>;
	containerCssFocusedClass?: string | Accessor<string>;
	orientation?: Gtk.Orientation | Accessor<Gtk.Orientation>;
	itemCssClasses?: string[] | Accessor<string[]>;
	itemCssFocusedClass?: string | Accessor<string>;
}

export function Group({
	children,
	selectedIndex,
	onClicked,
	containerCssClasses,
	containerCssFocusedClass,
	orientation,
	itemCssClasses,
	itemCssFocusedClass,
}: Props) {
	const [focusedButton, setFocusedButton] = createState<number>(-1);
	const [isFocused, setIsFocused] = createState(false);
	const gamepad = Gamepad.get_default();
	let container: Gtk.Button | null = null;

	const destroyer = new Destroyer();

	destroyer.add(
		focusedButton.subscribe(() => setIsFocused(focusedButton.get() >= 0)),
	);

	onCleanup(() => {
		destroyer.destroy();
	});

	return (
		<box cssClasses={[styles.paddingContainer]}>
			<button
				cssClasses={createComputed(
					[
						focusedButton,
						asAccessor(containerCssClasses),
						asAccessor(containerCssFocusedClass),
					],
					(focusedButton, classes, focusedClass) =>
						cc(
							styles.container,
							...(classes || []),
							focusedButton >= 0 && focusedClass,
						),
				)}
				$={(self) => {
					container = self;
				}}
				onClicked={(self) => {
					const focusedButtonIndex = focusedButton();
					if (focusedButtonIndex >= 0) {
						onClicked?.(focusedButtonIndex);
					} else if (self.has_focus) {
						setFocusedButton(0);
					}
				}}
			>
				<Gtk.EventControllerKey
					onKeyPressed={(_self, keyVal) => {
						if (keyVal == Gdk.KEY_Escape) {
							setFocusedButton(-1);
							container?.grab_focus();
						}
					}}
				/>
				<Gtk.EventControllerFocus
					onEnter={(self) => {
						const destroyer = new Destroyer();
						destroyer.add(
							gamepad.connectForAllGamepadButtons(
								"notify::value",
								(_gamepad, button) => {
									if (button.value == 1) {
										if (button.button_id == Gamepad.ButtonId.SOUTH) {
											console.log("Focus group!");
											const focusedButtonIndex = focusedButton();
											if (focusedButtonIndex >= 0) {
												onClicked?.(focusedButtonIndex);
											} else if (container?.has_focus) {
												setFocusedButton(0);
											}
										}
										if (button.button_id == Gamepad.ButtonId.EAST) {
											console.log("Leave group[!");
											setFocusedButton(-1);
											container?.grab_focus();
										}
									}
								},
							),
						);

						destroyer.addDisconnect(
							self,
							self.connect("leave", () => {
								destroyer.destroy();
								setFocusedButton(-1);
							}),
						);
					}}
				/>
				<box orientation={orientation}>
					<For each={asAccessor(children) as Accessor<Gtk.Widget[]>}>
						{(value, index) => (
							<button
								cssClasses={createComputed(
									[
										asAccessor(selectedIndex),
										asAccessor(index),
										asAccessor(itemCssClasses),
										asAccessor(itemCssFocusedClass),
									],
									(selectedIndex, index, classes, focusedClass) =>
										cc(
											styles.button,
											...(classes || []),
											selectedIndex == index && focusedClass,
										),
								)}
								onClicked={() => onClicked?.(index.get())}
								cursor={createCursorPointer()}
								focusable={isFocused}
								onRealize={(self) => {
									const focusChange = () => {
										if (
											isFocused.get() &&
											asAccessor(selectedIndex).get() == index.get()
										) {
											setTimeout(() => {
												self.grab_focus();
											});
										}
									};

									const destroyer = new Destroyer();
									destroyer.add(isFocused.subscribe(focusChange));
									destroyer.addDisconnect(
										self,
										self.connect("unrealize", () => destroyer.destroy()),
									);
									focusChange();
								}}
							>
								<Gtk.EventControllerFocus
									onEnter={() => {
										setFocusedButton(index.get());
									}}
								/>
								{value}
							</button>
						)}
					</For>
				</box>
			</button>
		</box>
	);
}
