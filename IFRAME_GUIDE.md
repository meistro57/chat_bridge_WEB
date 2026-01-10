# Chat Bridge iFrame Integration Guide

## Overview

Chat Bridge Studio has been enhanced for seamless embedding in iFrame environments, making it perfect for integration into websites like **quantummindsunited.com**. This guide covers all the new features and how to use them.

## 🎯 Key Features

### 1. **Real-time Metrics & Info Tags**
Every message now displays enlightening metrics:
- 🔢 **Token Count**: Estimated tokens per message
- ⏱️ **Response Time**: How long each agent took to respond
- 🤖 **Model Used**: Which AI model generated the response
- 💰 **Cost Estimation**: Approximate API cost based on token usage

### 2. **Aggregate Session Metrics Panel**
A beautiful metrics dashboard showing:
- Total message count
- Total tokens used across the conversation
- Average response time
- Estimated total cost

### 3. **iFrame Detection & Auto-configuration**
- Automatically detects when running inside an iFrame
- Enables special iFrame-optimized features
- Notifies parent window when ready

### 4. **Compact Mode**
Perfect for embedded views:
- Hides configuration panel
- Hides LLM test bench
- Hides provider status
- Streamlined UI focused on conversation
- Toggle button appears automatically when embedded

### 5. **PostMessage API**
Two-way communication between parent page and Chat Bridge:

#### **From Chat Bridge → Parent:**
```javascript
// When Chat Bridge is ready
{ type: 'chatBridgeReady' }

// Metrics updates (sent automatically)
{
  type: 'metricsUpdate',
  data: {
    totalTokens: 1234,
    avgResponseTime: 2.5,
    messageCount: 10,
    conversationStatus: 'running'
  }
}
```

#### **From Parent → Chat Bridge:**
```javascript
// Toggle compact mode
iframe.contentWindow.postMessage({
  type: 'setCompactMode',
  value: true  // or false
}, '*');
```

## 📦 Quick Start

### Basic Embedding

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Site with Chat Bridge</title>
</head>
<body>
  <h1>Welcome to Quantum Minds United</h1>

  <iframe
    id="chatBridge"
    src="http://your-chat-bridge-url:5173"
    width="100%"
    height="800px"
    style="border: none; border-radius: 12px;"
    allow="clipboard-write"
  ></iframe>

  <script>
    // Listen for metrics
    window.addEventListener('message', (event) => {
      if (event.data.type === 'metricsUpdate') {
        console.log('Metrics:', event.data.data);
      }
    });
  </script>
</body>
</html>
```

### Advanced Integration

See `iframe-demo.html` for a complete example with:
- Real-time metrics display
- Compact mode toggle
- Status indicators
- Beautiful responsive design
- Security considerations

## 🎨 Styling for Your Brand

### Custom Container Styling
```css
.chat-bridge-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  height: 800px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
```

### Responsive Embedding
```css
@media (max-width: 768px) {
  .chat-bridge-container {
    height: 600px;
  }
}
```

## 🔐 Security Considerations

### Origin Validation
Always validate the origin of postMessage events:

```javascript
window.addEventListener('message', (event) => {
  // Whitelist your Chat Bridge domain
  const allowedOrigins = [
    'http://localhost:5173',
    'https://your-production-domain.com'
  ];

  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected message from unknown origin:', event.origin);
    return;
  }

  // Safe to process the message
  handleChatBridgeMessage(event.data);
});
```

### Content Security Policy (CSP)
Update your CSP headers to allow the iFrame:

```
Content-Security-Policy: frame-src 'self' https://your-chat-bridge-domain.com;
```

## 📊 Metrics Explained

### Token Estimation
Tokens are estimated using the formula: `characters / 4`

This is a rough approximation. Actual token counts may vary by:
- Model tokenizer (GPT-4, Claude, etc.)
- Language and character types
- Special characters and formatting

### Response Time
Measured from when the API call starts to when the response is received.
Includes:
- Network latency
- Model processing time
- Backend processing

### Cost Estimation
Based on a generic rate of `$0.00001 per token`

**Important:** This is for demonstration purposes. Actual costs vary by:
- Provider (OpenAI, Anthropic, etc.)
- Model (GPT-4o, Claude, Gemini, etc.)
- Input vs output tokens
- Current pricing

Update the calculation in `MetricsPanel` component for accurate costs.

## 🚀 Production Deployment

### 1. Build the Frontend
```bash
cd frontend
npm run build
```

### 2. Configure CORS
Update `backend/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://quantummindsunited.com",
        "https://www.quantummindsunited.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. Environment Variables
Create `.env` file:
```bash
VITE_API_BASE_URL=https://api.your-domain.com
VITE_WS_BASE_URL=wss://api.your-domain.com
```

### 4. Embed in Your Site
```html
<iframe
  src="https://chat-bridge.your-domain.com"
  width="100%"
  height="800px"
  style="border: none;"
></iframe>
```

## 🎭 Quantum Minds United Integration

### Recommended Setup
```html
<!DOCTYPE html>
<html>
<head>
  <title>Quantum Minds United - AI Collaboration</title>
  <style>
    .chat-bridge-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      min-height: 100vh;
    }

    .chat-container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      padding: 8px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    iframe {
      width: 100%;
      height: calc(100vh - 120px);
      min-height: 700px;
      border: none;
      border-radius: 12px;
    }
  </style>
</head>
<body>
  <section class="chat-bridge-section">
    <div class="chat-container">
      <iframe
        id="quantumMindsChat"
        src="https://chat-bridge.quantummindsunited.com"
        allow="clipboard-write"
      ></iframe>
    </div>
  </section>

  <script>
    // Auto-enable compact mode for cleaner look
    setTimeout(() => {
      const iframe = document.getElementById('quantumMindsChat');
      iframe.contentWindow.postMessage({
        type: 'setCompactMode',
        value: true
      }, '*');
    }, 1000);
  </script>
</body>
</html>
```

## 🔧 Troubleshooting

### iFrame Not Loading
1. Check CORS settings in backend
2. Verify URL is correct (http vs https)
3. Check browser console for errors
4. Ensure backend is running

### Metrics Not Updating
1. Check browser console for postMessage errors
2. Verify origin validation isn't blocking messages
3. Ensure WebSocket connection is active
4. Check that conversation is running

### Compact Mode Not Working
1. Verify iFrame detection is working
2. Check postMessage is being sent correctly
3. Try manual toggle button in header
4. Check browser console for errors

## 📝 API Reference

### Message Types

#### `chatBridgeReady`
Sent when Chat Bridge finishes loading and is ready for interaction.

#### `metricsUpdate`
Sent whenever conversation metrics change.

**Data structure:**
```typescript
{
  totalTokens: number,
  avgResponseTime: number,
  messageCount: number,
  conversationStatus: 'idle' | 'configuring' | 'running' | 'finished' | 'error'
}
```

#### `setCompactMode`
Sent from parent to toggle compact mode.

**Data structure:**
```typescript
{
  value: boolean
}
```

## 🎨 Customization

### Override Compact Mode Behavior
Modify `App.tsx`:
```typescript
// Always start in compact mode when embedded
useEffect(() => {
  if (isEmbedded) {
    setCompactMode(true);
  }
}, [isEmbedded]);
```

### Custom Metrics
Add your own metrics in `backend/main.py`:
```python
message_a = Message(
    content=response_a,
    sender="agent_a",
    timestamp=datetime.now(),
    tokens=tokens_a,
    response_time=response_time_a,
    model=conversation.request.model_a,
    # Add your custom metrics
    # custom_metric=your_value,
)
```

## 📚 Additional Resources

- [Demo Page](./iframe-demo.html) - Full working example
- [Backend API](./backend/main.py) - Metrics implementation
- [Frontend App](./frontend/src/App.tsx) - UI components

## 🎯 Next Steps

1. Test the demo page: `open iframe-demo.html`
2. Start the backend: `python backend/main.py`
3. Start the frontend: `cd frontend && npm run dev`
4. Customize for your brand
5. Deploy to production
6. Embed in quantummindsunited.com

## 💡 Tips

- Use compact mode for cleaner embedded experience
- Monitor metrics to optimize performance
- Set up proper CORS for production
- Use HTTPS in production for security
- Test on different screen sizes
- Validate postMessage origins
- Cache API responses when possible

---

**Built with ❤️ for an enlightening user experience**
