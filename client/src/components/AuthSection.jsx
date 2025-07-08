import { useState, useEffect } from 'react'
import { getTestUsers, generateTestToken } from '../utils/jwtUtils'

const AuthSection = ({ onLogin, isLoading, error }) => {
  const [jwtToken, setJwtToken] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [testUsers, setTestUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  // Load test users with dynamically generated tokens
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getTestUsers()
        setTestUsers(users)
      } catch (error) {
        console.error('Failed to generate test users:', error)
        // Fallback to basic user data without tokens
        setTestUsers([
          { username: 'user1', userId: 1, permissions: ['read', 'write'], token: '' },
          { username: 'user2', userId: 2, permissions: ['read', 'write'], token: '' },
          { username: 'user3', userId: 3, permissions: ['read', 'write'], token: '' },
          { username: 'admin', userId: 4, permissions: ['read', 'write', 'admin'], token: '' },
          { username: 'viewer', userId: 5, permissions: ['read'], token: '' }
        ])
      } finally {
        setLoadingUsers(false)
      }
    }
    loadUsers()
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    if (!jwtToken.trim()) {
      alert('Please enter a JWT token')
      return
    }
    if (!documentName.trim()) {
      alert('Please enter a document name')
      return
    }
    onLogin(jwtToken.trim(), documentName.trim())
  }

  const handleTestUserSelect = async (username) => {
    const user = testUsers.find(u => u.username === username)
    if (user && user.token) {
      setJwtToken(user.token)
      setSelectedUser(username)
    } else {
      // Generate token if not available
      const userData = testUsers.find(u => u.username === username)
      if (userData) {
        try {
          const token = await generateTestToken(userData.username, userData.userId, userData.permissions)
          setJwtToken(token)
          setSelectedUser(username)
        } catch (error) {
          console.error('Failed to generate token:', error)
          alert('Failed to generate token for this user')
        }
      }
    }
  }

  const handleGenerateToken = async () => {
    if (!selectedUser) {
      alert('Please select a test user first')
      return
    }
    const user = testUsers.find(u => u.username === selectedUser)
    if (user) {
      try {
        const token = await generateTestToken(user.username, user.userId, user.permissions)
        setJwtToken(token)
      } catch (error) {
        console.error('Failed to generate token:', error)
        alert('Failed to generate token')
      }
    }
  }

  return (
    <div className="auth-section">
      <div className="auth-card">
        <h2>Authentication</h2>
        <p>Enter your JWT token to access the collaborative editor</p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="documentName">Document Name:</label>
            <input
              id="documentName"
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name (e.g., my-document, project-notes)"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="jwtToken">JWT Token:</label>
            <textarea
              id="jwtToken"
              value={jwtToken}
              onChange={(e) => setJwtToken(e.target.value)}
              placeholder="Enter your JWT token here..."
              rows={4}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !jwtToken.trim() || !documentName.trim()}
          >
            {isLoading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div className="test-users-section">
          <h3>Test Users</h3>
          <p>Quick login with dynamically generated tokens:</p>

          {loadingUsers ? (
            <div className="loading-message">
              Generating secure tokens...
            </div>
          ) : (
            <>
              <div className="test-users-grid">
                {testUsers.map(user => (
                  <button
                    key={user.username}
                    className={`btn btn-test ${selectedUser === user.username ? 'selected' : ''}`}
                    onClick={() => handleTestUserSelect(user.username)}
                    disabled={isLoading}
                  >
                    {user.username}
                    <small>({user.permissions.join(', ')})</small>
                  </button>
                ))}
              </div>

              <button
                className="btn btn-secondary"
                onClick={handleGenerateToken}
                disabled={isLoading || !selectedUser}
              >
                Generate Fresh Token for {selectedUser || 'Selected User'}
              </button>
            </>
          )}
        </div>

        <div className="info-section">
          <h4>How to use:</h4>
          <ol>
            <li>Select a test user above, or</li>
            <li>Paste your own JWT token in the text area</li>
            <li>Click "Login" to authenticate</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default AuthSection
