import { Cue, Evaluator } from "./types";

let evaluator: Evaluator;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  evaluator = require("playwright-evaluator");
} catch (e) {
  // this will only error on server side tests that
  // do not require the evaluator but depend on this file
}

// -- copied from playwright to match their text engine --
function shouldSkipForTextMatching(element: Element | ShadowRoot): boolean {
  return (
    element.nodeName === "SCRIPT" ||
    element.nodeName === "STYLE" ||
    (document.head && document.head.contains(element))
  );
}

export function elementText(root: Element | ShadowRoot): string {
  let value = "";

  if (!shouldSkipForTextMatching(root)) {
    if (
      root instanceof HTMLInputElement &&
      (root.type === "submit" || root.type === "button")
    ) {
      value = root.value;
    } else {
      for (let child = root.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.ELEMENT_NODE)
          value += elementText(child as Element);
        else if (child.nodeType === Node.TEXT_NODE)
          value += child.nodeValue || "";

        // skip long text
        if (value.length > 100) break;
      }
      if ((root as Element).shadowRoot)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        value += elementText((root as Element).shadowRoot!);
    }
  }

  return value;
}
// --

export const buildSelectorForCues = (cues: Cue[]): string => {
  const levels = [...new Set(cues.map((cue) => cue.level))];

  // sort descending
  levels.sort((a, b) => b - a);

  const parts = [];

  let useMultipleEngines = false;

  levels.forEach((level) => {
    const cuesForLevel = cues.filter((cue) => cue.level === level);

    const textCues = cuesForLevel.filter((cue) => cue.type === "text");
    if (textCues.length === 1) {
      parts.push(`text=${textCues[0].value}`);
      useMultipleEngines = true;
      return;
    }

    cuesForLevel.sort((a, b) => {
      if (a.type === "tag") return -1;
      if (b.type === "tag") return 1;
      return 0;
    });

    const cssSelector = cuesForLevel
      .map((cue) =>
        cue.type === "text" ? `:has-text("${cue.value}")` : cue.value
      )
      .join("");
    parts.push(cssSelector);
  });

  return useMultipleEngines ? parts.join(" >> ") : parts.join(" ");
};

export const buildElementText = (element: HTMLElement): string => {
  const text = elementText(element).trim();
  return text.length > 100 ? "" : text;
};

export const evaluatorQuerySelector = (
  selector: string,
  root?: Node
): HTMLElement => {
  return evaluator.querySelector(selector, root || document);
};
