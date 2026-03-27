import { Astal, Gtk } from "ags/gtk4";
import app from "ags/gtk4/app";
import styles from "./menu.window.style";
import { getActiveHandlerStateAccessor, MENU_HANDLERS } from "./menu.manager";
import { createComputed, createState, onCleanup, With } from "gnim";
import { MenuHandler } from "./handlers/menu-handler";
import { CLASS } from "constants/class.const";

export function MenuWindow() {
	const { TOP, LEFT, RIGHT } = Astal.WindowAnchor;

	const [handler, setHandler] = createState<MenuHandler | null>(null);
	const [anchor, setAnchor] = createState<Astal.WindowAnchor>(TOP);

	const stateAccessor = getActiveHandlerStateAccessor();
	const disconnect = stateAccessor.subscribe(() => {
		const handlerInfo = stateAccessor.peek();
		if (handlerInfo.handler) {
			for (let handler of MENU_HANDLERS) {
				if (handler instanceof handlerInfo.handler) {
					if (handlerInfo.side == "left") {
						setAnchor(TOP | LEFT);
					} else {
						setAnchor(TOP | RIGHT);
					}

					return setHandler(handler);
				}
			}
		}
		setHandler(null);
	});

	onCleanup(() => {
		disconnect();
	});

	const computedBind = createComputed(() => {
		const state = stateAccessor();
		const menuHandler = handler();
		let data: string | number | null = null;
		if (state.handler) {
			data = state.data;
		}

		return [menuHandler, data] as [MenuHandler | null, string | number | null];
	});

	const window = (
		<window
			anchor={anchor}
			application={app}
			marginTop={34}
			marginRight={10}
			marginLeft={10}
			cssClasses={[styles.window]}
			visible={handler.as((handler) => !!handler)}
			name="menu"
			namespace={`${CLASS}_menu`}
			class={CLASS}
			keymode={Astal.Keymode.ON_DEMAND}
			layer={Astal.Layer.OVERLAY}
		>
			<With value={computedBind}>
				{([handler, data]) => (
					<Gtk.ScrolledWindow
						cssClasses={[styles.scroll]}
						maxContentHeight={500}
						propagateNaturalHeight
						widthRequest={250}
						hscrollbarPolicy={Gtk.PolicyType.NEVER}
					>
						<box cssClasses={[styles.container]} valign={Gtk.Align.START}>
							{handler?.getContent(window, data)}
						</box>
					</Gtk.ScrolledWindow>
				)}
			</With>
		</window>
	);
}
