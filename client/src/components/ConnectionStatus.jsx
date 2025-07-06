const ConnectionStatus = ({
  connectionStatus, 
  connectedUsers, 
  user, 
  error,
  documentId 
}) => {
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return '●'
      case 'connecting': return '●'
      case 'disconnected': return '●'
      default: return '●'
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
        <h3>Connection Status</h3>
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
        <p><strong>Document:</strong> {documentId}</p>
        <p><strong>Your User:</strong> {user?.username} (ID: {user?.user_id})</p>
        <p><strong>Permissions:</strong> {user?.permissions?.join(', ')}</p>
      </div>

      <div className="users-section">
        <h4>Connected Users ({connectedUsers.size + 1})</h4>
        
        <div className="user-list">
          {/* Current user */}
          <div className="user-item current-user">
            <div 
              className="user-avatar" 
              style={{ backgroundColor: '#667eea' }}
            >
              {user?.username?.charAt(0)?.toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username} (You)</span>
              <span className="user-status">
                <span className="status-dot" style={{ color: '#34c759' }}>●</span>
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
                {userData.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-name">{userData.name}</span>
                <span className="user-status">
                  <span className="status-dot" style={{ color: '#34c759' }}>●</span>
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
