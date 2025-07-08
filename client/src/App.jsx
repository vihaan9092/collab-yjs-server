import { useState } from 'react'
import { useAuth } from './hooks/useAuth.jsx'
import AuthSection from './components/AuthSection'
import EditorSection from './components/EditorSection'

function App() {
  const [selectedDocument, setSelectedDocument] = useState('')

  const {
    isAuthenticated,
    isLoading,
    error,
    user,
    token,
    login,
    logout
  } = useAuth()

  const handleLogin = (token, documentName) => {
    setSelectedDocument(documentName)
    login(token)
  }

  if (isLoading) {
    return (
      <div className="app">
        <div className="container">
          <div className="main">
            <div className="status-card">
              <h2>Loading...</h2>
              <p>Checking authentication status...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="container">
    
          <main className="main">
            <AuthSection
              onLogin={handleLogin}
              isLoading={isLoading}
              error={error}
            />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="container">
        <main className="main">
          <EditorSection
            user={user}
            token={token}
            documentName={selectedDocument}
            onLogout={logout}
          />
        </main>
      </div>
    </div>
  )
}

export default App
