import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import html from "highlight.js/lib/languages/xml";
import { createLowlight } from "lowlight";

const lowlight = createLowlight();

lowlight.register({
  bash,
  css,
  html,
  javascript,
  json,
  markdown,
  php,
  plaintext,
  python,
  sql,
  typescript,
});

export { lowlight };
