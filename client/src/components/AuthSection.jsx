import { useState } from 'react'
import { TEST_USERS } from '../utils/jwtUtils'

const AuthSection = ({ onLogin, isLoading, error }) => {
  const [jwtToken, setJwtToken] = useState('')
  const [selectedUser, setSelectedUser] = useState('')

  const handleLogin = (e) => {
    e.preventDefault()
    if (!jwtToken.trim()) {
      alert('Please enter a JWT token')
      return
    }
    onLogin(jwtToken.trim())
  }

  const handleTestUserSelect = (username) => {
    const user = TEST_USERS.find(u => u.username === username)
    if (user) {
      setJwtToken(user.token)
      setSelectedUser(username)
    }
  }

  const handleGenerateToken = () => {
    if (!selectedUser) {
      alert('Please select a test user first')
      return
    }
    const user = TEST_USERS.find(u => u.username === selectedUser)
    if (user) {
      setJwtToken(user.token)
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
            disabled={isLoading || !jwtToken.trim()}
          >
            {isLoading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div className="test-users-section">
          <h3>Test Users</h3>
          <p>Quick login with real server-generated tokens:</p>
          
          <div className="test-users-grid">
            {TEST_USERS.map(user => (
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
            Use Token for {selectedUser || 'Selected User'}
          </button>
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
