import {
  HiWifi,
  HiExclamationTriangle,
  HiUsers,
  HiDocument,
  HiUser,
  HiCheckCircle,
  HiClock
} from 'react-icons/hi2'

const ConnectionStatus = ({
  connectionStatus,
  connectedUsers,
  user,
  error,
  documentId
}) => {
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <HiCheckCircle />
      case 'connecting': return <HiClock />
      case 'disconnected': return <HiExclamationTriangle />
      default: return <HiWifi />
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#34c759'
      case 'connecting': return '#ff9500'
      case 'disconnected': return '#ff3b30'
      default: return '#8e8e93'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'disconnected': return 'Disconnected'
      default: return 'Unknown'
    }
  }

  return (
    <div className="connection-status">
      <div className="status-header">
        <h3>
          <HiWifi className="section-icon" />
          Connection Status
        </h3>
        <div className="status-indicator">
          <span className="status-icon" style={{ color: getStatusColor() }}>
            {getStatusIcon()}
          </span>
          <span className="status-text">{getStatusText()}</span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="document-info">
        <h4>
          <HiDocument className="section-icon" />
          Document Information
        </h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Document:</span>
            <span className="info-value">{documentId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Your User:</span>
            <span className="info-value">{user?.username} (ID: {user?.id || user?.user_id})</span>
          </div>
          <div className="info-item">
            <span className="info-label">Permissions:</span>
            <span className="info-value">{user?.permissions?.join(', ') || 'read, write'}</span>
          </div>
        </div>
      </div>

      <div className="users-section">
        <h4>
          <HiUsers className="section-icon" />
          Connected Users ({connectedUsers.size + 1})
        </h4>
        
        <div className="user-list">
          {/* Current user */}
          <div className="user-item current-user">
            <div
              className="user-avatar current-user-avatar"
              style={{ backgroundColor: '#2563eb' }}
            >
              <HiUser className="avatar-icon" />
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username} (You)</span>
              <span className="user-status">
                <HiCheckCircle className="status-icon-small" />
                Online
              </span>
            </div>
          </div>

          {/* Other connected users */}
          {Array.from(connectedUsers.entries()).map(([clientId, userData]) => (
            <div key={clientId} className="user-item">
              <div
                className="user-avatar"
                style={{ backgroundColor: userData.color }}
              >
                <HiUser className="avatar-icon" />
              </div>
              <div className="user-info">
                <span className="user-name">{userData.name}</span>
                <span className="user-status">
                  <HiCheckCircle className="status-icon-small" />
                  Online
                </span>
              </div>
            </div>
          ))}
        </div>

        {connectedUsers.size === 0 && connectionStatus === 'connected' && (
          <p className="no-users">No other users connected. Share the link to collaborate!</p>
        )}
      </div>

      <div className="connection-details">
        <h4>Technical Details</h4>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">WebSocket:</span>
            <span className="detail-value" title={`ws://localhost:3000/${documentId}`}>
              ws://localhost:3000/{documentId}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Protocol:</span>
            <span className="detail-value">YJS + WebSocket</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Auth:</span>
            <span className="detail-value">JWT Token</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionStatus
