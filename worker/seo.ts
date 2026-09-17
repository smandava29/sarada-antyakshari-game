const SITE_ORIGIN = "https://saradaga-antyakshari.com";
const LOGO_URL = `${SITE_ORIGIN}/logo_large.png`;

interface SeoDocument {
  title: string;
  description: string;
  canonicalPath: string;
  fallbackHtml: string;
}

function archiveDocument(): SeoDocument {
  return {
    title: "Saradaga Antyakshari | Daily Telugu Song Antyakshari Game",
    description: "Explore previous Saradaga Antyakshari daily Telugu Antyakshari song guessing games.",
    canonicalPath: "/archive",
    fallbackHtml: `
      <main>
        <h1>Saradaga Antyakshari, Telugu Antyakshari Song Game Archive</h1>
        <p>Explore previous Saradaga Antyakshari daily Telugu song guessing games.</p>
        <p><a href="/">Play today’s Saradaga Antyakshari game</a></p>
      </main>`,
  };
}

export function seoDocument(pathname: string): SeoDocument {
  if (pathname === "/archive" || pathname === "/archive/") {
    return archiveDocument();
  }

  return {
    title: "Saradaga Antyakshari | Daily Telugu Song Guessing Antyakshari Game",
    description:
      "Play Saradaga Antyakshari, a daily telugu antakshari song guessing game. Listen to a short song clue, name the song, and solve today’s challenge in five chances.",
    canonicalPath: "/",
    fallbackHtml: `
      <main>
        <h1>Saradaga Antyakshari: Telugu Antakshari Song Game</h1>
        <p>Saradaga Antyakshari is a free daily Telugu song guessing game with a new song every day.</p>
        <h2>How to play</h2>
        <ol>
          <li>Listen to the short Telugu song clue.</li>
          <li>Guess the song title or skip to unlock a longer clue.</li>
          <li>Solve the daily Telugu music challenge in five chances.</li>
        </ol>
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
        alternateName: ["Telugu Antakshari", "Telugu Antyakshari Song Game", "Telugu Song Game", "Daily Telugu Song Guessing Game", "Saradaga Antakshari Game", "Saradaga Antyakshari Telugu Song Game"],
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
        keywords: "Antyakshari, Antakshari, Telugu Antakshari, Telugu Antyakshari, Telugu song game, daily song guessing game, Telugu music game, Saradaga Antyakshari, Saradaga Antyakshari game, Sarada Antyakshari, Sarada Antyakshari game, Saradaga Antyakshari Telugu song game, Saradaga Antyakshari daily game, Saradaga Antyakshari daily Telugu song guessing game",
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
