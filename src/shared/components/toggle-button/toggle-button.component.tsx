import { asAccessor, createCursorPointer, getOptional } from "@util/ags";
import { cc } from "@util/string";
import { Gdk, Gtk } from "ags/gtk4";
import { Accessor, createComputed } from "gnim";
import styles from "./toggle-button.component.style";
import GObject from "gnim/gobject";

export function ToggleButton(
	props: Partial<Gtk.Button.ConstructorProps> & {
		active?: boolean | Accessor<boolean>;
		disabled?: boolean | Accessor<boolean>;
		children?: GObject.Object;
		onClicked?: (() => void) | Accessor<() => void>;
	},
) {
	const { active, disabled, cssClasses, onClicked, ...passthroughProps } =
		props;

	return (
		<button
			{...passthroughProps}
			onClicked={getOptional(onClicked)}
			cssClasses={createComputed(
				[asAccessor(active), asAccessor(cssClasses), asAccessor(disabled)],
				(active, classes, disabled) =>
					cc(
						...(classes || []),
						active && styles.active,
						disabled && styles.disabled,
					),
			)}
			cursor={createCursorPointer()}
		/>
	);
}
