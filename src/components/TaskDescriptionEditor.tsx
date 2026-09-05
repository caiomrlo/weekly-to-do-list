"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  RemoveFormatting,
} from "lucide-react";

interface TaskDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function TaskDescriptionEditor({
  value,
  onChange,
  placeholder,
}: TaskDescriptionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder:
          placeholder || "Adicione uma descrição detalhada, anotações ou listas...",
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[120px] max-h-[300px] overflow-y-auto px-4 py-3 text-sm text-slate-700 leading-relaxed select-text",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const html = activeEditor.isEmpty ? "" : activeEditor.getHTML();
      onChange(html);
    },
  });

  // Keep editor content in sync when value changes externally (e.g. task switch)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.isEmpty ? "" : editor.getHTML();
    if (value !== currentHtml) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="w-full h-36 rounded-2xl bg-white/80 border border-slate-200/80 animate-pulse flex items-center justify-center text-xs text-slate-400">
        Carregando editor...
      </div>
    );
  }

  const btnBase =
    "p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center";
  const btnActive = "bg-indigo-100/90 text-indigo-700 font-semibold shadow-2xs";
  const btnInactive = "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60";

  return (
    <div className="w-full rounded-2xl bg-white/80 border border-slate-200/80 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 overflow-hidden shadow-2xs">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2.5 py-1.5 border-b border-slate-200/60 bg-slate-50/70 text-xs">
        {/* Paragraph & Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`${btnBase} ${
            editor.isActive("paragraph") ? btnActive : btnInactive
          }`}
          title="Texto normal"
        >
          <Pilcrow className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`${btnBase} ${
            editor.isActive("heading", { level: 1 }) ? btnActive : btnInactive
          }`}
          title="Título Principal (H1)"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`${btnBase} ${
            editor.isActive("heading", { level: 2 }) ? btnActive : btnInactive
          }`}
          title="Subtítulo (H2)"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${btnBase} ${
            editor.isActive("heading", { level: 3 }) ? btnActive : btnInactive
          }`}
          title="Seção (H3)"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* Inline formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`${btnBase} ${
            editor.isActive("bold") ? btnActive : btnInactive
          }`}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`${btnBase} ${
            editor.isActive("italic") ? btnActive : btnInactive
          }`}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`${btnBase} ${
            editor.isActive("strike") ? btnActive : btnInactive
          }`}
          title="Tachado"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={`${btnBase} ${
            editor.isActive("code") ? btnActive : btnInactive
          }`}
          title="Código inline"
        >
          <Code className="w-3.5 h-3.5" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* Lists & Blocks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${btnBase} ${
            editor.isActive("bulletList") ? btnActive : btnInactive
          }`}
          title="Lista com marcadores"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${btnBase} ${
            editor.isActive("orderedList") ? btnActive : btnInactive
          }`}
          title="Lista numerada"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${btnBase} ${
            editor.isActive("blockquote") ? btnActive : btnInactive
          }`}
          title="Citação em bloco"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={`${btnBase} ${btnInactive}`}
          title="Linha divisória"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
          className={`${btnBase} ${btnInactive}`}
          title="Limpar formatação"
        >
          <RemoveFormatting className="w-3.5 h-3.5" />
        </button>

        {/* Undo / Redo */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className={`${btnBase} ${btnInactive} disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className={`${btnBase} ${btnInactive} disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Refazer (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
