import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import Soup from "gi://Soup?version=3.0";
import { Response, URL } from "gnim/fetch";

interface FetchOptions {
	method?: string;
	headers?: HeadersInit;
	body?: BodyInit;
	cancellable?: Gio.Cancellable;
}

export async function fetch(
	url: string | URL,
	{ method, headers, body, cancellable }: FetchOptions = {},
) {
	const session = new Soup.Session();

	const message = new Soup.Message({
		method: method || "GET",
		uri: url instanceof URL ? url.uri : GLib.Uri.parse(url, GLib.UriFlags.NONE),
	});

	if (headers) {
		for (const [key, value] of Object.entries(headers))
			message.get_request_headers().append(key, String(value));
	}

	if (typeof body === "string") {
		message.set_request_body_from_bytes(
			null,
			new GLib.Bytes(new TextEncoder().encode(body)),
		);
	}

	const inputStream: Gio.InputStream = await new Promise((resolve, reject) => {
		session.send_async(message, 0, cancellable ?? null, (_, res) => {
			try {
				resolve(session.send_finish(res));
			} catch (error) {
				reject(error);
			}
		});
	});

	return new Response(inputStream, {
		statusText: message.reason_phrase,
		status: message.status_code,
	});
}
