// deno-lint-ignore-file
import { createElement, renderToReadableStream } from "./deps.ts";
import {
  BUILD_ID,
  checkReferer,
  Component,
  Fastro,
  FunctionComponent,
  isPageComponent,
  PageComponent,
  RenderOptions,
} from "./server.ts";
import {
  clean,
  extractOriginalString,
  importCryptoKey,
  keyType,
  keyUsages,
  reverseString,
} from "../crypto/key.ts";
import { encryptData } from "../crypto/encrypt.ts";

function isJSX(res: JSX.Element) {
  return res && res.props != undefined && res.type != undefined;
}

export class Render {
  #options: RenderOptions;
  #element: Component;
  #nest: Record<string, any>;
  #development: boolean;
  #server: Fastro;
  #staticPath: string;
  #reqUrl?: string;

  constructor(
    element: Component,
    options: RenderOptions,
    nest: Record<string, any>,
    server: Fastro,
    request?: Request,
  ) {
    this.#options = this.#initOptions(options);
    this.#element = element;
    this.#nest = nest;
    this.#development = server.getDevelopmentStatus();
    this.#server = server;
    this.#staticPath = `${this.#server.getStaticPath()}/js`;
    this.#reqUrl = request?.url;
  }

  #initOptions = (opt: RenderOptions) => {
    opt.status = opt.status ?? 200;
    opt.pageFolder = opt.pageFolder ?? "pages";
    opt.cache = opt.cache ?? true;
    opt.development = opt.development ?? true;
    opt.html = opt.html ?? {};
    opt.html.head = opt.html.head ?? {
      meta: [],
      script: [],
      link: [],
    };

    const meta = [{ charset: "utf-8" }, {
      name: "viewport",
      content: "width=device-width, initial-scale=1.0",
    }];
    if (opt.html.head.descriptions) {
      meta.push({
        name: "description",
        content: opt.html.head.descriptions,
      });
    }
    opt.html.head.meta = opt.html.head.meta ?? meta;
    opt.html.head.script = opt.html.head.script ?? [];

    opt.html.body = opt.html.body ?? {
      script: [],
      root: {},
    };

    const options = { ...opt };
    return this.#options = options;
  };

  #createInitScript = async (props?: any) => {
    let exportedKeyString = this.#server.record["exportedKeyString"] as string;
    exportedKeyString = clean(exportedKeyString);
    exportedKeyString = reverseString(exportedKeyString);
    exportedKeyString = extractOriginalString(
      exportedKeyString,
      this.#server.record["salt"],
    ) as string;
    exportedKeyString = atob(exportedKeyString);
    const importedKey = await importCryptoKey(
      exportedKeyString,
      keyType,
      keyUsages,
    );

    const env = Deno.env.get("ENV") === undefined
      ? ""
      : `window.__ENV__ = "DEVELOPMENT";`;

    const plaintext = JSON.stringify(this.#options.props);
    const encryptedData = await encryptData(importedKey, plaintext);
    return `${env}window.__INITIAL_DATA__ = "${encryptedData}";`;
  };

  #initHtml = async (element: Component, html?: any) => {
    let el = isJSX(element as JSX.Element)
      ? element as JSX.Element
      : createElement(
        element as FunctionComponent,
        this.#options.props,
      );
    if (!html) return el;
    return (
      <html
        lang={this.#options.html?.lang}
        className={this.#options.html?.class}
        style={this.#options.html?.style}
      >
        <head>
          {this.#options.html?.head?.title && (
            <title>{this.#options.html?.head?.title}</title>
          )}
          {this.#options.html?.head?.meta &&
            this.#options.html?.head?.meta.map((m) => (
              <meta
                property={m.property}
                name={m.name}
                content={m.content}
                itemProp={m.itemprop}
                charSet={m.charset}
              />
            ))}
          {this.#options.html?.head?.link &&
            this.#options.html?.head?.link.map((l) => (
              <link
                href={l.href}
                integrity={l.integrity}
                rel={l.rel}
                as={l.as}
                onLoad={l.onload}
                media={l.media}
                crossOrigin={l.crossorigin}
              >
              </link>
            ))}

          {this.#options.html?.head?.noScriptLink &&
            (
              <noscript>
                <link
                  rel={this.#options.html?.head?.noScriptLink.rel}
                  href={this.#options.html?.head?.noScriptLink.href}
                >
                </link>
              </noscript>
            )}

          {this.#options.html?.head?.headStyle &&
            (
              <style>
                {this.#options.html?.head?.headStyle}
              </style>
            )}
          {this.#options.html?.head?.script &&
            this.#options.html?.head?.script.map((s) => (
              <script
                src={s.src}
                type={s.type}
                crossOrigin={s.crossorigin}
                nonce={s.nonce}
                integrity={s.integrity}
              />
            ))}

          {this.#options.html?.head?.headScript &&
            (
              <script>
                {this.#options.html?.head?.headScript}
              </script>
            )}
        </head>
        <body
          data-bs-theme={this.#options.html?.body?.theme ?? "dark"}
          className={this.#options.html?.body?.class}
          style={this.#options.html?.body?.style}
        >
          <div
            id="root"
            className={this.#options.html?.body?.root.class}
            style={this.#options.html?.body?.root.style}
            data-color-mode="auto"
            data-light-theme="light"
            data-dark-theme="dark"
          >
            {el}
          </div>
          {this.#options.html?.body?.script &&
            this.#options.html?.body?.script.map((s) => (
              <script
                src={s.src}
                type={s.type}
                crossOrigin={s.crossorigin}
                nonce={s.nonce}
              />
            ))}
        </body>
      </html>
    );
  };

  #refreshJs = (refreshUrl: string, buildId: string) => {
    return `const es = new EventSource('${refreshUrl}');
window.addEventListener("beforeunload", (event) => {
  es.close();
});
es.onmessage = function(e) {
  if (e.data !== "${buildId}") {
    location.reload();
  };
};`;
  };

  #createHTML = async (component: Component, cached?: boolean) => {
    let compID = "";
    this.#handleDevelopment();
    if (isJSX(component as JSX.Element)) {
      return this.#handleJSXElement(compID, component, cached);
    }

    const is = isPageComponent(component as PageComponent);
    const pc = component as PageComponent;
    const c = is ? pc.component : component as FunctionComponent;
    const e = is ? pc.component : this.#element;

    if (isJSX(c as JSX.Element)) {
      return this.#handleJSXElement(compID, c, cached);
    }
    const fc = c as FunctionComponent;
    compID = `${fc.name}${this.#reqUrl}`;
    if (cached && this.#nest[compID]) return this.#nest[compID];

    await this.#handleComponent(fc, this.#options.hydrate);
    this.#injectInitScript();
    const html = await this.#initHtml(e, this.#options.html);
    return this.#nest[compID] = html;
  };

  #handleJSXElement = async (
    compID: string,
    component: Component,
    cached?: boolean,
  ) => {
    compID = `default${this.#reqUrl}`;
    if (cached && this.#nest[compID]) return this.#nest[compID];
    let html = await this.#initHtml(component, this.#options.html);
    return this.#nest[compID] = html;
  };

  #handleComponent = async (c: FunctionComponent, hydrate = true) => {
    if (!this.#options.html?.body) return;
    if (hydrate) {
      this.#options.html?.body.script?.push({
        src: `${this.#staticPath}/${c.name.toLocaleLowerCase()}.js`,
      });
    }
  };

  #injectInitScript = () => {
    const initPath = `${this.#staticPath}/init.js`;
    this.#server.push(
      "GET",
      initPath,
      async (req: Request) => {
        const ref = checkReferer(req);
        if (ref) return ref;

        return new Response(await this.#createInitScript(this.#options.props), {
          headers: {
            "Content-Type": "application/javascript",
          },
        });
      },
    );

    if (this.#options.html?.body?.script) {
      this.#options.html?.body.script?.push({
        src: initPath,
      });
    }
  };

  #handleDevelopment = () => {
    if (!this.#development) return;
    const refreshPath = `${this.#staticPath}/refresh.js`;
    this.#server.push(
      "GET",
      refreshPath,
      () =>
        new Response(this.#refreshJs(`/___refresh___`, BUILD_ID), {
          headers: {
            "Content-Type": "application/javascript",
          },
        }),
    );

    if (this.#options.html?.head?.script) {
      this.#options.html?.head.script?.push({
        src: refreshPath,
      });
    }
  };

  render = async () => {
    const html = await this.#createHTML(
      this.#element,
      this.#options.cache,
    );

    const defaultOnError = (error: unknown) => {
      console.error(error);
    };

    const onError = this.#options.onError ?? defaultOnError;
    const signal = this.#options.abortController?.signal;
    const stream: ReadableStream = await renderToReadableStream(html, {
      signal,
      onError,
    });

    return new Response(
      stream,
      {
        status: this.#options.status,
        headers: {
          "content-type": "text/html",
        },
      },
    );
  };
}
