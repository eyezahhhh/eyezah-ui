import { CLASS } from "@const/class";
import Wallpaper from "@service/wallpaper";
import { Astal, Gdk, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import { createBinding, With } from "gnim";

export function WallpaperWindow(gdkMonitor: Gdk.Monitor) {
	const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor;

	const wallpaperService = Wallpaper.get_default();

	return (
		<window
			name="wallpaper"
			namespace={`${CLASS}_wallpaper`}
			anchor={TOP | BOTTOM | LEFT | RIGHT}
			gdkmonitor={gdkMonitor}
			application={app}
			class={CLASS}
			layer={Astal.Layer.BACKGROUND}
			visible
		>
			<box hexpand vexpand>
				<With value={createBinding(wallpaperService, "is_current_set")}>
					{(isSet) =>
						isSet ? (
							<revealer
								hexpand
								vexpand
								revealChild={createBinding(
									wallpaperService,
									"is_loading_colors",
								).as((loading) => !loading)}
								transitionType={Gtk.RevealerTransitionType.CROSSFADE}
								transitionDuration={1_000}
								child={createBinding(wallpaperService, "current").as(
									(wallpaper) => {
										const picture = Gtk.Picture.new_for_filename(
											wallpaper.getPath(),
										);
										picture.set_content_fit(Gtk.ContentFit.COVER);
										return picture;
									},
								)}
							></revealer>
						) : null
					}
				</With>
			</box>
		</window>
	) as Gtk.Window;
}
