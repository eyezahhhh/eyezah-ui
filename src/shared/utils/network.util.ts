import AstalNetwork from "gi://AstalNetwork?version=0.1";
import { createCommandProcess } from "./cli.util";
import { createState } from "gnim";
import { KillablePromise } from "@interface/killable-promise";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

const [connectingWifi, setConnectingWifi] =
	createState<AstalNetwork.AccessPoint | null>(null);
let connectingWifiController: (() => void) | null = null;

export async function connectToWifi(
	accessPoint: AstalNetwork.AccessPoint,
	onPasswordRequired?: (() => void) | string,
) {
	connectingWifiController?.();
	connectingWifiController = null;

	setConnectingWifi(accessPoint);

	const password =
		typeof onPasswordRequired == "string" ? onPasswordRequired : null;

	const args: string[] = ["nmcli", "dev", "wifi", "connect", accessPoint.bssid];
	if (password) {
		args.push("--ask");
	}

	return new Promise<void>((resolve, reject) => {
		const connectCommand = createCommandProcess(args, {
			onStdout: (stdout) => {
				if (stdout.startsWith("Passwords or encryption keys are required")) {
					if (password) {
						connectCommand.writeSync(password + "\n");
					}
				}
			},
		});

		connectingWifiController = () => connectCommand.kill();

		connectCommand
			.then(() => {
				resolve();
			})
			.catch((e) => {
				if (typeof e == "string") {
					if (e.startsWith("Warning: password for ")) {
						if (typeof onPasswordRequired == "function") {
							onPasswordRequired();
						}
						return reject(new Error("Password required"));
					}
				}
				reject(e);
			})
			.finally(() => {
				if (connectingWifi.get() == accessPoint) {
					setConnectingWifi(null);
				}
			});
	});
}

export function getConnectingWifiAccessor() {
	return connectingWifi;
}

const [rescanningWifi, setRescanningWifi] = createState<boolean>(false);

export function rescanWifi() {
	if (rescanningWifi.get()) {
		throw new Error("Wifi is already scanning");
	}
	setRescanningWifi(true);

	return new Promise<void>((resolve, reject) => {
		const command = createCommandProcess(["nmcli", "dev", "wifi", "rescan"]);

		command
			.then(() => resolve())
			.catch(reject)
			.finally(() => {
				setRescanningWifi(false);
			});
	});
}

export function getRescanningWifiAccessor() {
	return rescanningWifi;
}

// export function ping(
// 	address: string,
// 	options: {
// 		timeout: number;
// 		attempts?: number;
// 		interface?: string;
// 	},
// ) {
// 	const command = ["ping", "-q", "-W", "1", "-c", `${options.attempts || 1}`];
// 	if (options.interface) {
// 		command.push("-I", options.interface);
// 	}
// 	command.push(address);
// 	const child = createCommandProcess(["bash", "-c", command.join(" ")]);
// 	const promise: Partial<KillablePromise<number>> = new Promise(
// 		(resolve, reject) => {
// 			let finished = false;

// 			child
// 				.then((output) => {
// 					const match = output.match(/rtt.*=\s*[\d.]+\/([\d.]+)\//);
// 					const responseTime = match ? parseFloat(match[1]) : null;

// 					if (responseTime) {
// 						resolve(Math.round(responseTime));
// 					} else {
// 						console.error("UNSUCCESSFUL PING:", output);
// 						reject(new Error("Failed to ping"));
// 					}
// 				})
// 				.catch((error) => {
// 					if (!finished) {
// 						reject(error);
// 					}
// 				})
// 				.finally(() => {
// 					finished = true;
// 				});

// 			setTimeout(() => {
// 				if (!finished) {
// 					child.kill();
// 				}
// 			}, options.timeout);
// 		},
// 	);
// 	promise.kill = () => child.kill();

// 	return promise as KillablePromise<number>;
// }

export function ping(
	address: string,
	options: {
		timeout: number;
		attempts?: number;
		interface?: string;
	},
): KillablePromise<number> {
	let proc: Gio.Subprocess | null = null;
	let timeoutId: number | null = null;
	let isCancelled = false;

	// 1. Construct the command arguments
	// We strictly control the args to avoid shell injection and ensure proper flag usage
	const argv = ["ping", "-c", `${options.attempts || 1}`, "-W", "1"];

	// Add interface if provided (-I is standard for interface binding)
	if (options.interface) {
		argv.push("-I", options.interface);
	}

	argv.push(address);

	// 2. Wrap logic in the Promise executor
	const executor = (
		resolve: (value: number) => void,
		reject: (reason?: any) => void,
	) => {
		try {
			// Create the subprocess with pipes for stdout/stderr
			proc = new Gio.Subprocess({
				argv: argv,
				flags:
					Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
			});
			proc.init(null);

			// 3. Setup a safety timeout
			// If the command hangs or takes longer than options.timeout, we kill it.
			timeoutId = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				options.timeout,
				() => {
					if (!isCancelled && proc) {
						proc.force_exit();
						reject(new Error("Ping timed out"));
					}
					timeoutId = null;
					return GLib.SOURCE_REMOVE;
				},
			);

			// 4. Handle the output asynchronously
			proc.communicate_utf8_async(null, null, (source, result) => {
				// If the promise was already cancelled/killed, ignore the result
				if (isCancelled) return;

				// Clear timeout since we got a result
				if (timeoutId) {
					GLib.source_remove(timeoutId);
					timeoutId = null;
				}

				try {
					const [ok, stdout, stderr] = source!.communicate_utf8_finish(result);

					if (!ok) {
						reject(new Error("Subprocess communication failed"));
						return;
					}

					// 5. Dual-Fallback Parsing Strategy
					// Priority 1: Check for the summary line (most accurate for multiple attempts)
					// Matches: rtt min/avg/max/mdev = 12.3/13.5/14.0/0.2 ms
					const summaryMatch = stdout
						? stdout.match(/rtt.*=\s*[\d.]+\/([\d.]+)\//)
						: null;

					if (summaryMatch && summaryMatch[1]) {
						resolve(Math.round(parseFloat(summaryMatch[1])));
						return;
					}

					// Priority 2: Check for individual packet lines (Reliable if summary is missing)
					// Matches: 64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=14.2 ms
					const directMatch = stdout ? stdout.match(/time=([\d.]+)/) : null;

					if (directMatch && directMatch[1]) {
						resolve(Math.round(parseFloat(directMatch[1])));
						return;
					}

					// Failure case
					const errorMsg =
						stderr && stderr.trim().length > 0 ? stderr.trim() : stdout;
					console.error(`PING FAILED: ${errorMsg}`);
					reject(new Error(`Failed to ping ${address}`));
				} catch (e) {
					reject(e);
				}
			});
		} catch (e) {
			if (timeoutId) GLib.source_remove(timeoutId);
			reject(e);
		}
	};

	const promise = new Promise<number>(executor) as KillablePromise<number>;

	// 6. Attach the kill method
	promise.kill = () => {
		isCancelled = true;
		if (timeoutId) {
			GLib.source_remove(timeoutId);
			timeoutId = null;
		}
		if (proc) {
			proc.force_exit();
		}
	};

	return promise;
}
