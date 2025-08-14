# Texas Citizen Chatbot - Frontend Components

This folder contains all the React components for the Texas Citizen Chatbot interface.

## Components

### 🎈 **ChatButton.jsx**
- **Purpose**: Floating chat button that appears on all pages
- **Features**: 
  - Texas-themed design with forest green colors
  - Smooth animations and hover effects
  - Tooltip with helpful text
  - Accessible design with proper ARIA labels

### 💬 **TexasCitizenChatbot.jsx**
- **Purpose**: Main chatbot interface modal
- **Features**:
  - Real-time chat with streaming responses
  - WebSocket connection with HTTP fallback
  - Auto-scroll functionality
  - Typing indicators and loading states
  - Chat history persistence
  - Markdown support for rich responses
  - Mobile-responsive design

## Styling

### 🎨 **ChatButton.css**
- Floating button styles
- Pulse animations and hover effects
- Responsive breakpoints
- Accessibility and high contrast support

### 🎨 **TexasCitizenChatbot.css**
- Complete chat interface styling
- Texas forestry theme (green colors)
- Chat bubble styles for user and assistant
- Responsive layout for all screen sizes
- Dark mode support
- Smooth animations and transitions

## Usage

### Integration in App.js
```jsx
import ChatButton from './components/CitizenChatbot/ChatButton';

function App() {
  return (
    <div className="App">
      {/* Your other components */}
      <ChatButton />
    </div>
  );
}
```

### Direct Usage
```jsx
import TexasCitizenChatbot from './components/CitizenChatbot/TexasCitizenChatbot';

function MyComponent() {
  const [chatOpen, setChatOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setChatOpen(true)}>Open Chat</button>
      <TexasCitizenChatbot 
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)} 
      />
    </>
  );
}
```

## Environment Variables

The components expect these environment variables (configured in your .env file):

```env
REACT_APP_BASE_URL=http://localhost:8000
REACT_APP_WS_BASE_URL=ws://localhost:8000
```

## Dependencies

Required npm packages (already installed):
- `react-icons` - For icons (FaLeaf, FaPaperPlane, FaTimes)
- `react-markdown` - For rendering markdown in chat responses
- `remark-gfm` - GitHub Flavored Markdown support

## Features

### 🔄 **Communication Modes**
- **WebSocket**: Primary mode for real-time chat
- **HTTP Streaming**: Automatic fallback if WebSocket fails
- **Error Handling**: Graceful degradation and error messages

### 🎯 **User Experience**
- **Auto-scroll**: Automatically scrolls to new messages
- **Typing Indicators**: Shows when AI is thinking/typing
- **Message Streaming**: Real-time text streaming for natural feel
- **Chat History**: Persistent conversation across sessions
- **Mobile Optimized**: Works perfectly on all devices

### 🎨 **Texas Theme**
- **Forest Green Colors**: `#2d5016`, `#3e6b1f`, `#90c695`
- **Leaf Icon**: Represents Texas forestry focus
- **Nature-Inspired**: Green gradients and natural color palette
- **Professional**: Clean, modern design suitable for government use

## Customization

### Changing Colors
Edit the CSS variables in `TexasCitizenChatbot.css`:
```css
:root {
  --texas-primary: #2d5016;
  --texas-secondary: #3e6b1f;
  --texas-accent: #90c695;
}
```

### Modifying Behavior
Key props in `TexasCitizenChatbot.jsx`:
- `isOpen`: Controls modal visibility
- `onClose`: Callback when chat is closed
- Environment URLs for backend connection

### Adding Features
The components are modular and easy to extend:
- Add new chat features in `TexasCitizenChatbot.jsx`
- Modify button behavior in `ChatButton.jsx`
- Update styles in respective CSS files

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and roles
- **High Contrast**: Supports high contrast mode
- **Reduced Motion**: Respects user motion preferences

## Browser Support

- ✅ Chrome (Latest)
- ✅ Firefox (Latest)
- ✅ Safari (Latest)
- ✅ Edge (Latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Common Issues

1. **Chat button not appearing**
   - Check console for JavaScript errors
   - Verify ChatButton is imported in App.js

2. **WebSocket connection failed**
   - Falls back to HTTP automatically
   - Check backend server is running on port 8000

3. **Styling issues**
   - Ensure CSS files are imported correctly
   - Check for CSS conflicts with other components

4. **Missing icons**
   - Verify `react-icons` is installed
   - Check import statements for icon components 