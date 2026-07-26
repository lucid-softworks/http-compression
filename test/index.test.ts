import { collectByteStream } from "@lucid-softworks/http-body-stream";
import { createHttpContext } from "@lucid-softworks/http-core";
import { describe, expect, it } from "vitest";

import {
  acceptedCompression,
  compressHttpResponse,
  compression,
} from "../src/index.js";

const compressionRequest = (method = "GET", encoding?: string): Request =>
  new Request("https://example.com", {
    ...(encoding === undefined
      ? {}
      : { headers: { "accept-encoding": encoding } }),
    method,
  });

describe("HTTP compression", () => {
  it("negotiates supported encodings and quality values", () => {
    expect(acceptedCompression(null)).toBeUndefined();
    expect(acceptedCompression("br, gzip;q=0.5")).toBe("gzip");
    expect(acceptedCompression("*;q=1", ["deflate"])).toBe("deflate");
    expect(acceptedCompression("gzip;q=0")).toBeUndefined();
    expect(acceptedCompression("gzip;q=no")).toBeUndefined();
  });

  it("compresses response streams and updates metadata", async () => {
    const response = compressHttpResponse(
      new Response("hello hello hello", {
        headers: { "content-length": "17" },
        status: 201,
        statusText: "Made",
      }),
      "gzip",
    );
    expect(response.status).toBe(201);
    expect(response.statusText).toBe("Made");
    expect(response.headers.get("content-encoding")).toBe("gzip");
    expect(response.headers.has("content-length")).toBe(false);
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
    expect((await collectByteStream(response.body)).byteLength).toBeGreaterThan(
      0,
    );

    const empty = new Response(null, { status: 204 });
    expect(compressHttpResponse(empty, "gzip")).toBe(empty);
  });

  it("compresses eligible middleware responses and skips ineligible ones", async () => {
    const context = createHttpContext();
    const run = (
      input: Request,
      response: Response,
      minimumBytes = 1,
    ): Promise<Response> =>
      Promise.resolve(
        compression({ minimumBytes })(input, context, async () => response),
      );

    expect(
      (
        await run(compressionRequest("GET", "gzip"), new Response("hello"))
      ).headers.get("content-encoding"),
    ).toBe("gzip");
    expect(
      await run(compressionRequest("HEAD", "gzip"), new Response(null)),
    ).toBeInstanceOf(Response);
    const already = new Response("x", {
      headers: { "content-encoding": "br" },
    });
    expect(await run(compressionRequest("GET", "gzip"), already)).toBe(already);
    const short = new Response("x", { headers: { "content-length": "1" } });
    expect(await run(compressionRequest("GET", "gzip"), short, 2)).toBe(short);
    const noAccept = new Response("long");
    expect(await run(compressionRequest(), noAccept)).toBe(noAccept);
    const defaultMinimum = new Response("default");
    expect(
      await Promise.resolve(
        compression()(
          compressionRequest(),
          context,
          async () => defaultMinimum,
        ),
      ),
    ).toBe(defaultMinimum);
  });
});
