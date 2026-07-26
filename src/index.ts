import type { HttpMiddleware } from "@lucid-softworks/http-middleware";

export type HttpCompressionEncoding = "gzip" | "deflate";
export type HttpCompressionOptions = Readonly<{
  encodings?: readonly HttpCompressionEncoding[];
  minimumBytes?: number;
}>;

export function acceptedCompression(
  header: string | null,
  encodings: readonly HttpCompressionEncoding[] = ["gzip", "deflate"],
): HttpCompressionEncoding | undefined {
  if (header === null) return undefined;
  const accepted = header.split(",").map((part) => {
    const [name = "", parameter] = part.trim().toLowerCase().split(";");
    const quality =
      parameter?.trim().startsWith("q=") === true
        ? Number(parameter.trim().slice(2))
        : 1;
    return { name, quality: Number.isFinite(quality) ? quality : 0 };
  });
  return encodings.find((encoding) =>
    accepted.some(
      (item) =>
        (item.name === encoding || item.name === "*") && item.quality > 0,
    ),
  );
}

export function compressHttpResponse(
  response: Response,
  encoding: HttpCompressionEncoding,
): Response {
  if (response.body === null) return response;
  const headers = new Headers(response.headers);
  headers.set("content-encoding", encoding);
  headers.delete("content-length");
  headers.append("vary", "Accept-Encoding");
  return new Response(
    response.body.pipeThrough(new CompressionStream(encoding)),
    {
      headers,
      status: response.status,
      statusText: response.statusText,
    },
  );
}

export function compression(
  options: HttpCompressionOptions = {},
): HttpMiddleware {
  const minimumBytes = options.minimumBytes ?? 1024;
  return async (request, _context, next): Promise<Response> => {
    const response = await next();
    if (
      request.method === "HEAD" ||
      response.body === null ||
      response.headers.has("content-encoding")
    ) {
      return response;
    }
    const length = Number(response.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(length) && length < minimumBytes) return response;
    const encoding = acceptedCompression(
      request.headers.get("accept-encoding"),
      options.encodings,
    );
    return encoding === undefined
      ? response
      : compressHttpResponse(response, encoding);
  };
}
