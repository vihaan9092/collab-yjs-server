# 🎨 Tiptap Collaborative Editor Client

A modern React-based collaborative rich text editor client built with **Tiptap**, **Y.js**, and **Vite**. This client provides a beautiful, responsive interface for real-time collaborative document editing with optimized performance.

## ✨ Features

### 🔥 Rich Text Editing
- **Full-featured Editor**: Bold, italic, underline, strikethrough formatting
- **Headings**: H1-H6 support with keyboard shortcuts
- **Lists**: Bullet and numbered lists with nesting
- **Text Alignment**: Left, center, right, justify alignment
- **Colors**: Text color and background highlighting
- **Links**: Insert and edit hyperlinks
- **Code**: Inline code formatting and code blocks
- **Blockquotes**: Quote formatting
- **Superscript/Subscript**: Mathematical notation support

### ⚡ Real-time Collaboration
- **Live Cursors**: See other users' cursor positions in real-time
- **User Presence**: Visual indicators of active collaborators
- **Conflict Resolution**: Automatic conflict resolution using Y.js CRDT
- **Optimized Performance**: Benefits from server-side debouncing (80% fewer WebSocket messages)
- **Instant Sync**: Changes appear immediately across all connected clients

### 🎯 User Experience
- **Markdown Shortcuts**: Type `# ` for headings, `- ` for lists, etc.
- **Keyboard Navigation**: Full keyboard accessibility
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Theme**: Automatic theme detection
- **Performance Optimized**: Efficient rendering and minimal re-renders

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (recommended: 22.7.0)
- npm or yarn package manager
- Running collaborative server (see main README.md)

### Installation & Development

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Access the Editor

Open your browser and navigate to:
- **Development**: http://localhost:5173
- **Production**: Served through main server at http://localhost:3000

## 🏗️ Architecture

### Component Structure
```
src/
├── components/
│   ├── Editor/
│   │   ├── TiptapEditor.jsx      # Main editor component
│   │   ├── Toolbar.jsx           # Formatting toolbar
│   │   ├── UserCursors.jsx       # Real-time user cursors
│   │   └── StatusBar.jsx         # Connection status
│   ├── Auth/
│   │   └── AuthHandler.jsx       # JWT authentication
│   └── Layout/
│       └── AppLayout.jsx         # Main application layout
├── hooks/
│   ├── useCollaboration.js       # Y.js collaboration hook
│   ├── useWebSocket.js           # WebSocket connection management
│   └── useAuth.js                # Authentication management
├── utils/
│   ├── yjsProvider.js            # Y.js WebSocket provider setup
│   ├── authUtils.js              # JWT token handling
│   └── editorConfig.js           # Tiptap editor configuration
└── styles/
    ├── editor.css                # Editor-specific styles
    └── global.css                # Global application styles
```

### Technology Stack
- **React 18**: Modern React with hooks and concurrent features
- **Vite**: Fast build tool and development server
- **Tiptap**: Headless rich text editor framework
- **Y.js**: Conflict-free replicated data types for collaboration
- **WebSocket**: Real-time communication with optimized debouncing
- **CSS Modules**: Scoped styling with modern CSS features

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the client directory:

```env
# Server Configuration
VITE_SERVER_URL=ws://localhost:3000
VITE_API_URL=http://localhost:3000

# Authentication
VITE_AUTH_ENABLED=true

# Development
VITE_DEBUG_MODE=false
```

### Editor Configuration

The editor can be customized through `src/utils/editorConfig.js`:

```javascript
export const editorConfig = {
  // Collaboration settings
  collaboration: {
    document: 'default-document',
    user: {
      name: 'Anonymous',
      color: '#ff6b6b'
    }
  },
  
  // Editor features
  features: {
    toolbar: true,
    statusBar: true,
    userCursors: true,
    autoSave: true
  },
  
  // Performance settings
  performance: {
    debounceDelay: 300,        // Matches server debouncing
    renderDelay: 16,           // 60fps rendering
    maxHistorySize: 100
  }
};
```

## 🎨 Customization

### Styling

The client uses CSS modules for component-specific styling:

```css
/* src/styles/editor.css */
.editor {
  min-height: 400px;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 16px;
}

.toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid #e1e5e9;
}

.userCursor {
  position: absolute;
  pointer-events: none;
  transition: all 0.1s ease;
}
```

### Adding Custom Extensions

```javascript
// src/utils/editorConfig.js
import { Extension } from '@tiptap/core';

const CustomExtension = Extension.create({
  name: 'customExtension',
  // Extension implementation
});

export const extensions = [
  // Default extensions
  StarterKit,
  Collaboration.configure({
    document: ydoc,
  }),
  // Add custom extension
  CustomExtension,
];
```

## 🔌 Integration

### Authentication Integration

The client automatically handles JWT authentication:

```javascript
// URL parameters for authentication
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const userId = urlParams.get('user');

// Automatic WebSocket connection with auth
const provider = new WebsocketProvider(
  'ws://localhost:3000',
  documentId,
  ydoc,
  {
    params: { token, user: userId }
  }
);
```

### Django Integration

From your Django application:

```python
# views.py
def collaborative_editor(request):
    token = generate_jwt_token(request.user)
    editor_url = f"http://localhost:3000/?token={token}&user={request.user.username}"
    return redirect(editor_url)
```

## 📊 Performance Features

### Optimized for Server Debouncing

The client is optimized to work with the server's debouncing system:

- **Efficient Updates**: Batched document updates reduce network traffic
- **Smart Rendering**: Only re-renders changed content
- **Memory Management**: Automatic cleanup of old document states
- **Connection Resilience**: Automatic reconnection with exponential backoff

### Performance Monitoring

```javascript
// Built-in performance monitoring
const performanceMetrics = {
  renderTime: 0,
  updateFrequency: 0,
  memoryUsage: 0,
  connectionLatency: 0
};

// Access via browser console
window.editorMetrics = performanceMetrics;
```

## 🐛 Troubleshooting

### Common Issues

1. **Editor Not Loading**
   - Check if the server is running on the correct port
   - Verify WebSocket connection in browser dev tools
   - Check authentication token validity

2. **Collaboration Not Working**
   - Ensure multiple users are using the same document ID
   - Check WebSocket connection status
   - Verify server debouncing is not causing delays

3. **Performance Issues**
   - Check browser console for errors
   - Monitor network tab for excessive WebSocket messages
   - Verify server debouncing is active (should see ~10 messages/keystroke)

### Debug Mode

Enable debug mode for detailed logging:

```env
VITE_DEBUG_MODE=true
```

```javascript
// Check collaboration status
console.log('Y.js document state:', ydoc.toJSON());
console.log('WebSocket status:', provider.wsconnected);
console.log('Connected users:', awareness.getStates());
```

## 🚀 Production Deployment

### Build for Production

```bash
# Build optimized bundle
npm run build

# Preview production build locally
npm run preview
```

### Deployment Options

1. **Static Hosting** (Netlify, Vercel, GitHub Pages)
2. **CDN Distribution** (CloudFlare, AWS CloudFront)
3. **Server Integration** (Serve through main Express server)

### Performance Optimization

- **Code Splitting**: Automatic with Vite
- **Tree Shaking**: Removes unused code
- **Asset Optimization**: Images and fonts optimized
- **Gzip Compression**: Enabled by default
- **Browser Caching**: Configured for optimal performance

## 📚 API Reference

### Main Components

#### TiptapEditor
```javascript
<TiptapEditor
  documentId="my-document"
  userId="user-123"
  token="jwt-token"
  onReady={() => console.log('Editor ready')}
  onError={(error) => console.error('Editor error:', error)}
/>
```

#### Collaboration Hook
```javascript
const { ydoc, provider, awareness } = useCollaboration({
  documentId: 'my-document',
  serverUrl: 'ws://localhost:3000',
  token: 'jwt-token'
});
```

---

**Built with ❤️ using React, Tiptap, Y.js, and modern web technologies**
