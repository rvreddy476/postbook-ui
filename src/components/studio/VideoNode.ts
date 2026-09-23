import { Node, mergeAttributes } from '@tiptap/core';

/**
 * A video block for the composer's editor.
 *
 * TipTap ships an Image extension but no video one, and the founder asked for
 * both inside the Journal editor. This is the smallest node that does the job:
 * one block, one `src`, rendered as a controlled <video>.
 *
 * It is only the EDITING side. What the feed shows is rebuilt by
 * RichTextRenderer from the stored document through its whitelist, which
 * validates the src again there — a node type reaching the editor is not the
 * same as a node type being safe to render for other people.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        preload: 'metadata',
        class: 'max-w-full rounded-xl',
      }),
    ];
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});

export default Video;
