import { DOCKER_VERSION, FASTRO_VERSION } from "../core/types.ts";

export const docker = `FROM hayd/alpine-deno:${DOCKER_VERSION}
WORKDIR /app
USER deno
COPY . ./
RUN deno cache https://raw.fastro.dev/v${FASTRO_VERSION}/mod.ts
RUN deno cache https://raw.fastro.dev/v${FASTRO_VERSION}/deps.ts
RUN deno cache main.ts
CMD ["run", "-A", "main.ts"]
`;
