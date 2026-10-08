import { mergeAttributes } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";

import type { BodyEditor } from "@/components/note-body-editor";
import { lowlight } from "@/lib/lowlight";

export type CodeBlockLanguage = {
  label: string;
  value: string;
};

export const CODE_BLOCK_LANGUAGES: CodeBlockLanguage[] = [
  { label: "کد ساده", value: "plaintext" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "PHP", value: "php" },
  { label: "Python", value: "python" },
  { label: "JSON", value: "json" },
  { label: "Bash", value: "bash" },
  { label: "SQL", value: "sql" },
  { label: "Markdown", value: "markdown" },
];

export const CodeBlock = CodeBlockLowlight.extend({
  renderHTML({ node, HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        dir: "ltr",
      }),
      [
        "code",
        {
          class: node.attrs.language
            ? `${this.options.languageClassPrefix}${node.attrs.language}`
            : null,
        },
        0,
      ],
    ];
  },
}).configure({ lowlight, defaultLanguage: "plaintext" });

export function activeCodeBlockLanguage(editor: BodyEditor): string | null {
  if (!editor.isActive("codeBlock")) return null;
  const language = editor.getAttributes("codeBlock").language;
  return typeof language === "string" ? language : null;
}

export function setCodeBlockLanguage(
  editor: BodyEditor,
  language: string,
): void {
  const chain = editor.chain().focus();

  if (editor.isActive("codeBlock")) {
    chain.updateAttributes("codeBlock", { language }).run();
  } else {
    chain.setCodeBlock({ language }).run();
  }
}
