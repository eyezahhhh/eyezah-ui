import { KillablePromise } from "./killable-promise.interface";

export type CommandPromise<T> = KillablePromise<T> & {
	writeSync: (stdin: string) => void;
};
