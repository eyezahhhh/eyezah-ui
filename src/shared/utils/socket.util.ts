import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { Emitter } from "./emitter.util";

type UnixSocketEvents = {
	open: [void];
	close: [void];
	error: [Error];
	data: [string];
};

export class UnixSocket extends Emitter<UnixSocketEvents> {
	private readonly _path: string;
	private _closed = false;
	private _connection: Gio.SocketConnection | null = null;
	private _manuallyClosed = false;

	constructor(path: string) {
		super();
		this._path = path;

		const client = new Gio.SocketClient();
		const address = new Gio.UnixSocketAddress({ path });

		client.connect_async(address, null, (_client, result) => {
			try {
				const connection = client.connect_finish(result);
				this.emit("open");
				console.log(`Connected to "${path}"`);

				const inputStream = connection.get_input_stream();
				const dataStream = new Gio.DataInputStream({
					base_stream: inputStream,
					close_base_stream: true,
				});

				this.readLoop(dataStream);
			} catch (e) {
				this.emit("error", e as Error);
			}
		});

		this.addEventListener("close", () => (this._closed = true));
	}

	getSocketPath() {
		return this._path;
	}

	isClosed() {
		return this._closed;
	}

	private readLoop(dataStream: Gio.DataInputStream) {
		dataStream.read_line_async(
			GLib.PRIORITY_DEFAULT,
			null,
			(_stream, result) => {
				try {
					const [line] = dataStream.read_line_finish_utf8(result);

					if (line !== null) {
						this.emit("data", line);
						this.readLoop(dataStream);
					} else if (!this._manuallyClosed) {
						this.emit("close");
					}
				} catch (e) {
					if (!this._manuallyClosed) {
						this.emit("error", e as Error);
						this.emit("close");
					}
				}
			},
		);
	}

	close() {
		if (this._connection && !this._manuallyClosed) {
			this._manuallyClosed = true;

			try {
				this._connection.close(null);
			} catch (e) {
				console.warn("Error while closing socket:", e);
			}

			this._connection = null;
			this.emit("close");
		}
	}
}
