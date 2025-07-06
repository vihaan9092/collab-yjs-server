import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'

// Generate consistent colors for users
const getUserColor = (username) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ]
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const TiptapEditor = ({ doc, provider, user, isConnected }) => {
  const [isEditorReady, setIsEditorReady] = useState(false)

  const editor = useEditor({
    extensions: doc && provider ? [
      StarterKit.configure({
        // Disable the default history extension since we're using collaboration
        history: false,
      }),
      Collaboration.configure({
        document: doc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: user?.username || 'Anonymous',
          color: getUserColor(user?.username || 'Anonymous'),
        },
      }),
    ] : [
      // Fallback extensions when doc/provider are not ready
      StarterKit.configure({
        history: false,
      }),
    ],
    content: '<p>Welcome to the collaborative editor! Start typing to begin...</p>',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        spellcheck: 'false',
      },
      handleDOMEvents: {
        focus: () => {
          // Editor focused - could add analytics here if needed
        },
        blur: () => {
          // Editor blurred - could add analytics here if needed
        },
      },
    },
    onUpdate: ({ editor }) => {
      // Content updated - could add auto-save logic here if needed
    },
    onCreate: ({ editor }) => {
      setIsEditorReady(true)
    },
    onDestroy: () => {
      setIsEditorReady(false)
    },
  }, [doc, provider, user])

  // Update editor when connection status changes
  useEffect(() => {
    if (editor && isConnected) {
      // Connection established, editor ready for collaboration
      // Could add connection status indicator here if needed
    }
  }, [editor, isConnected])

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy()
      }
    }
  }, [editor])

  // Show loading state while YJS is initializing
  if (!doc || !provider) {
    return (
      <div className="editor-container">
        <div className="editor-loading">
          <h3>Initializing Editor...</h3>
          <p>Setting up collaborative document...</p>
          <p><small>Document: {doc ? 'Ready' : 'Loading'} | Provider: {provider ? 'Ready' : 'Loading'}</small></p>
        </div>
      </div>
    )
  }

  // Show connecting state while WebSocket is connecting
  if (!isConnected) {
    return (
      <div className="editor-container">
        <div className="editor-loading">
          <h3>Connecting...</h3>
          <p>Establishing connection to collaboration server...</p>
          <p><small>WebSocket connecting...</small></p>
        </div>
      </div>
    )
  }

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        <div className="toolbar-section">
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`toolbar-btn ${editor?.isActive('bold') ? 'active' : ''}`}
            disabled={!editor}
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor?.isActive('italic') ? 'active' : ''}`}
            disabled={!editor}
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`toolbar-btn ${editor?.isActive('strike') ? 'active' : ''}`}
            disabled={!editor}
          >
            <s>S</s>
          </button>
        </div>

        <div className="toolbar-section">
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            disabled={!editor}
          >
            H1
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            disabled={!editor}
          >
            H2
          </button>
          <button
            onClick={() => editor?.chain().focus().setParagraph().run()}
            className={`toolbar-btn ${editor?.isActive('paragraph') ? 'active' : ''}`}
            disabled={!editor}
          >
            P
          </button>
        </div>

        <div className="toolbar-section">
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
            disabled={!editor}
          >
            • List
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
            disabled={!editor}
          >
            1. List
          </button>
        </div>

        <div className="toolbar-section">
          <button
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`toolbar-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
            disabled={!editor}
          >
            " Quote
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            className={`toolbar-btn ${editor?.isActive('codeBlock') ? 'active' : ''}`}
            disabled={!editor}
          >
            &lt;/&gt; Code
          </button>
        </div>
      </div>

      <div className="editor-content-wrapper">
        <EditorContent 
          editor={editor} 
          className="editor-content"
        />
      </div>

      <div className="editor-status">
        <span className="status-indicator">
          {isEditorReady ? '✅ Editor Ready' : '🔄 Loading...'}
        </span>
        <span className="connection-indicator">
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>
    </div>
  )
}

export default TiptapEditor
