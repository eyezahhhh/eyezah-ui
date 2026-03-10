import { CommandPromise } from "@interface/command-promise";
import { CommandTerminationError } from "@interface/command-termination-error";
import { exec, execAsync, subprocess } from "ags/process";
import GLib from "gi://GLib?version=2.0";

export function createCommandProcess(
	args: string[],
	options: {
		onStdout?: (stdout: string) => void;
		onStderr?: (stderr: string) => void;
	} = {},
): CommandPromise<string> {
	let fullStdout = "";
	let fullStderr = "";

	const child = subprocess(
		args,
		(stdout) => {
			options.onStdout?.(stdout);
			fullStdout += stdout + "\n";
		},
		(stderr) => {
			options.onStderr?.(stderr);
			fullStderr += stderr + "\n";
		},
	);

	const promise = new Promise<string>((resolve, reject) => {
		child.connect("exit", (_, code, terminated) => {
			if (terminated) {
				return reject(new CommandTerminationError());
			}
			if (code === 0) {
				return resolve(fullStdout.substring(0, fullStdout.length - 1));
			}
			reject(fullStderr.substring(0, fullStderr.length - 1));
		});
	}) as CommandPromise<string>;

	promise.kill = () => child.kill();
	promise.writeSync = (stdin: string) => child.write(stdin);
	return promise;
}

export function doesCommandExistSync(...command: string[]) {
	try {
		exec(command);
		return true;
	} catch (e) {
		if (e instanceof GLib.SpawnError) {
			if (e.code === GLib.SpawnError.NOENT) {
				return false;
			}
			throw e;
		}
		return true;
	}
}

export async function doesCommandExist(...command: string[]) {
	try {
		await execAsync(command);
		return true;
	} catch (e) {
		if (e instanceof GLib.SpawnError) {
			if (e.code === GLib.SpawnError.NOENT) {
				return false;
			}
			throw e;
		}
		return true;
	}
}
