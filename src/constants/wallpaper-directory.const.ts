// @ts-nocheck

import { ROOT } from "./root.const";
import { WORKING_DIRECTORY } from "./working-directory.const";

export const WALLPAPER_DIRECTORY =
	typeof WALLPAPER_DIR == "string"
		? WALLPAPER_DIR
		: `${ROOT}/example-wallpapers`;
