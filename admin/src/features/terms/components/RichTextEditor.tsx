"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ListOrdered } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Select } from "@/components/ui/Input";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { cn } from "@/lib/cn";

const icon = (name: string) => <MaskIcon src={`/images/icons/${name}.svg`} size={16} />;

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, stats: { words: number; characters: number }) => void;
  disabled?: boolean;
  /** Changing this key resets the editor content (e.g. after a restore). */
  resetKey: string | number;
  label: string;
  /** Figma "Editor footer" content (word count, last saved). */
  footer?: ReactNode;
}

const statsOf = (editor: Editor) => {
  const text = editor.getText().trim();
  return { words: text ? text.split(/\s+/).length : 0, characters: text.length };
};

function ToolbarButton({
  label,
  active,
  onClick,
  children,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg transition-colors disabled:text-[#8e8589] disabled:opacity-60 [&>svg]:size-4 [&>svg]:stroke-[1.33]",
        active ? "bg-[#fce7f0] text-[#e2136e]" : "text-muted hover:text-ink hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

/** Small inline popover for adding / editing / removing a link. */
function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = () => {
    const href = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!href) chain.unsetLink().run();
    else
      chain
        .setLink({ href: /^(https?:|mailto:|tel:)/i.test(href) ? href : `https://${href}` })
        .run();
    setOpen(false);
  };

  return (
    <div className="relative">
      <ToolbarButton
        label="Link"
        active={active}
        onClick={() => {
          setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {icon("rt-link")}
      </ToolbarButton>
      {open && (
        <div className="border-line shadow-card absolute top-full left-0 z-20 mt-1 flex w-72 gap-2 rounded-xl border bg-white p-2">
          <input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="https://… (empty removes the link)"
            aria-label="Link URL"
            className="bg-field min-w-0 flex-1 rounded-lg px-2.5 text-xs outline-none"
          />
          <button
            type="button"
            onClick={apply}
            className="bg-brand-500 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

/** TipTap editor with the toolbar from the design. Output is sanitised again by the API. */
export function RichTextEditor({
  value,
  onChange,
  disabled,
  resetKey,
  label,
  footer,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["mailto", "tel"] },
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false, // SSR-safe in Next.js
    editorProps: {
      attributes: {
        class: "terms-editor min-h-[260px] p-5 text-sm outline-none",
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), statsOf(e)),
    onCreate: ({ editor: e }) => onChange(e.getHTML(), statsOf(e)),
  });

  // Replace the document when the source version changes (load / restore).
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(value, { emitUpdate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on resetKey changes
  }, [resetKey, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            link: e.isActive("link"),
            block: e.isActive("heading", { level: 2 })
              ? "h2"
              : e.isActive("heading", { level: 3 })
                ? "h3"
                : "p",
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  return (
    // Figma "Rich text editor" (240:599): 12px radius, 48px grey toolbar, 20px text
    // padding, 44px grey footer.
    <div className="border-line overflow-clip rounded-xl border bg-white transition-[border-color,box-shadow] focus-within:border-[#e2136e] focus-within:shadow-[0_0_0_3px_#fce7f0]">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="border-line bg-canvas flex min-h-12 flex-wrap items-center gap-1.5 border-b px-3 py-2"
      >
        {editor && state && (
          <>
            <label className="block">
              <span className="sr-only">Text style</span>
              <Select
                value={state.block}
                disabled={disabled}
                onChange={(e) => {
                  const chain = editor.chain().focus();
                  if (e.target.value === "p") chain.setParagraph().run();
                  else chain.setHeading({ level: e.target.value === "h2" ? 2 : 3 }).run();
                }}
                boxClassName="border-line text-muted h-8 w-[132px] gap-2 rounded-lg bg-white px-3 text-xs font-semibold focus-within:shadow-none"
              >
                <option value="p">Paragraph</option>
                <option value="h2">Heading</option>
                <option value="h3">Subheading</option>
              </Select>
            </label>
            <span className="bg-line h-5 w-px" aria-hidden />
            <ToolbarButton
              label="Bold"
              active={state.bold}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              {icon("rt-bold")}
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={state.italic}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              {icon("rt-italic")}
            </ToolbarButton>
            <ToolbarButton
              label="Underline"
              active={state.underline}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              {icon("rt-underline")}
            </ToolbarButton>
            <span className="bg-line h-5 w-px" aria-hidden />
            <ToolbarButton
              label="Bulleted list"
              active={state.bullet}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              {icon("rt-list")}
            </ToolbarButton>
            <ToolbarButton
              label="Numbered list"
              active={state.ordered}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered />
            </ToolbarButton>
            <LinkControl editor={editor} active={state.link} />
            <span className="bg-line h-5 w-px" aria-hidden />
            <ToolbarButton
              label="Undo"
              disabled={disabled || !state.canUndo}
              onClick={() => editor.chain().focus().undo().run()}
            >
              {icon("rt-undo")}
            </ToolbarButton>
            <ToolbarButton
              label="Redo"
              disabled={disabled || !state.canRedo}
              onClick={() => editor.chain().focus().redo().run()}
            >
              {icon("rt-redo")}
            </ToolbarButton>
          </>
        )}
      </div>
      <EditorContent editor={editor} />
      {footer && (
        <div className="border-line bg-canvas text-subtle flex min-h-11 flex-wrap items-center justify-between gap-2 border-t px-5 py-2 text-xs leading-[normal] font-medium">
          {footer}
        </div>
      )}
    </div>
  );
}
