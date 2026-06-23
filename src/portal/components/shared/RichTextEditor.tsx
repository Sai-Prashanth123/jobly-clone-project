import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2,
  Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, Code,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface TemplateVariable { token: string; label: string }

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variables?: TemplateVariable[];
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, placeholder, variables, minHeight = 160 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write here…' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none px-3 py-2 text-sm text-gray-800',
        style: `min-height:${minHeight}px`,
      },
    },
  });

  // Keep the editor in sync when the value is replaced externally (e.g. loading
  // a template into the composer). Guard against clobbering during typing.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="rounded-md border bg-gray-50" style={{ minHeight }} />;

  const Btn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className={`h-8 w-8 inline-flex items-center justify-center rounded hover:bg-gray-100 ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-600'}`}>
      {children}
    </button>
  );

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1.5 py-1">
        <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Btn>
        <Btn title="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Btn>
        <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Btn>
        <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <Btn title="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon className="h-4 w-4" /></Btn>
        <Btn title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="h-4 w-4" /></Btn>
        {variables && variables.length > 0 && (
          <div className="ml-auto">
            <Select value="" onValueChange={(token) => editor.chain().focus().insertContent(token).run()}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="+ Insert variable" /></SelectTrigger>
              <SelectContent>
                {variables.map(v => <SelectItem key={v.token} value={v.token}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
