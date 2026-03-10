import { Astal, Gdk, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import { CLASS } from "constants/class.const";
import styles from "./launcher.window.style";
import { LauncherEntry, LauncherHandler } from "./handlers/launcher-handler";
import { AppsLauncherHandler } from "./handlers/apps/apps.launcher-handler";
import { createState, For, onCleanup, With } from "gnim";
import { Destroyer } from "@util/destroyer";
import { getValidIcon } from "@util/icon";
import Pango from "gi://Pango?version=1.0";
import { CalcLauncherHandler } from "./handlers/calc/calc.launcher-handler";
import { CodeLauncherHandler } from "./handlers/code/code.launcher-handler";
import { DictionaryLauncherHandler } from "./handlers/dictionary/dictionary.launcher-handler";
import { FirefoxLauncherHandler } from "./handlers/firefox/firefox.launcher-handler";
import { TodoLauncherHandler } from "./handlers/todo/todo.launcher-handler";
import { WallpaperLauncherHandler } from "./handlers/wallpaper/wallpaper.launcher-handler";
import { VMLauncherHandler } from "./handlers/vm/vm.launcher-handler";
import { IS_DEV } from "@const/is-dev";
import { BibleLauncherHandler } from "./handlers/bible/bible.launcher-handler";

interface Section {
	handler: LauncherHandler;
	entries: LauncherEntry[];
}

export function LauncherWindow() {
	const { TOP, RIGHT } = Astal.WindowAnchor;
	const destroyer = new Destroyer();
	const [query, setQuery] = createState("");
	const [loadingHandlers, setLoadingHandlers] = createState<LauncherHandler[]>(
		[],
	);
	let updateTimeout: ReturnType<typeof setTimeout> | null = null;

	const [activeEntry, setActiveEntry] = createState<
		[LauncherHandler, LauncherEntry] | null
	>(null);

	const handlers: LauncherHandler[] = [
		new TodoLauncherHandler(setQuery),
		new CodeLauncherHandler(setQuery),
		new WallpaperLauncherHandler(setQuery),
		new FirefoxLauncherHandler(setQuery),
		new VMLauncherHandler(setQuery),
		new BibleLauncherHandler(setQuery),
		new AppsLauncherHandler(setQuery),
		new DictionaryLauncherHandler(setQuery),
		new CalcLauncherHandler(setQuery),
	];
	const [sections, setSections] = createState<Section[]>(
		handlers.map((handler) => ({
			handler,
			entries: [],
		})),
	);

	{
		const newLoadingHandlers: LauncherHandler[] = [];

		for (const handler of handlers) {
			handler.addListener((cachedQuery) => {
				if (typeof cachedQuery == "string" && cachedQuery !== query.peek()) {
					return;
				}
				try {
					const newSections = [...sections.peek()];
					const index = newSections.findIndex(
						(section) => section.handler == handler,
					);
					newSections[index] = {
						handler,
						entries: handler.isEnabled() ? handler.getEntries() : [],
					};
					setSections(newSections);

					if (updateTimeout) {
						clearTimeout(updateTimeout);
					}

					updateTimeout = setTimeout(async () => {
						for (let { handler, entries } of Object.values(sections.peek())) {
							if (entries.length) {
								setActiveEntry([handler, entries[0]]);
								return;
							}
						}
						setActiveEntry(null);
					}, 0);
				} catch (e) {
					console.error(
						`Error while retrieving entries for launcher handler "${handler.getName()}"`,
						e,
					);
				}
			});

			if (handler.isLoading()) {
				newLoadingHandlers.push(handler);
			}
			handler.addLoadingListener(() => {
				if (handler.isLoading()) {
					setLoadingHandlers((handlers) => {
						if (handlers.includes(handler)) {
							return handlers;
						}
						return [...handlers, handler];
					});
				} else {
					setLoadingHandlers((handlers) =>
						handlers.filter((h) => h != handler),
					);
				}
			});
		}

		setLoadingHandlers(newLoadingHandlers);
	}

	const clearEntries = () => {
		setSections((sections) =>
			sections.map(({ handler }) => ({
				handler,
				entries: [],
			})),
		);
		setActiveEntry(null);
	};

	destroyer.add(
		query.subscribe(() => {
			if (updateTimeout) {
				clearTimeout(updateTimeout);
			}
			const queryString = query.peek();
			if (!queryString.trim()) {
				clearEntries();
				return;
			}
			for (const handler of handlers) {
				try {
					handler.update(queryString);
				} catch (e) {
					console.error(
						`Error while updating query for launcher handler "${handler.getName()}"`,
						e,
					);
				}
			}
		}),
	);

	onCleanup(() => {
		destroyer.destroy();
	});

	const entry = (
		<entry
			cssClasses={[styles.input]}
			onNotifyText={(entry) => {
				setQuery(entry.text);
			}}
			onActivate={() => {
				const entryInfo = activeEntry.peek();
				if (entryInfo) {
					const [manager, entry] = entryInfo;
					manager.onEnter(entry.id, window);
				}
			}}
			$={(self) => {
				const unsubscribe = query.subscribe(() => {
					const queryString = query.peek();
					if (queryString != self.text) {
						self.text = queryString;
						self.grab_focus_without_selecting();
						self.set_position(-1);
					}
				});

				self.connect("destroy", () => {
					unsubscribe();
				});
			}}
		/>
	) as Gtk.Entry;
	const window = (
		<window
			visible={false}
			name="launcher"
			class={CLASS}
			exclusivity={Astal.Exclusivity.EXCLUSIVE}
			keymode={IS_DEV ? Astal.Keymode.ON_DEMAND : Astal.Keymode.EXCLUSIVE}
			application={app}
			namespace={`${CLASS}_launcher`}
			cssClasses={[styles.window]}
			layer={Astal.Layer.OVERLAY}
			// anchor={TOP | RIGHT}
			$={(self) => {
				self.connect("notify::visible", (window) => {
					if (window.is_visible()) {
						setQuery("");
						entry.grab_focus_without_selecting();
					} else {
						clearEntries();
					}
				});
			}}
		>
			<Gtk.EventControllerKey
				onKeyPressed={(_self, keyVal) => {
					if (keyVal == Gdk.KEY_Escape) {
						window.visible = false;
					}
				}}
			/>
			<box
				cssClasses={[styles.container]}
				orientation={Gtk.Orientation.VERTICAL}
			>
				{entry}
				<box>
					<box
						orientation={Gtk.Orientation.VERTICAL}
						widthRequest={400}
						hexpand
					>
						<Gtk.ScrolledWindow hexpand heightRequest={300}>
							<box
								orientation={Gtk.Orientation.VERTICAL}
								cssClasses={[styles.categories]}
							>
								<For each={sections}>
									{(section) =>
										section.entries.length ? (
											<box>
												<box
													orientation={Gtk.Orientation.VERTICAL}
													cssClasses={[styles.category]}
												>
													<box>
														<image
															iconName={section.handler.getIcon()}
															pixelSize={12}
															valign={Gtk.Align.CENTER}
														/>
														<label
															label={section.handler.getName()}
															halign={Gtk.Align.START}
															cssClasses={[styles.categoryName]}
															valign={Gtk.Align.CENTER}
														/>
													</box>

													<box orientation={Gtk.Orientation.VERTICAL}>
														{section.entries.map((entry) => (
															<button
																onClicked={() =>
																	section.handler.onEnter(entry.id, window)
																}
																cssClasses={[styles.categoryEntry]}
																hexpand
															>
																<Gtk.EventControllerFocus
																	onEnter={() => {
																		if (updateTimeout) {
																			clearTimeout(updateTimeout);
																		}
																		try {
																			const active = activeEntry.peek();
																			if (active) {
																				const [currentManager, currentEntry] =
																					active;
																				if (
																					currentManager == section.handler &&
																					currentEntry == entry
																				) {
																					return;
																				}
																			}
																			setActiveEntry([section.handler, entry]);
																		} catch (e) {
																			console.error(e);
																		}
																	}}
																/>
																<box>
																	{getValidIcon(entry.icon) && (
																		<image
																			iconName={entry.icon!}
																			pixelSize={24}
																		/>
																	)}
																	<label
																		label={entry.name}
																		halign={Gtk.Align.START}
																		maxWidthChars={50}
																		ellipsize={Pango.EllipsizeMode.MIDDLE}
																	/>
																</box>
															</button>
														))}
													</box>
												</box>
											</box>
										) : (
											<box />
										)
									}
								</For>
							</box>
						</Gtk.ScrolledWindow>
						<box cssClasses={[styles.loadingIcons]}>
							<For each={loadingHandlers}>
								{(handler) => (
									<image
										iconName={handler.getIcon()}
										cssClasses={[styles.loadingIcon]}
										pixelSize={20}
									/>
								)}
							</For>
						</box>
					</box>

					<Gtk.ScrolledWindow
						widthRequest={400}
						vexpand
						cssClasses={[styles.content]}
					>
						<box>
							<With value={activeEntry}>
								{(activeEntry) =>
									activeEntry ? (
										(() => {
											const [handler, entry] = activeEntry;
											try {
												return handler.getContent(entry.id, window);
											} catch (e) {
												return (
													<box>
														<label label="Something went wrong" />
													</box>
												);
											}
										})()
									) : (
										<box />
									)
								}
							</With>
						</box>
					</Gtk.ScrolledWindow>
				</box>
			</box>
		</window>
	) as Astal.Window;

	return window;
}
