export type KillablePromise<T> = Promise<T> & {
	kill: () => void;
};
