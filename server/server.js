const net = require("net");
const auth = require("./auth");
const fs = require("fs");
const path = require("path");

const loggedInUsers = new Set();
const clients = new Set();
const uploadsDir = path.join(__dirname, "uploads");
const userSockets = {};
const userRooms = {};
const rooms = {};
const roomHistory = {};
const HISTORY_LIMIT = 10;
const roomAdmins = {};
const roomJoinRequests = {};

const server = net.createServer((socket) => {
  let currentUser = null;
  clients.add(socket);
  console.log(
    "Client connected:",
    socket.remoteAddress + ":" + socket.remotePort
  );

  socket.on("data", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      socket.write("Invalid message format\n");
      return;
    }
    if (msg.type === "AUTH" && msg.action === "register") {
      const { username, password } = msg;
      if (auth.registerUser(username, password)) {
        socket.write(
          JSON.stringify({
            type: "AUTH",
            status: "success",
            message: "Registration successful",
          }) + "\n"
        );
      } else {
        socket.write(
          JSON.stringify({
            type: "AUTH",
            status: "fail",
            message: "Username already exists",
          }) + "\n"
        );
      }
      return;
    }
    if (msg.type === "AUTH" && msg.action === "login") {
      const { username, password } = msg;
      if (loggedInUsers.has(username)) {
        socket.write(
          JSON.stringify({
            type: "AUTH",
            status: "fail",
            message: "User already logged in",
          }) + "\n"
        );
        return;
      }
      if (auth.validateUser(username, password)) {
        loggedInUsers.add(username);
        currentUser = username;
        userSockets[username] = socket;
        socket.write(
          JSON.stringify({
            type: "AUTH",
            status: "success",
            message: "Login successful",
          }) + "\n"
        );
      } else {
        socket.write(
          JSON.stringify({
            type: "AUTH",
            status: "fail",
            message: "Invalid username or password",
          }) + "\n"
        );
      }
      return;
    }
    if (msg.type === "COMMAND" && msg.command === "users" && currentUser) {
      socket.write(
        JSON.stringify({
          type: "USERS",
          users: Array.from(loggedInUsers),
        }) + "\n"
      );
      return;
    }
    if (msg.type === "FILE_UPLOAD" && currentUser) {
      // Save file to uploads directory
      const filePath = path.join(uploadsDir, msg.filename);
      try {
        const fileBuffer = Buffer.from(msg.data, "base64");
        fs.writeFileSync(filePath, fileBuffer);
        socket.write(
          JSON.stringify({
            type: "FILE_UPLOAD_ACK",
            filename: msg.filename,
          }) + "\n"
        );
        // Notify all users
        for (const client of clients) {
          if (client !== socket) {
            client.write(
              JSON.stringify({
                type: "MESSAGE",
                sender: "Server",
                text: `File '${msg.filename}' uploaded by ${currentUser}`,
              }) + "\n"
            );
          }
        }
      } catch (err) {
        socket.write(
          JSON.stringify({
            type: "FILE_UPLOAD_FAIL",
            filename: msg.filename,
            message: err.message,
          }) + "\n"
        );
      }
      return;
    }
    if (msg.type === "FILE_DOWNLOAD" && currentUser) {
      const filePath = path.join(uploadsDir, msg.filename);
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath);
        socket.write(
          JSON.stringify({
            type: "FILE_DOWNLOAD",
            filename: msg.filename,
            data: fileData.toString("base64"),
          }) + "\n"
        );
      } else {
        socket.write(
          JSON.stringify({
            type: "FILE_DOWNLOAD_FAIL",
            filename: msg.filename,
            message: "File not found",
          }) + "\n"
        );
      }
      return;
    }
    if (msg.type === "COMMAND" && msg.command === "join" && currentUser) {
      const room = msg.room;
      if (!room) {
        socket.write(
          JSON.stringify({ type: "ROOM", message: "Usage: /join <room>" }) +
            "\n"
        );
        return;
      }
      // Remove from previous room
      if (userRooms[currentUser]) {
        const prevRoom = userRooms[currentUser];
        rooms[prevRoom] = rooms[prevRoom].filter((u) => u !== currentUser);
        if (rooms[prevRoom].length === 0) {
          delete rooms[prevRoom];
          delete roomAdmins[prevRoom];
          delete roomJoinRequests[prevRoom];
        }
      }
      // Room admin logic
      if (!rooms[room] || rooms[room].length === 0) {
        // First user becomes admin and is auto-approved
        userRooms[currentUser] = room;
        rooms[room] = [currentUser];
        roomAdmins[room] = currentUser;
        if (!roomHistory[room]) roomHistory[room] = [];
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message: `Joined room '${room}' as admin`,
          }) + "\n"
        );
        socket.write(
          JSON.stringify({
            type: "ROOM_HISTORY",
            room,
            history: roomHistory[room],
          }) + "\n"
        );
        return;
      } else {
        // Room exists, must request join from admin
        if (!roomJoinRequests[room]) roomJoinRequests[room] = [];
        if (
          rooms[room].includes(currentUser) ||
          roomJoinRequests[room].includes(currentUser)
        ) {
          socket.write(
            JSON.stringify({
              type: "ROOM",
              message: `Already in or requested to join '${room}'`,
            }) + "\n"
          );
          return;
        }
        roomJoinRequests[room].push(currentUser);
        const adminSocket = userSockets[roomAdmins[room]];
        if (adminSocket) {
          adminSocket.write(
            JSON.stringify({
              type: "ROOM_JOIN_REQUEST",
              room,
              username: currentUser,
            }) + "\n"
          );
        }
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message: `Join request sent to admin of '${room}'. Awaiting approval...`,
          }) + "\n"
        );
        return;
      }
    }
    if (
      msg.type === "COMMAND" &&
      (msg.command === "approve" || msg.command === "reject") &&
      currentUser
    ) {
      const [targetUser] = msg.args || [];
      const room = userRooms[currentUser];
      if (!room || roomAdmins[room] !== currentUser) {
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message: "You are not the admin of any room.",
          }) + "\n"
        );
        return;
      }
      if (
        !targetUser ||
        !roomJoinRequests[room] ||
        !roomJoinRequests[room].includes(targetUser)
      ) {
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message: `No join request from '${targetUser}' in '${room}'.`,
          }) + "\n"
        );
        return;
      }
      const targetSocket = userSockets[targetUser];
      if (msg.command === "approve") {
        // Approve join
        rooms[room].push(targetUser);
        userRooms[targetUser] = room;
        if (!roomHistory[room]) roomHistory[room] = [];
        if (targetSocket) {
          targetSocket.write(
            JSON.stringify({
              type: "ROOM",
              message: `Your join request to '${room}' was approved!`,
            }) + "\n"
          );
          targetSocket.write(
            JSON.stringify({
              type: "ROOM_HISTORY",
              room,
              history: roomHistory[room],
            }) + "\n"
          );
        }
        // Notify others
        for (const user of rooms[room]) {
          if (user !== targetUser && userSockets[user]) {
            userSockets[user].write(
              JSON.stringify({
                type: "ROOM",
                message: `${targetUser} joined the room.`,
              }) + "\n"
            );
          }
        }
      } else if (msg.command === "reject") {
        // Reject join
        if (targetSocket) {
          targetSocket.write(
            JSON.stringify({
              type: "ROOM",
              message: `Your join request to '${room}' was rejected by the admin.`,
            }) + "\n"
          );
        }
      }
      // Remove from join requests
      roomJoinRequests[room] = roomJoinRequests[room].filter(
        (u) => u !== targetUser
      );
      return;
    }
    if (msg.type === "COMMAND" && msg.command === "leave" && currentUser) {
      const room = userRooms[currentUser];
      if (room) {
        rooms[room] = rooms[room].filter((u) => u !== currentUser);
        if (rooms[room].length === 0) delete rooms[room];
        // Notify others
        for (const user of rooms[room] || []) {
          if (userSockets[user]) {
            userSockets[user].write(
              JSON.stringify({
                type: "ROOM",
                message: `${currentUser} left the room.`,
              }) + "\n"
            );
          }
        }
        delete userRooms[currentUser];
        socket.write(
          JSON.stringify({ type: "ROOM", message: `Left room '${room}'` }) +
            "\n"
        );
      } else {
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message: "You are not in any room.",
          }) + "\n"
        );
      }
      return;
    }
    if (msg.type === "COMMAND" && msg.command === "rooms" && currentUser) {
      socket.write(
        JSON.stringify({ type: "ROOMS", rooms: Object.keys(rooms) }) + "\n"
      );
      return;
    }
    if (msg.type === "MESSAGE" && currentUser) {
      const room = userRooms[currentUser];
      // Block messaging if user is not in the room (i.e., waiting for approval)
      if (
        roomJoinRequests[room] &&
        roomJoinRequests[room].includes(currentUser)
      ) {
        socket.write(
          JSON.stringify({
            type: "ROOM",
            message:
              "You must wait for admin approval before messaging in this room.",
          }) + "\n"
        );
        return;
      }
      if (room && rooms[room]) {
        // Store in history
        if (!roomHistory[room]) roomHistory[room] = [];
        roomHistory[room].push({ sender: currentUser, text: msg.text });
        if (roomHistory[room].length > HISTORY_LIMIT) roomHistory[room].shift();
        for (const user of rooms[room]) {
          if (user !== currentUser && userSockets[user]) {
            userSockets[user].write(
              JSON.stringify({
                type: "MESSAGE",
                sender: currentUser,
                text: msg.text,
              }) + "\n"
            );
          }
        }
      } else {
        // Not in a room, send to all (fallback)
        for (const client of clients) {
          if (client !== socket) {
            client.write(
              JSON.stringify({
                type: "MESSAGE",
                sender: currentUser,
                text: msg.text,
              }) + "\n"
            );
          }
        }
      }
      return;
    }
    if (msg.type === "PRIVATE_MESSAGE" && currentUser) {
      const { recipient, text } = msg;
      if (userSockets[recipient]) {
        // Send to recipient
        userSockets[recipient].write(
          JSON.stringify({
            type: "PRIVATE_MESSAGE",
            sender: currentUser,
            recipient,
            text,
          }) + "\n"
        );
        // Echo to sender
        socket.write(
          JSON.stringify({
            type: "PRIVATE_MESSAGE",
            sender: currentUser,
            recipient,
            text,
          }) + "\n"
        );
      } else {
        socket.write(
          JSON.stringify({
            type: "PRIVATE_MESSAGE",
            sender: "Server",
            recipient: currentUser,
            text: `User '${recipient}' is not online.`,
          }) + "\n"
        );
      }
      return;
    }
    if (msg.type === "COMMAND" && msg.command === "who" && currentUser) {
      const room = userRooms[currentUser];
      if (room && rooms[room]) {
        socket.write(
          JSON.stringify({ type: "WHO", users: rooms[room], room }) + "\n"
        );
      } else {
        socket.write(
          JSON.stringify({ type: "WHO", users: [], room: null }) + "\n"
        );
      }
      return;
    }
    console.log("Received from client:", data.toString());
    socket.write("Hello from server!");
  });

  socket.on("end", () => {
    if (currentUser) {
      loggedInUsers.delete(currentUser);
      delete userSockets[currentUser];
      // Remove from room
      const room = userRooms[currentUser];
      if (room && rooms[room]) {
        rooms[room] = rooms[room].filter((u) => u !== currentUser);
        if (rooms[room].length === 0) delete rooms[room];
        // Notify others
        for (const user of rooms[room] || []) {
          if (userSockets[user]) {
            userSockets[user].write(
              JSON.stringify({
                type: "ROOM",
                message: `${currentUser} left the room.`,
              }) + "\n"
            );
          }
        }
      }
      delete userRooms[currentUser];
      currentUser = null;
    }
    clients.delete(socket);
    console.log("Client disconnected");
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
