import { MenuHandler } from "main/menu/handlers/menu-handler";

export type IMenuHandlerState =
	| {
			handler: typeof MenuHandler;
			data: string | number | null;
	  }
	| {
			handler: null;
	  };
