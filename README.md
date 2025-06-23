# CLI Chat Application

A robust, real-time command-line chat application built with Node.js, enabling multiple users to communicate over TCP sockets. The app features user authentication, file sharing, chat rooms, private messaging, and an enhanced CLI experience.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Core Technologies](#core-technologies)
- [Installation](#installation)
- [Usage](#usage)
- [Available Commands](#available-commands)
- [Testing](#testing)
- [Security & Performance](#security--performance)
- [Future Enhancements](#future-enhancements)

---

## Features

- **Real-Time Messaging:** Multi-user chat with instant message delivery via TCP sockets.
- **User Authentication:** Register/login with username and password; duplicate username prevention.
- **File Sharing:** Upload/download files between users and server with progress feedback.
- **Chat Rooms:** Create, join (with admin approval), and leave chat rooms; room-based message history.
- **Private Messaging:** Send direct messages to specific users.
- **Enhanced CLI:** Colored output, ASCII art banners, interactive prompts, and command parsing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Chat Application                    │
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

---

## Project Structure

```
cli-chat-app/
├── package.json
├── README.md
├── server/
│   ├── server.js         # Main server logic (TCP, rooms, file ops)
│   ├── auth.js           # User registration & authentication
│   ├── users.json        # User credentials (JSON)
│   └── uploads/          # Uploaded files
├── client/
│   ├── client.js         # Main CLI client
│   └── downloads/        # Downloaded files
├── shared/
│   └── constants.js      # Shared constants (currently empty)
├── tests/
│   ├── server.test.js    # (empty placeholder)
│   └── client.test.js    # (empty placeholder)
```

---

## Core Technologies

- **Node.js**: Server and client runtime
- **TCP Sockets**: Real-time communication (`net` module)
- **File System (`fs`)**: File upload/download
- **Streams**: Efficient file transfer
- **CLI Libraries**: `chalk`, `figlet` for UI; `readline` for input

---

## Installation

1. **Clone the repository:**
   ```sh
   git clone <repo-url>
   cd cli-chat-app
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
   > Required dependencies: `chalk`, `figlet`, `blessed` (see `package.json`)

---

## Usage

### 1. Start the Server

```sh
node server/server.js
```

The server listens on port **5000** by default.

### 2. Start the Client (in a new terminal)

```sh
node client/client.js
```

- Register or login with a username and password.
- After login, use chat and commands interactively.

---

## Available Commands

| Command                     | Description                                |
| --------------------------- | ------------------------------------------ |
| `/help`                     | Show help message with available commands  |
| `/exit`                     | Exit the chat                              |
| `/users`                    | List online users                          |
| `/upload <filepath>`        | Upload a file to the server                |
| `/download <filename>`      | Download a file from the server            |
| `/msg <username> <message>` | Send a private message                     |
| `/join <room>`              | Join a chat room (admin approval required) |
| `/leave`                    | Leave the current chat room                |
| `/rooms`                    | List available chat rooms                  |
| `/who`                      | Show users in the current room             |
| `/approve <username>`       | Approve a join request (admin only)        |
| `/reject <username>`        | Reject a join request (admin only)         |

- **Normal messages** (not starting with `/`) are sent to the current room or all users.

---

## Authentication

- On first run, register a new user or use one of the demo users in `server/users.json`.
- Passwords are stored in plaintext for demo purposes (do not use real credentials).

---

## Testing

- Placeholder test files exist in `tests/`.
- Manual testing: Connect multiple clients, try messaging, file sharing, and room features.

---

## Security & Performance

- **Input validation**: Prevents invalid/duplicate usernames, restricts file types/sizes.
- **Network security**: Basic DoS protection, connection rate limiting.
- **Performance**: Stream-based file transfers, efficient memory and buffer management.

---

## Future Enhancements

- End-to-end encryption
- Voice message and screen sharing
- Bot integration
- Rich text formatting, emoji, themes
- Database and cloud deployment support

---

## License

ISC
