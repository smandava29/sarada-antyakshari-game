const SITE_ORIGIN = "https://saradaga-antyakshari.com";
const LOGO_URL = `${SITE_ORIGIN}/logo_large.png`;

interface SeoDocument {
  title: string;
  description: string;
  canonicalPath: string;
  fallbackHtml: string;
}

function archiveDocument(pathname: string): SeoDocument {
  const dateMatch = pathname.match(/^\/archive\/(\d{4}-\d{2}-\d{2})\/?$/u);
  const date = dateMatch?.[1];
  const suffix = date ? `: ${date}` : "";

  return {
    title: `Saradaga Antyakshari Archive${suffix} | Telugu Song Guessing Game`,
    description: date
      ? `Play the Saradaga Antyakshari Telugu song guessing game archive for ${date}.`
      : "Explore previous Saradaga Antyakshari daily Telugu song guessing games.",
    canonicalPath: date ? `/archive/${date}` : "/archive",
    fallbackHtml: `
      <main>
        <h1>Saradaga Antyakshari Archive${suffix}</h1>
        <p>Explore previous daily Telugu song guessing games.</p>
        <p><a href="/">Play today’s Saradaga Antyakshari game</a></p>
      </main>`,
  };
}

export function seoDocument(pathname: string): SeoDocument {
  if (pathname === "/archive" || pathname.startsWith("/archive/")) {
    return archiveDocument(pathname);
  }

  return {
    title: "Saradaga Antyakshari | Daily Telugu Song Guessing Game",
    description:
      "Play Saradaga Antyakshari, a daily Telugu song guessing game. Listen to a short song clue, search the title, and solve today’s challenge in five chances.",
    canonicalPath: "/",
    fallbackHtml: `
      <main>
        <h1>Saradaga Antyakshari: Daily Telugu Song Guessing Game</h1>
        <p>A Telugu song guessing game with a new song every day.</p>
        <p><a href="/archive">Explore previous games in the archive</a></p>
      </main>`,
  };
}

function schema(document: SeoDocument): string {
  const url = `${SITE_ORIGIN}${document.canonicalPath}`;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Saradaga Antyakshari",
        url: SITE_ORIGIN,
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        name: "Saradaga Antyakshari",
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        url,
        description: document.description,
        inLanguage: "en",
      },
    ],
  });
}

class SeoHandler {
  constructor(private readonly document: SeoDocument) {}

  text(element: Element): void {
    element.setInnerContent(this.document.title);
  }

  titleMeta(element: Element): void {
    element.setAttribute("content", this.document.title);
  }

  description(element: Element): void {
    element.setAttribute("content", this.document.description);
  }

  canonical(element: Element): void {
    element.setAttribute("href", `${SITE_ORIGIN}${this.document.canonicalPath}`);
  }

  url(element: Element): void {
    element.setAttribute("content", `${SITE_ORIGIN}${this.document.canonicalPath}`);
  }

  image(element: Element): void {
    element.setAttribute("content", LOGO_URL);
  }

  structuredData(element: Element): void {
    element.setInnerContent(schema(this.document));
  }

  fallback(element: Element): void {
    element.setInnerContent(this.document.fallbackHtml, { html: true });
  }
}

export function rewriteSeoDocument(response: Response, pathname: string): Response {
  const document = seoDocument(pathname);
  const handler = new SeoHandler(document);

  return new HTMLRewriter()
    .on("title", { element: (element) => handler.text(element) })
    .on('meta[name="description"]', { element: (element) => handler.description(element) })
    .on('meta[property="og:description"]', { element: (element) => handler.description(element) })
    .on('meta[name="twitter:description"]', { element: (element) => handler.description(element) })
    .on('meta[property="og:title"]', { element: (element) => handler.titleMeta(element) })
    .on('meta[name="twitter:title"]', { element: (element) => handler.titleMeta(element) })
    .on('link[rel="canonical"]', { element: (element) => handler.canonical(element) })
    .on('meta[property="og:url"]', { element: (element) => handler.url(element) })
    .on('meta[property="og:image"]', { element: (element) => handler.image(element) })
    .on('meta[name="twitter:image"]', { element: (element) => handler.image(element) })
    .on("script#structured-data", { element: (element) => handler.structuredData(element) })
    .on("noscript#seo-fallback", { element: (element) => handler.fallback(element) })
    .transform(response);
}
