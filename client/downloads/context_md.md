# CLI Chat Application - Project Context

## Project Overview
A real-time command-line chatting application built with Node.js that enables multiple users to communicate via TCP sockets over IP addresses. The application features file sharing, user authentication, and an intuitive CLI interface.

## Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Chat Application                      │
├─────────────────────────────────────────────────────────────┤
│  Client-Server Architecture with TCP Socket Communication   │
└─────────────────────────────────────────────────────────────┘

Server Side:                          Client Side:
┌──────────────┐                     ┌──────────────┐
│    Server    │ ←─── TCP Socket ──→ │    Client    │
│   (server.js)│                     │  (client.js) │
├──────────────┤                     ├──────────────┤
│• User Auth   │                     │• CLI Interface│
│• Message     │                     │• File Upload │
│  Broadcasting│                     │• Real-time   │
│• File Sharing│                     │  Messaging   │
│• Connection  │                     │• Commands    │
│  Management  │                     │• Notifications│
└──────────────┘                     └──────────────┘
```

## Core Technologies

### Primary Stack
- **Node.js**: Runtime environment for server and client applications
- **TCP Sockets**: Using Node.js `net` module for real-time communication
- **File System (`fs`)**: For file operations and sharing
- **Streams**: For efficient file transfer and data handling

### CLI Enhancement Libraries
- **commander**: Command-line argument parsing and subcommands
- **inquirer**: Interactive prompts and user input handling
- **chalk**: Terminal text styling and colors
- **figlet**: ASCII art banners for visual appeal
- **ora**: Loading spinners and progress indicators
- **readline**: Built-in module for line-by-line input handling

## Key Features

### 1. Real-Time Communication
- TCP socket-based messaging
- Instant message delivery
- Multi-client support
- Connection status tracking

### 2. User Authentication
- Username-based registration
- Simple login system
- User session management
- Duplicate username prevention

### 3. File Sharing
- Upload files to server
- Download files from server
- File integrity verification
- Progress indicators for transfers

### 4. Enhanced CLI Experience
- Colored output for different message types
- Interactive command prompts
- ASCII art welcome banners
- Loading animations
- Clear command structure

## Project Structure
```
cli-chat-app/
├── package.json
├── README.md
├── context.md
├── server/
│   ├── server.js
│   ├── auth.js
│   ├── fileHandler.js
│   └── uploads/
├── client/
│   ├── client.js
│   ├── cli.js
│   ├── fileManager.js
│   └── downloads/
├── shared/
│   ├── constants.js
│   ├── utils.js
│   └── protocols.js
└── tests/
    ├── server.test.js
    └── client.test.js
```

## Communication Protocol

### Message Types
```javascript
{
  type: 'MESSAGE' | 'FILE_UPLOAD' | 'FILE_DOWNLOAD' | 'AUTH' | 'COMMAND' | 'NOTIFICATION',
  sender: 'username',
  recipient: 'username' | 'ALL',
  timestamp: Date.now(),
  data: {}, // Content varies by type
  id: 'unique-message-id'
}
```

### Server Events
- `connection`: New client connected
- `message`: Text message received
- `file-upload`: File upload request
- `file-download`: File download request
- `auth`: Authentication request
- `disconnect`: Client disconnected

### Client Events
- `message`: Receive text message
- `file-received`: File uploaded to server
- `file-available`: File ready for download
- `auth-success`: Authentication successful
- `auth-failed`: Authentication failed
- `user-joined`: New user joined chat
- `user-left`: User left chat

## Development Phases

### Phase 1: Basic Setup
- Project initialization
- Basic server-client connection
- Simple message exchange

### Phase 2: Authentication
- User registration system
- Login functionality
- Session management

### Phase 3: Enhanced CLI
- Command parsing with commander
- Interactive prompts with inquirer
- Styled output with chalk
- Welcome banner with figlet

### Phase 4: File Sharing
- File upload mechanism
- File download system
- Progress indicators with ora

### Phase 5: Advanced Features
- Private messaging
- Chat rooms
- Message history
- User presence indicators

## Security Considerations

### Data Validation
- Input sanitization
- File type restrictions
- File size limits
- Username validation

### Network Security
- Connection rate limiting
- Basic DoS protection
- Input length restrictions
- Secure file handling

## Performance Optimizations

### Memory Management
- Stream-based file transfers
- Connection pooling
- Garbage collection optimization
- Buffer management

### Network Efficiency
- Message compression
- Connection reuse
- Efficient data serialization
- Heartbeat mechanism

## Testing Strategy

### Unit Tests
- Message handling functions
- Authentication logic
- File operations
- Utility functions

### Integration Tests
- Client-server communication
- File transfer workflows
- Multi-client scenarios
- Error handling

### Manual Testing
- Multiple client connections
- Network interruption scenarios
- File sharing edge cases
- CLI usability testing

## Deployment Considerations

### Local Development
- `localhost` testing
- Port configuration
- File path management
- Debug logging

### Network Deployment
- IP address configuration
- Firewall settings
- Port forwarding
- Network discovery

## Error Handling

### Connection Errors
- Network disconnection
- Server unavailability
- Timeout handling
- Reconnection logic

### File Transfer Errors
- Corrupted files
- Insufficient storage
- Permission issues
- Transfer interruption

### User Errors
- Invalid commands
- Authentication failures
- Duplicate actions
- Input validation

## Future Enhancements

### Advanced Features
- End-to-end encryption
- Voice message support
- Screen sharing
- Bot integration

### UI Improvements
- Rich text formatting
- Emoji support
- Custom themes
- Notification sounds

### Scalability
- Database integration
- Load balancing
- Clustering support
- Cloud deployment

This context provides the foundation for building a robust, feature-rich CLI chat application that can serve as both a learning project and a practical communication tool.