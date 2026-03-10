import { Destroyer } from "@util/destroyer";
import { getMinimumCoverSize, loadImageAsync } from "@util/image";
import { Gdk, Gtk } from "ags/gtk4";
import GdkPixbuf from "gi://GdkPixbuf?version=2.0";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { Accessor } from "gnim";

interface ImageInfo {
	pixbuf: GdkPixbuf.Pixbuf;
	allocation: Gdk.Rectangle;
}

export default function Thumbnail(props: {
	path: string;
	contentFit?: Gtk.ContentFit;
}) {
	const { path, contentFit } = props;

	return (
		<box
			hexpand
			vexpand
			$={(self) => {
				const destroyer = new Destroyer();

				let cancellable: Gio.Cancellable | null = null;

				destroyer.addDisconnect(
					self,
					self.connect("map", () => {
						cancellable = new Gio.Cancellable();
						destroyer.add(() => cancellable?.cancel());

						const connectionId = self.connect("unmap", () => {
							cancellable!.cancel();
							self.disconnect(connectionId);
						});
						GLib.idle_add(GLib.PRIORITY_LOW, () => {
							const allocation = self.get_allocation();
							if (!allocation.width || !allocation.height) {
								return GLib.SOURCE_CONTINUE;
							}
							loadImageAsync(path, {
								cancellable: cancellable!,
								dimensions: (imageDimensions) =>
									getMinimumCoverSize(
										...imageDimensions,
										allocation.width,
										allocation.height,
									),
							})
								.then((pixbuf) => {
									const picture = new Gtk.Picture({
										widthRequest: allocation.width,
										heightRequest: allocation.height,
										contentFit: contentFit || Gtk.ContentFit.COVER,
									});
									picture.set_pixbuf(pixbuf);
									self.append(picture);
								})
								.catch((e) => {
									if (
										!(e instanceof GLib.Error) ||
										!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)
									) {
										console.error(`Failed to load image: ${path}:`, e);
									}
								});
							return GLib.SOURCE_REMOVE;
						});
					}),
				);

				destroyer.addDisconnect(
					self,
					self.connect("unmap", () => {
						destroyer.destroy();
					}),
				);
			}}
		/>
	);
}
