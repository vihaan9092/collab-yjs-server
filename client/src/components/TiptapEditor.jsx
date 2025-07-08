import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
// import { Extension } from '@tiptap/core'
// import { textInputRule } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import {
  HiBold,
  HiItalic,
  HiStrikethrough,
  HiListBullet,
  HiNumberedList,
  HiChatBubbleLeft,
  HiCodeBracketSquare,
  HiCheckCircle,
  HiArrowPath,
  HiSignal,
  HiSignalSlash,
  HiLockClosed
} from 'react-icons/hi2'

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

// // Text Transform Extension - Intercepts and transforms text before CRDT operations
// const TextTransformExtension = Extension.create({
//   name: 'textTransform',

//   addInputRules() {
//     return [
//       // Auto-correct common typos
//       textInputRule({
//         find: /\bteh\s$/,
//         replace: 'the ',
//       }),

//       // Convert double dashes to em dash
//       textInputRule({
//         find: /--$/,
//         replace: '—',
//       }),

//       // Auto-capitalize common words after periods (simple approach)
//       textInputRule({
//         find: /\.\s+the$/,
//         replace: '. The',
//       }),

//       textInputRule({
//         find: /\.\s+this$/,
//         replace: '. This',
//       }),

//       textInputRule({
//         find: /\.\s+that$/,
//         replace: '. That',
//       }),

//       textInputRule({
//         find: /\.\s+it$/,
//         replace: '. It',
//       }),

//       // Convert (c) to copyright symbol
//       textInputRule({
//         find: /\(c\)$/i,
//         replace: '©',
//       }),

//       // Convert (tm) to trademark symbol
//       textInputRule({
//         find: /\(tm\)$/i,
//         replace: '™',
//       }),

//       // Convert fractions
//       textInputRule({
//         find: /1\/2$/,
//         replace: '½',
//       }),

//       textInputRule({
//         find: /1\/4$/,
//         replace: '¼',
//       }),

//       textInputRule({
//         find: /3\/4$/,
//         replace: '¾',
//       }),
//     ]
//   },
// })

const TiptapEditor = ({ doc, provider, user, isConnected }) => {
  const [isEditorReady, setIsEditorReady] = useState(false)

  // Check if user has write permissions
  const hasWritePermission = user?.permissions?.includes('write') ||
                            user?.permissions?.includes('edit') ||
                            user?.permissions?.includes('*') ||
                            user?.permissions?.includes('admin')

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
      // // Add text transformation extension
      // TextTransformExtension,
    ] : [
      // Fallback extensions when doc/provider are not ready
      StarterKit.configure({
        history: false,
      }),
      // // Add text transformation extension even without collaboration
      // TextTransformExtension,
    ],
    content: '<p>Welcome to the collaborative editor! Start typing to begin...</p>',
    editable: hasWritePermission, // Make editor read-only if user doesn't have write permissions
    editorProps: {
      attributes: {
        class: `tiptap-editor ${!hasWritePermission ? 'read-only' : ''}`,
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
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Bold'}
          >
            <HiBold />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor?.isActive('italic') ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Italic'}
          >
            <HiItalic />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`toolbar-btn ${editor?.isActive('strike') ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Strikethrough'}
          >
            <HiStrikethrough />
          </button>
        </div>

        <div className="toolbar-section">
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Heading 1'}
          >
            H1
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Heading 2'}
          >
            H2
          </button>
          <button
            onClick={() => editor?.chain().focus().setParagraph().run()}
            className={`toolbar-btn ${editor?.isActive('paragraph') ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Paragraph'}
          >
            P
          </button>
        </div>

        <div className="toolbar-section">
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Bullet List'}
          >
            <HiListBullet />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Numbered List'}
          >
            <HiNumberedList />
          </button>
        </div>

        <div className="toolbar-section">
          <button
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`toolbar-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Quote'}
          >
            <HiChatBubbleLeft />
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            className={`toolbar-btn ${editor?.isActive('codeBlock') ? 'active' : ''}`}
            disabled={!editor || !hasWritePermission}
            title={!hasWritePermission ? 'Read-only mode' : 'Code Block'}
          >
            <HiCodeBracketSquare />
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
          {isEditorReady ? (
            <>
              <HiCheckCircle style={{ color: '#10b981' }} />
              Editor Ready
            </>
          ) : (
            <>
              <HiArrowPath style={{ color: '#f59e0b' }} />
              Loading...
            </>
          )}
        </span>
        <span className="connection-indicator">
          {isConnected ? (
            <>
              <HiSignal style={{ color: '#10b981' }} />
              Connected
            </>
          ) : (
            <>
              <HiSignalSlash style={{ color: '#ef4444' }} />
              Disconnected
            </>
          )}
        </span>
        {!hasWritePermission && (
          <span className="permission-indicator" style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
            <HiLockClosed style={{ marginRight: '4px' }} />
            Read-Only Mode
          </span>
        )}
      </div>
    </div>
  )
}

export default TiptapEditor
