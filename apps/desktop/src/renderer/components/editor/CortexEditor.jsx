import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';

const lowlight = createLowlight(all);

export default function CortexEditor({ initialContent, onChange }) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false, // use lowlight instead
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Placeholder.configure({
                placeholder: 'Type / for commands, or start writing...',
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-slate-400 dark:before:text-dark-500 before:float-left before:h-0 before:pointer-events-none',
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Image,
            CodeBlockLowlight.configure({
                lowlight,
            }),
        ],
        content: initialContent || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base dark:prose-invert prose-synapse focus:outline-none max-w-none min-h-[500px]',
            },
        },
        onUpdate: ({ editor }) => {
            const json = editor.getJSON();
            onChange?.(json);
        },
    });

    useEffect(() => {
        if (editor && initialContent) {
            // Only set content if editor is empty to avoid overwriting changes,
            // or we could do a more sophisticated sync.
            if (editor.isEmpty && typeof initialContent === 'object' && Object.keys(initialContent).length > 0) {
                 editor.commands.setContent(initialContent);
            }
        }
    }, [editor, initialContent]);

    if (!editor) {
        return null;
    }

    return (
        <div className="cortex-editor-container w-full h-full p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-[900px] mx-auto relative">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
