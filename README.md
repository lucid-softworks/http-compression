# `@lucid-softworks/http-compression`

`gzip` and `deflate` response compression using `CompressionStream`.

```ts
import { compression } from "@lucid-softworks/http-compression";

const middleware = compression({ minimumBytes: 1024 });
```

HEAD, empty, already encoded, small, and non-negotiated responses pass
through. Compressed responses remove `Content-Length` and vary on
`Accept-Encoding`.
