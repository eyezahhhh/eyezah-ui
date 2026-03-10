import { Gdk, Gtk } from "ags/gtk4";
import Gio from "gi://Gio";
import { Accessor, createState } from "gnim";
import GObject from "gnim/gobject";

export function optionalAs<T, V>(
	value: T | Accessor<T>,
	callback: (value: T) => V,
) {
	if (value instanceof Accessor) {
		return value.as(callback);
	}
	return callback(value);
}

export function getOptional<T>(value: T | Accessor<T>) {
	if (value instanceof Accessor) {
		return value.peek();
	}
	return value;
}

export function asAccessor<T>(value: T | Accessor<T>) {
	if (value instanceof Accessor) {
		return value;
	}
	const [accessor] = createState(value);
	return accessor;
}

export function createCursorPointer() {
	return new Gdk.Cursor({
		name: "pointer",
	});
}

export function createList<T extends GObject.Object>(
	source: T[] | Accessor<T[]>,
) {
	const accessor = asAccessor(source);
	const list = new Gio.ListStore<T>();

	accessor.subscribe(() => {
		const items = accessor.peek();
		const oldList = listStoreToArray(list);
		for (let i = oldList.length - 1; i >= 0; i--) {
			// remove old items
			const item = oldList[i];
			if (!items.includes(item)) {
				list.remove(i);
			}
		}

		items.forEach((item, i) => {
			if (!oldList.includes(item)) {
				list.insert(i, item);
			}
		});
	});

	accessor.peek().forEach((entry) => list.append(entry));

	return list;
}

export function listStoreToArray<T extends GObject.Object>(
	listStore: Gio.ListStore<T>,
) {
	const array: T[] = [];
	for (let i = 0; i < listStore.get_n_items(); i++) {
		const item = listStore.get_item(i);
		if (item) {
			array.push(item);
		}
	}
	return array;
}

export function clearChildren(box: Gtk.Box) {
	let child = box.get_first_child();
	while (child) {
		const next = child.get_next_sibling();
		box.remove(child);
		child = next;
	}
}

export function createListFactory<T extends GObject.Object>(
	build: (item: T) => Gtk.Widget,
) {
	const factory = Gtk.SignalListItemFactory.new();

	factory.connect("bind", (_factory, listItem: Gtk.ListItem) => {
		const item = listItem.get_item() as T;
		listItem.set_child(build(item));
	});

	return factory;
}
