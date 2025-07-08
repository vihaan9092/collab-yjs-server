import { useYjsProvider } from '../hooks/useYjsProvider.jsx'
import { HiUser, HiArrowRightOnRectangle } from 'react-icons/hi2'
import TiptapEditor from './TiptapEditor'
import ConnectionStatus from './ConnectionStatus'

const EditorSection = ({ user, token, documentName, onLogout }) => {
  // Use the document name passed from App.jsx, fallback to default if not provided
  const documentId = documentName || 'tiptap-demo'
  
  const {
    provider,
    doc,
    connectionStatus,
    connectedUsers,
    error,
    isConnected
  } = useYjsProvider(documentId, token, user)

  return (
    <div className="editor-section">
      <div className="editor-header">
        <div className="header-left">
          <h2>Collaborative Editor</h2>
          <p>Document: <strong>{documentId}</strong></p>
        </div>
        <div className="header-right">
          <div className="user-info">
            <HiUser className="user-icon" />
            <span className="user-name">{user.username}{user.id ? ` (ID: ${user.id})` : ''}</span>
          </div>
          <button
            className="btn btn-secondary btn-small"
            onClick={onLogout}
          >
            <HiArrowRightOnRectangle className="logout-icon" />
            Logout
          </button>
        </div>
      </div>

      <div className="editor-layout">
        <div className="editor-main">
          {/* Only render editor when we have both doc and provider */}
          {doc && provider ? (
            <TiptapEditor
              doc={doc}
              provider={provider}
              user={user}
              isConnected={isConnected}
            />
          ) : (
            <div className="editor-container">
              <div className="editor-loading">
                <h3>Setting up collaboration...</h3>
                <p>Initializing YJS document and WebSocket provider...</p>
                <p><small>This should only take a moment.</small></p>
              </div>
            </div>
          )}
        </div>

        <div className="editor-sidebar">
          <ConnectionStatus
            connectionStatus={connectionStatus}
            connectedUsers={connectedUsers}
            user={user}
            error={error}
            documentId={documentId}
          />
        </div>
      </div>

      {error && (
        <div className="editor-error">
          <h4>Connection Error</h4>
          <p>{error}</p>
          <p>Please check your connection and try refreshing the page.</p>
        </div>
      )}
    </div>
  )
}

export default EditorSection
