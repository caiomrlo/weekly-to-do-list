"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link2,
  Unlink,
  Check,
  X,
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
          placeholder || "Add a detailed description, notes or lists...",
      }),
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[120px] max-h-[300px] overflow-y-auto px-4 py-3 text-sm text-slate-700 dark:text-slate-200 leading-relaxed select-text",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const html = activeEditor.isEmpty ? "" : activeEditor.getHTML();
      onChange(html);
    },
  });

  // Sync content when value changes externally (e.g. task switch)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.isEmpty ? "" : editor.getHTML();
    if (value !== currentHtml) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [savedSelection, setSavedSelection] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLinkOpen) {
      requestAnimationFrame(() => {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      });
    }
  }, [isLinkOpen]);

  if (!editor) {
    return (
      <div className="w-full h-36 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
        Loading editor...
      </div>
    );
  }

  const btnBase =
    "p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center";
  const btnActive = "bg-amber-100/90 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold shadow-2xs";
  const btnInactive = "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60";

  const handleToggleLink = () => {
    if (!editor) return;
    if (isLinkOpen) {
      handleCloseLink();
      return;
    }
    const currentHref = editor.getAttributes("link").href || "";
    setLinkUrl(currentHref);
    setSavedSelection({
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    });
    setIsLinkOpen(true);
  };

  const handleApplyLink = () => {
    if (!editor) return;
    const trimmed = linkUrl.trim();

    let chain = editor.chain().focus();
    if (savedSelection) {
      chain = chain.setTextSelection(savedSelection);
    }

    if (trimmed === "") {
      chain.extendMarkRange("link").unsetLink().run();
    } else {
      const { from, to } = savedSelection || editor.state.selection;
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

      if (from === to && !editor.isActive("link")) {
        chain.insertContent(`<a href="${href}">${trimmed}</a> `).run();
      } else {
        chain.extendMarkRange("link").setLink({ href }).run();
      }
    }

    setIsLinkOpen(false);
  };

  const handleUnlink = () => {
    if (!editor) return;
    let chain = editor.chain().focus();
    if (savedSelection) {
      chain = chain.setTextSelection(savedSelection);
    }
    chain.extendMarkRange("link").unsetLink().run();
    setIsLinkOpen(false);
  };

  const handleCloseLink = () => {
    setIsLinkOpen(false);
    if (savedSelection) {
      editor?.chain().focus().setTextSelection(savedSelection).run();
    } else {
      editor?.chain().focus().run();
    }
  };

  return (
    <div className="w-full rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 transition-all focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 overflow-hidden shadow-2xs">
      <div className="flex flex-wrap items-center gap-0.5 px-2.5 py-1.5 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/70 dark:bg-slate-800/50 text-xs">
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`${btnBase} ${
            editor.isActive("paragraph") ? btnActive : btnInactive
          }`}
          title="Normal text"
        >
          <Pilcrow className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`${btnBase} ${
            editor.isActive("heading", { level: 1 }) ? btnActive : btnInactive
          }`}
          title="Main Heading (H1)"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`${btnBase} ${
            editor.isActive("heading", { level: 2 }) ? btnActive : btnInactive
          }`}
          title="Subheading (H2)"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${btnBase} ${
            editor.isActive("heading", { level: 3 }) ? btnActive : btnInactive
          }`}
          title="Section (H3)"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`${btnBase} ${
            editor.isActive("bold") ? btnActive : btnInactive
          }`}
          title="Bold (Ctrl+B)"
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
          title="Italic (Ctrl+I)"
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
          title="Strikethrough"
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
          title="Inline code"
        >
          <Code className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleToggleLink}
          className={`${btnBase} ${
            editor.isActive("link") || isLinkOpen ? btnActive : btnInactive
          }`}
          title={editor.isActive("link") ? "Edit link" : "Add link"}
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${btnBase} ${
            editor.isActive("bulletList") ? btnActive : btnInactive
          }`}
          title="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${btnBase} ${
            editor.isActive("orderedList") ? btnActive : btnInactive
          }`}
          title="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${btnBase} ${
            editor.isActive("blockquote") ? btnActive : btnInactive
          }`}
          title="Blockquote"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={`${btnBase} ${btnInactive}`}
          title="Horizontal line"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
          className={`${btnBase} ${btnInactive}`}
          title="Clear formatting"
        >
          <RemoveFormatting className="w-3.5 h-3.5" />
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className={`${btnBase} ${btnInactive} disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className={`${btnBase} ${btnInactive} disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Link Toolbar Bar */}
      {isLinkOpen && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/60 dark:bg-slate-800/80 border-b border-slate-200/60 dark:border-slate-800/80 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative flex-1 flex items-center">
            <Link2 className="w-3.5 h-3.5 absolute left-2.5 text-amber-500 shrink-0 pointer-events-none" />
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyLink();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCloseLink();
                }
              }}
              placeholder="Enter URL (e.g. https://example.com)..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleApplyLink}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
            title="Apply link (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Apply</span>
          </button>

          {editor.isActive("link") && (
            <button
              type="button"
              onClick={handleUnlink}
              className="px-2 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/60 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              title="Remove link"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Remove</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCloseLink}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
