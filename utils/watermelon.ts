const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUuid() {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}

	const bytes = new Uint8Array(16);

	if (typeof globalThis.crypto?.getRandomValues === "function") {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

	return [
		hex.slice(0, 4).join(""),
		hex.slice(4, 6).join(""),
		hex.slice(6, 8).join(""),
		hex.slice(8, 10).join(""),
		hex.slice(10, 16).join(""),
	].join("-");
}

export function isUuid(value: string) {
	return UUID_REGEX.test(value);
}

export function setRawIdentity(
	record: { _raw: Record<string, string | number | null> },
	input: { id: string; createdAt: number; updatedAt: number },
) {
	record._raw.id = input.id;
	record._raw.created_at = input.createdAt;
	record._raw.updated_at = input.updatedAt;
}

