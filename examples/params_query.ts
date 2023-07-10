import fastro, { HttpRequest } from "../mod.ts";

const f = new fastro();

f.get("/:user", (req: HttpRequest) => {
  const data = { user: req.params?.user, name: req.query?.name };
  return Response.json(data);
});

await f.serve();