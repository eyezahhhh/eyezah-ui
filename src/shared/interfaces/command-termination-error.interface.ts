export class CommandTerminationError extends Error {
	constructor() {
		super("Process was terminated");
	}
}
