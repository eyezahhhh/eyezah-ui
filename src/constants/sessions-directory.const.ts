// @ts-nocheck
// SESSIONS_DIR is injected by AGS
import { WORKING_DIRECTORY } from "./working-directory.const";

export const SESSIONS_DIRECTORY =
	typeof SESSIONS_DIR == "string"
		? SESSIONS_DIR
		: `${WORKING_DIRECTORY}/example-desktop-sessions`;
