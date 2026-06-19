type TVoiceAttachment = {
  url: string;
  name?: string;
  duration?: number;
  transcript?: string;
};

const decodeHTMLAttribute = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const getHTMLAttribute = (tag: string, attribute: string) => {
  const match = tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHTMLAttribute(match[1]) : undefined;
};

const escapeHTML = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseCommentHTML = (commentHTML: string | undefined) => {
  if (!commentHTML || typeof DOMParser === "undefined") return undefined;
  return new DOMParser().parseFromString(`<body>${commentHTML}</body>`, "text/html");
};

const normalizeTranscript = (value: string | null | undefined) =>
  (value ?? "").replace(/^\s*(Расшифровка|Transcript)\s*:?\s*/i, "").trim();

const getNodeTranscript = (node: Element, fallbackTranscript?: string) =>
  normalizeTranscript(
    node.getAttribute("data-plane-voice-transcript") ??
      node.querySelector("[data-plane-voice-transcript='true']")?.textContent ??
      fallbackTranscript
  );

const getFallbackTranscript = (document: Document) => {
  const parts: string[] = [];
  document.body.querySelectorAll("[data-plane-voice-transcript='true']").forEach((node) => {
    if (node.textContent) parts.push(node.textContent);
  });
  return normalizeTranscript(parts.join(" "));
};

export const extractVoiceAttachments = (commentHTML: string | undefined): TVoiceAttachment[] => {
  if (!commentHTML) return [];

  const document = parseCommentHTML(commentHTML);
  if (!document) {
    return Array.from(commentHTML.matchAll(/<a\b[^>]*data-plane-voice-attachment=["']true["'][^>]*>/gi)).reduce<
      TVoiceAttachment[]
    >((attachments, match) => {
      const url = getHTMLAttribute(match[0], "href") ?? "";
      if (!url) return attachments;
      attachments.push({
        url,
        name: getHTMLAttribute(match[0], "data-plane-voice-name"),
      });
      return attachments;
    }, []);
  }

  const fallbackTranscript = getFallbackTranscript(document);
  const attachments: TVoiceAttachment[] = [];

  document.body.querySelectorAll("[data-plane-voice-message='true']").forEach((node) => {
    const link = node.querySelector<HTMLAnchorElement>("a[data-plane-voice-attachment='true']");
    const url = link?.getAttribute("href") ?? "";
    if (!url) return;

    attachments.push({
      url,
      name: node.getAttribute("data-plane-voice-name") ?? link?.getAttribute("data-plane-voice-name") ?? undefined,
      duration: Number(node.getAttribute("data-plane-voice-duration")) || undefined,
      transcript: getNodeTranscript(node, fallbackTranscript) || undefined,
    });
  });

  document.body.querySelectorAll<HTMLAnchorElement>("a[data-plane-voice-attachment='true']").forEach((link) => {
    if (link.closest("[data-plane-voice-message='true']")) return;

    const url = link.getAttribute("href") ?? "";
    if (!url) return;

    attachments.push({
      url,
      name: link.getAttribute("data-plane-voice-name") ?? undefined,
      transcript: fallbackTranscript || undefined,
    });
  });

  return attachments;
};

export const stripVoiceContentFromHTML = (commentHTML: string | undefined) => {
  if (!commentHTML) return "<p></p>";

  const document = parseCommentHTML(commentHTML);
  if (!document) return commentHTML;

  document.body.querySelectorAll("[data-plane-voice-message='true']").forEach((node) => node.remove());
  document.body.querySelectorAll("[data-plane-voice-transcript='true']").forEach((node) => node.remove());
  document.body.querySelectorAll<HTMLAnchorElement>("a[data-plane-voice-attachment='true']").forEach((link) => {
    const parentParagraph = link.closest("p");
    if (parentParagraph && parentParagraph.textContent?.trim() === link.textContent?.trim()) {
      parentParagraph.remove();
      return;
    }
    link.remove();
  });

  return document.body.innerHTML || "<p></p>";
};

export const appendVoiceTranscriptToCommentHTML = (
  commentHTML: string | undefined,
  transcript: string,
  attachment: TVoiceAttachment
) => {
  const transcriptHTML = `<p data-plane-voice-transcript="true"><strong>Расшифровка:</strong> ${escapeHTML(
    transcript
  )}</p>`;
  if (!commentHTML) return transcriptHTML;

  const document = parseCommentHTML(commentHTML);
  if (!document) {
    if (commentHTML.includes(escapeHTML(transcript))) return commentHTML;
    return `${commentHTML}${transcriptHTML}`;
  }

  const hasTranscript =
    Array.from(document.body.querySelectorAll("[data-plane-voice-message='true']")).some(
      (node) => getNodeTranscript(node) === transcript
    ) ||
    Array.from(document.body.querySelectorAll("[data-plane-voice-transcript='true']")).some(
      (node) => normalizeTranscript(node.textContent) === transcript
    );
  if (hasTranscript) return document.body.innerHTML;

  const matchingVoiceMessage = Array.from(document.body.querySelectorAll("[data-plane-voice-message='true']")).find(
    (node) =>
      node.querySelector<HTMLAnchorElement>("a[data-plane-voice-attachment='true']")?.getAttribute("href") ===
      attachment.url
  );

  if (matchingVoiceMessage) {
    matchingVoiceMessage.setAttribute("data-plane-voice-transcript", transcript);
    return document.body.innerHTML;
  }

  return `${document.body.innerHTML}${transcriptHTML}`;
};

export type { TVoiceAttachment };
