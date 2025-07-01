const net = require("net");
const auth = require("./auth");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const clients = new Set();
const loggedInUsers = new Set();
const userSockets = {};
const userRooms = {};
const rooms = {};
const roomAdmins = {};
const roomJoinRequests = {};
const roomHistory = {};
const HISTORY_LIMIT = 10;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const server = net.createServer((socket) => {
  let currentUser = null;
  clients.add(socket);

  socket.on("data", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      socket.write("Invalid message format\n");
      return;
    }
    if (msg.type === "SEND_FILE") {
  const { recipient, filename, data } = msg;
  const targetSocket = userSockets[recipient];
  if (targetSocket) {
    targetSocket.write(JSON.stringify({
      type: "RECEIVE_FILE",
      sender: currentUser,
      filename,
      data
    }) + "\n");

    socket.write(JSON.stringify({
      type: "ROOM",
      message: `File '${filename}' sent to ${recipient}`
    }) + "\n");
  } else {
    socket.write(JSON.stringify({
      type: "ROOM",
      message: `User '${recipient}' is not online.`
    }) + "\n");
  }
  return;
}

    if (msg.type === "AUTH") {
      const { username, password } = msg;
      if (msg.action === "register") {
        if (auth.registerUser(username, password)) {
          socket.write(JSON.stringify({ type: "AUTH", status: "success", message: "Registration successful" }) + "\n");
        } else {
          socket.write(JSON.stringify({ type: "AUTH", status: "fail", message: "Username already exists" }) + "\n");
        }
      } else if (msg.action === "login") {
        if (loggedInUsers.has(username)) {
          socket.write(JSON.stringify({ type: "AUTH", status: "fail", message: "User already logged in" }) + "\n");
          return;
        }
        if (auth.validateUser(username, password)) {
          currentUser = username;
          loggedInUsers.add(username);
          userSockets[username] = socket;
          socket.write(JSON.stringify({ type: "AUTH", status: "success", message: "Login successful" }) + "\n");
        } else {
          socket.write(JSON.stringify({ type: "AUTH", status: "fail", message: "Invalid username or password" }) + "\n");
        }
      }
      return;
    }

    if (!currentUser) return;

    // Send File to Another User
    if (msg.type === "SEND_FILE") {
      const { recipient, filename, data } = msg;
      const targetSocket = userSockets[recipient];
      if (targetSocket) {
        targetSocket.write(
          JSON.stringify({
            type: "RECEIVE_FILE",
            sender: currentUser,
            filename,
            data,
          }) + "\n"
        );
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message: `File '${filename}' sent to ${recipient}.`,
          }) + "\n"
        );
      } else {
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message: `User '${recipient}' is not online.`,
          }) + "\n"
        );
      }
      return;
    }

    // Upload File to Room
    if (msg.type === "FILE_UPLOAD") {
      const room = userRooms[currentUser];
      if (!room) return;

      const filePath = path.join(uploadsDir, msg.filename);
      fs.writeFileSync(filePath, Buffer.from(msg.data, "base64"));

      for (const user of rooms[room] || []) {
        if (userSockets[user]) {
          userSockets[user].write(JSON.stringify({ type: "FILE_UPLOAD_ACK", filename: msg.filename }) + "\n");
        }
      }
      return;
    }

    // Download file
    if (msg.type === "FILE_DOWNLOAD") {
      const filePath = path.join(uploadsDir, msg.filename);
      if (!fs.existsSync(filePath)) {
        socket.write(JSON.stringify({ type: "FILE_DOWNLOAD_FAIL", message: "File not found" }) + "\n");
      } else {
        const data = fs.readFileSync(filePath).toString("base64");
        socket.write(JSON.stringify({ type: "FILE_DOWNLOAD", filename: msg.filename, data }) + "\n");
      }
      return;
    }

    // Command handlers
    if (msg.type === "COMMAND") {
      const { command } = msg;

      if (command === "users" || command === "who") {
        const room = userRooms[currentUser];
        socket.write(JSON.stringify({ type: command === "users" ? "USERS" : "WHO", users: rooms[room] || [] }) + "\n");
        return;
      }

      if (command === "rooms") {
        socket.write(JSON.stringify({ type: "ROOMS", rooms: Object.keys(rooms) }) + "\n");
        return;
      }

      if (command === "join") {
        const room = msg.room;
        if (!room) return;

        const prevRoom = userRooms[currentUser];
        if (prevRoom) {
          rooms[prevRoom] = rooms[prevRoom].filter((u) => u !== currentUser);
          if (!rooms[prevRoom].length) {
            delete rooms[prevRoom];
            delete roomAdmins[prevRoom];
            delete roomJoinRequests[prevRoom];
          }
        }

        if (!rooms[room]) {
          rooms[room] = [currentUser];
          roomAdmins[room] = currentUser;
          userRooms[currentUser] = room;
          roomHistory[room] = roomHistory[room] || [];
          socket.write(JSON.stringify({ type: "ROOM", message: `Joined room '${room}' as admin` }) + "\n");
          socket.write(JSON.stringify({ type: "ROOM_HISTORY", room, history: roomHistory[room] }) + "\n");
          return;
        }

        if (!roomJoinRequests[room]) roomJoinRequests[room] = [];
        if (rooms[room].includes(currentUser) || roomJoinRequests[room].includes(currentUser)) {
          socket.write(JSON.stringify({ type: "ROOM", message: `Already in or requested to join '${room}'` }) + "\n");
          return;
        }

        roomJoinRequests[room].push(currentUser);
        const adminSocket = userSockets[roomAdmins[room]];
        if (adminSocket) {
          adminSocket.write(JSON.stringify({ type: "ROOM_JOIN_REQUEST", room, username: currentUser }) + "\n");
        }

        socket.write(JSON.stringify({ type: "ROOM", message: `Join request sent to admin of '${room}'` }) + "\n");
        return;
      }

      if (command === "approve" || command === "reject") {
        const room = userRooms[currentUser];
        const [target] = msg.args || [];
        if (roomAdmins[room] !== currentUser || !roomJoinRequests[room]?.includes(target)) return;

        if (command === "approve") {
          rooms[room].push(target);
          userRooms[target] = room;
          roomHistory[room] = roomHistory[room] || [];
          const targetSocket = userSockets[target];
          if (targetSocket) {
            targetSocket.write(JSON.stringify({ type: "ROOM", message: `You joined room '${room}'` }) + "\n");
            targetSocket.write(JSON.stringify({ type: "ROOM_HISTORY", room, history: roomHistory[room] }) + "\n");
          }

          for (const user of rooms[room]) {
            if (user !== target && userSockets[user]) {
              userSockets[user].write(JSON.stringify({ type: "ROOM", message: `${target} joined the room.` }) + "\n");
            }
          }
        } else {
          const targetSocket = userSockets[target];
          if (targetSocket) {
            targetSocket.write(JSON.stringify({ type: "ROOM", message: `Your request to join '${room}' was rejected.` }) + "\n");
          }
        }

        roomJoinRequests[room] = roomJoinRequests[room].filter((u) => u !== target);
        return;
      }

      if (command === "leave") {
        const room = userRooms[currentUser];
        if (!room) return;
        rooms[room] = rooms[room].filter((u) => u !== currentUser);
        delete userRooms[currentUser];
        socket.write(JSON.stringify({ type: "ROOM", message: `You left room '${room}'` }) + "\n");

        for (const user of rooms[room]) {
          if (userSockets[user]) {
            userSockets[user].write(JSON.stringify({ type: "ROOM", message: `${currentUser} left the room.` }) + "\n");
          }
        }

        if (rooms[room].length === 0) {
          delete rooms[room];
          delete roomAdmins[room];
          delete roomJoinRequests[room];
        }
        return;
      }
    }

    if (msg.type === "MESSAGE") {
      const room = userRooms[currentUser];
      if (!room || roomJoinRequests[room]?.includes(currentUser)) return;

      const newMsg = { sender: currentUser, text: msg.text };
      roomHistory[room] = roomHistory[room] || [];
      roomHistory[room].push(newMsg);
      if (roomHistory[room].length > HISTORY_LIMIT) roomHistory[room].shift();

      rooms[room].forEach((user) => {
        if (user !== currentUser && userSockets[user]) {
          userSockets[user].write(JSON.stringify({ type: "MESSAGE", sender: currentUser, text: msg.text }) + "\n");
        }
      });
      return;
    }

    if (msg.type === "PRIVATE_MESSAGE") {
      const { recipient, text } = msg;
      const targetSocket = userSockets[recipient];
      const payload = { type: "PRIVATE_MESSAGE", sender: currentUser, recipient, text };
      if (targetSocket) {
        targetSocket.write(JSON.stringify(payload) + "\n");
        socket.write(JSON.stringify(payload) + "\n");
      } else {
        socket.write(JSON.stringify({ type: "PRIVATE_MESSAGE", sender: "Server", recipient: currentUser, text: `User '${recipient}' is not online.` }) + "\n");
      }
      return;
    }
  });

  socket.on("end", () => {
    if (currentUser) {
      loggedInUsers.delete(currentUser);
      delete userSockets[currentUser];

      const room = userRooms[currentUser];
      if (room && rooms[room]) {
        rooms[room] = rooms[room].filter((u) => u !== currentUser);
        for (const user of rooms[room] || []) {
          if (userSockets[user]) {
            userSockets[user].write(JSON.stringify({ type: "ROOM", message: `${currentUser} left the room.` }) + "\n");
          }
        }
        if (rooms[room].length === 0) {
          delete rooms[room];
          delete roomAdmins[room];
          delete roomJoinRequests[room];
        }
      }

      delete userRooms[currentUser];
      currentUser = null;
    }

    clients.delete(socket);
    console.log("Client disconnected");
  });

  socket.on("error", (err) => {
    console.log(`Socket error from ${currentUser || "unknown user"}:`, err.message);
  });
});

const host = process.env.HOST || "0.0.0.0";
const port = process.env.PORT || 5000;
server.listen(port, host, () => {
  console.log(`Server listening on ${host}:${port}`);
});
