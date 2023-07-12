import { denoPlugins, esbuild, esbuildWasmURL } from "./deps.ts";

export class Esbuild {
  #elementName: string;

  constructor(name: string) {
    this.#elementName = name;
  }

  #initEsbuild = async () => {
    // deno-lint-ignore no-deprecated-deno-api
    if (Deno.run === undefined) {
      await esbuild.initialize({
        wasmURL: esbuildWasmURL,
        worker: false,
      });
    }
  };

  build = async () => {
    await this.#initEsbuild();

    const cwd = Deno.cwd();
    const hydrateTarget =
      `${cwd}/hydrate/${this.#elementName.toLowerCase()}.hydrate.tsx`;

    const absWorkingDir = Deno.cwd();
    const esbuildRes = await esbuild.build({
      plugins: [...denoPlugins()],
      entryPoints: [hydrateTarget],
      format: "esm",
      jsxImportSource: "react",
      absWorkingDir,
      bundle: true,
      treeShaking: true,
      write: false,
      minify: true,
      minifySyntax: true,
      minifyWhitespace: true,
    });

    if (esbuildRes.errors.length > 0) {
      throw esbuildRes.errors;
    }

    esbuild.stop();
    return esbuildRes;
  };
}