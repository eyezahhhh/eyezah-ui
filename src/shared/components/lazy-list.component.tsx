import { clearChildren, createListFactory } from "@util/ags";
import { Gtk } from "ags/gtk4";
import { Accessor } from "gnim";
import GObject from "gnim/gobject";

export default function LazyList<T extends GObject.Object>(props: {
	model: Gtk.SelectionModel<T>;
	build: (entry: T) => Gtk.Widget;
	// build: (entry: T) => Gtk.Widget;
	// empty: () => Gtk.Widget;
	cssClasses?: string[] | Accessor<string[]>;
	gridCssClasses?: string[] | Accessor<string[]>;
	onActivate?: (item: T) => void;
	setup?: (self: Gtk.GridView) => void;
}) {
	const { model, build, cssClasses, gridCssClasses, onActivate, setup } = props;
	const children = new Map<
		Gtk.Widget,
		{
			entry: T;
			visibilityBox: Gtk.Widget;
		}
	>();

	let timeout: ReturnType<typeof setTimeout> | null = null;

	const checkChildren = () => {
		if (timeout) {
			return;
		}
		timeout = setTimeout(() => {
			timeout = null;

			for (let [child, data] of children) {
				data.visibilityBox.visible = child.get_mapped();
			}
		}, 300);
	};

	return (
		<Gtk.ScrolledWindow
			cssClasses={cssClasses}
			hexpand
			$={(self) => {
				const vadjustment = self.get_vadjustment()!;
				if (vadjustment) {
					checkChildren();
					vadjustment.connect("value-changed", checkChildren);
				}
			}}
		>
			<Gtk.GridView
				cssClasses={gridCssClasses}
				minColumns={2}
				maxColumns={2}
				model={model}
				hexpand
				$={(self) => {
					setup?.(self);

					self.set_single_click_activate(true);

					self.connect("activate", (_self, position) => {
						const item = model.get_item(position);
						if (item) {
							onActivate?.(item as T);
						}
					});

					self.connect("unrealize", () => {
						if (timeout) {
							clearTimeout(timeout);
						}
					});
				}}
				factory={createListFactory<T>(
					(item) =>
						(
							<box
								hexpand
								$={(self) => {
									const child = self.get_first_child()!;

									children.set(self, {
										entry: item,
										visibilityBox: child,
									});

									self.connect("unrealize", () => children.delete(self));
								}}
							>
								<box visible={false}>{build(item)}</box>
							</box>
						) as Gtk.Widget,
				)}
			/>
		</Gtk.ScrolledWindow>
	);
}
