import { Astal, Gtk } from "ags/gtk4";
import GObject from "gnim/gobject";
import { LauncherEntry, LauncherHandler } from "../launcher-handler";
import Wallpaper from "@service/wallpaper";
import { Accessor, createBinding, With } from "gnim";
import Thumbnail from "@components/thumbnail/thumbnail";
import Pango from "gi://Pango";
import AstalHyprland from "gi://AstalHyprland";
import styles from "./wallpaper.launcher-handler.style";
import { createList } from "@util/ags";
import LazyList from "@components/lazy-list";

export class WallpaperLauncherHandler extends LauncherHandler {
	private readonly wallpaper = Wallpaper.get_default();
	private visible = false;
	private query = "";
	private listWidget: Gtk.GridView | null = null;

	constructor(setQuery: (query: string) => void) {
		super("Wallpaper", setQuery, true);
	}

	public update(query: string): void {
		const words = query.split(" ");
		if (words[0].toLowerCase() != "wallpaper") {
			if (this.visible || this.query) {
				this.visible = false;
				this.query = "";
				this.triggerUpdate(query);
			}
			return;
		}

		const searchTerm = query.substring("wallpaper ".length);

		if (!this.visible || searchTerm != this.query) {
			this.visible = true;
			this.query = searchTerm;
			this.triggerUpdate(query);
		}
	}
	public getContent(
		entryId: string,
		window: Astal.Window,
	): GObject.Object | null {
		if (entryId == "current") {
			return (
				<box>
					<With
						value={
							createBinding(
								this.wallpaper,
								"current",
							) as Accessor<Wallpaper.WallpaperFile>
						}
					>
						{(current) => (
							<box
								orientation={Gtk.Orientation.VERTICAL}
								cssClasses={[styles.current]}
							>
								<box vexpand hexpand>
									<Thumbnail
										path={current.getPath()}
										contentFit={Gtk.ContentFit.FILL}
									/>
								</box>
								<label
									wrap
									wrapMode={Pango.WrapMode.CHAR}
									justify={Gtk.Justification.CENTER}
									halign={Gtk.Align.CENTER}
									cssClasses={[styles.filename]}
									label={current.name}
								/>
								<button
									halign={Gtk.Align.CENTER}
									onClicked={() => {
										const hyprland = AstalHyprland.get_default();
										hyprland.message(
											`dispatch exec nemo ${current.getMutablePath()}`,
										);
										window.visible = false;
									}}
									cssClasses={[styles.open]}
								>
									<label label="Open in File Explorer" />
								</button>
							</box>
						)}
					</With>
				</box>
			);
		}

		const selection = new Gtk.NoSelection({
			model: createList(
				createBinding(this.wallpaper, "files").as(
					(files: Wallpaper.WallpaperFile[]) =>
						files.filter((file) => file.name.includes(this.query)),
				),
			),
		});

		return (
			<LazyList
				gridCssClasses={[styles.grid]}
				model={selection}
				onActivate={(file) => {
					this.wallpaper.current = file;
				}}
				setup={(list) => {
					list.connect("map", () => {
						this.listWidget = list;
					});

					list.connect("unmap", () => {
						if (this.listWidget == list) {
							this.listWidget = null;
						}
					});
				}}
				build={(file: Wallpaper.WallpaperFile) =>
					(
						<box cssClasses={[styles.thumbnail]} hexpand>
							<Thumbnail path={file.getPath()} />
						</box>
					) as Gtk.Widget
				}
			/>
		);
	}

	public getEntries(): LauncherEntry[] {
		if (!this.visible) {
			return [];
		}

		return [
			{
				name: "Current wallpaper",
				id: "current",
				icon: null,
			},
			{
				name: "All wallpapers",
				id: "all",
				icon: null,
			},
		];
	}

	public getIcon(): string {
		return "preferences-desktop-display-symbolic";
	}
}
