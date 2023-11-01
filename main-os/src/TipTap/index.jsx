import "./styles.scss";

import CharacterCount from "@tiptap/extension-character-count";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Highlight from "@tiptap/extension-highlight";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { useEffect, useState } from "react";
import MenuBar from "./MenuBar.jsx";

export default ({ changeFocus, name, color, ydoc, ablyProvider, uid }) => {


  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Highlight,
      TaskList,
      TaskItem,
      CharacterCount.configure({
        limit: 10000,
      }),
      Collaboration.configure({
        fragment: ydoc.getXmlFragment(`${uid}_tiptap`),
      }),
      CollaborationCursor.configure({
        provider: ablyProvider,
        user: {
          name,
          color,
        },
      }),
    ],
  });

  const [isFocus, setFocus] = useState(false);

  useEffect(() => {
    const editorContainer = document.getElementById(`${uid}_editor`);
    let tiptapContainer_ = null;
    let onBlurTo = null;
    const handleBlur = () => {
      if (onBlurTo) {
        clearTimeout(onBlurTo);
      }
      onBlurTo = setTimeout(() => {
        setFocus(false);
        changeFocus(false);
      }, 1000);
    };
    const handleFocus = (event) => {
      if (onBlurTo) {
        clearTimeout(onBlurTo);
      }
      const tiptapContainer = editorContainer.querySelector(".tiptap");
      if (tiptapContainer) {
        setFocus(true);
        changeFocus(true);
        tiptapContainer.focus();
      }
      if (!tiptapContainer_) {
        tiptapContainer_ = tiptapContainer;
        tiptapContainer_.addEventListener("blur", handleBlur);
      }
    };
    if (editorContainer) {
      editorContainer.addEventListener("click", handleFocus);
    }
    return () => {
      if (editorContainer) {
        editorContainer.removeEventListener("click", handleFocus);
      }
      if (tiptapContainer_) {
        tiptapContainer_.removeEventListener("blur", handleBlur);
      }
    };
  }, []);

  return (
    <div id={`${uid}_editor`} className="editor ">
      {isFocus && editor && <MenuBar editor={editor} />}
      <EditorContent className="editor__content" editor={editor} />
    </div>
  );
};
