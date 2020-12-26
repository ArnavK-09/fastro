import { Fastro } from "../mod.ts";
import { assertEquals } from "../deps.ts";

const { test } = Deno;
const port = 3000;
const base = `http://localhost:${port}`;

Deno.env.set("DENO_ENV", "test");

test({
  name: "BASIC GET",
  async fn() {
    const server = new Fastro({ port });
    const result = await fetch(`${base}/hello`);
    const text = await result.text();
    assertEquals(text, "setup complete");
    server.close();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
