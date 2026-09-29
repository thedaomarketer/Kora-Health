// Minimal local gateway: maps /auth/v1/* on :54321 to Supabase Auth on :9999,
// matching the URL layout supabase-js expects from a hosted project.
import http from "node:http";

const AUTH = { host: "127.0.0.1", port: 9999 };
const PORT = Number(process.env.GATEWAY_PORT ?? 54321);

http
  .createServer((req, res) => {
    if (!req.url?.startsWith("/auth/v1")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Only /auth/v1 is served by the local gateway" }));
      return;
    }
    const upstream = http.request(
      { ...AUTH, method: req.method, path: req.url.slice("/auth/v1".length) || "/", headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Local Supabase gateway on http://localhost:${PORT}`));
