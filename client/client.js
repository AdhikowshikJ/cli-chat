const net = require("net");
const readline = require("readline");
const chalk = require("chalk");
const figlet = require("figlet");
const fs = require("fs");
const path = require("path");

figlet("CLI Chat App", (err, data) => {
  if (!err) console.log(chalk.magenta(data));
  startChat();
});

function startChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(chalk.magenta("Choose action (register/login): "), (action) => {
    if (action !== "register" && action !== "login") {
      console.log(
        chalk.yellow(
          "Invalid action. Please restart and choose register or login."
        )
      );
      rl.close();
      return;
    }
    rl.question(chalk.magenta("Enter username: "), (username) => {
      rl.question(chalk.magenta("Enter password: "), (password) => {
        const client = net.createConnection(
          { port: 5000, host: "127.0.0.1" },
          () => {
            const msg = JSON.stringify({
              type: "AUTH",
              action,
              username,
              password,
            });
            client.write(msg);
          }
        );

        let loggedIn = false;
        let buffer = "";

        client.on("data", (data) => {
          buffer += data.toString();
          let idx;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const jsonStr = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (!jsonStr.trim()) continue;
            try {
              const msg = JSON.parse(jsonStr);
              if (msg.type === "AUTH") {
                console.log(chalk.yellow("Server:"), chalk.yellow(msg.message));
                if (msg.status === "success" && action === "login") {
                  loggedIn = true;
                  chatLoop();
                  continue;
                } else {
                  client.end();
                  rl.close();
                  continue;
                }
              } else if (msg.type === "MESSAGE") {
                if (msg.sender === username) {
                  console.log(chalk.green(`\nYou: ${msg.text}`));
                } else {
                  console.log(chalk.cyan(`\n${msg.sender}: ${msg.text}`));
                }
                rl.prompt();
              } else if (msg.type === "USERS") {
                console.log(
                  chalk.yellow("Online users:"),
                  msg.users.join(", ")
                );
                rl.prompt();
              } else if (msg.type === "FILE_UPLOAD_ACK") {
                console.log(
                  chalk.yellow(`File '${msg.filename}' uploaded successfully!`)
                );
                rl.prompt();
              } else if (msg.type === "FILE_UPLOAD_FAIL") {
                console.log(chalk.red(`File upload failed: ${msg.message}`));
                rl.prompt();
              } else if (msg.type === "FILE_DOWNLOAD") {
                const downloadsDir = path.join(__dirname, "downloads");
                if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
                const filePath = path.join(downloadsDir, msg.filename);
                fs.writeFile(
                  filePath,
                  Buffer.from(msg.data, "base64"),
                  (err) => {
                    if (err) {
                      console.log(
                        chalk.red(`Failed to save file: ${err.message}`)
                      );
                    } else {
                      console.log(
                        chalk.green(
                          `File '${msg.filename}' downloaded to downloads/`
                        )
                      );
                    }
                    rl.prompt();
                  }
                );
              } else if (msg.type === "FILE_DOWNLOAD_FAIL") {
                console.log(chalk.red(`File download failed: ${msg.message}`));
                rl.prompt();
              } else if (msg.type === "PRIVATE_MESSAGE") {
                if (msg.sender === username) {
                  console.log(
                    chalk.green(`\n[Private] To ${msg.recipient}: ${msg.text}`)
                  );
                } else {
                  console.log(
                    chalk.yellow(`\n[Private] From ${msg.sender}: ${msg.text}`)
                  );
                }
                rl.prompt();
              } else if (msg.type === "ROOM") {
                console.log(chalk.yellow(msg.message));
                rl.prompt();
              } else if (msg.type === "ROOMS") {
                console.log(
                  chalk.yellow("Available rooms:"),
                  msg.rooms.length ? msg.rooms.join(", ") : "(none)"
                );
                rl.prompt();
              } else if (msg.type === "ROOM_HISTORY") {
                if (msg.history && msg.history.length) {
                  console.log(
                    chalk.yellow(
                      `Last ${msg.history.length} messages in '${msg.room}':`
                    )
                  );
                  for (const m of msg.history) {
                    if (m.sender === username) {
                      console.log(chalk.green(`You: ${m.text}`));
                    } else {
                      console.log(chalk.cyan(`${m.sender}: ${m.text}`));
                    }
                  }
                } else {
                  console.log(
                    chalk.yellow(`No message history in '${msg.room}'.`)
                  );
                }
                rl.prompt();
              } else if (msg.type === "WHO") {
                if (msg.room && msg.users.length) {
                  console.log(
                    chalk.yellow(`Users in '${msg.room}':`),
                    msg.users.join(", ")
                  );
                } else {
                  console.log(
                    chalk.yellow(
                      "You are not in any room or the room is empty."
                    )
                  );
                }
                rl.prompt();
              } else if (msg.type === "ROOM_JOIN_REQUEST") {
                console.log(
                  chalk.yellow(
                    `[Room Join Request] User '${msg.username}' wants to join '${msg.room}'. Use /approve ${msg.username} or /reject ${msg.username}`
                  )
                );
                rl.prompt();
              } else {
                console.log(chalk.yellow("Received from server:"), jsonStr);
              }
            } catch (e) {
              console.log(
                chalk.yellow("Received from server (parse error):"),
                jsonStr
              );
            }
          }
        });

        client.on("end", () => {
          console.log(chalk.yellow("Disconnected from server"));
          rl.close();
        });

        function chatLoop() {
          rl.setPrompt(chalk.magenta("You: "));
          rl.prompt();
          rl.on("line", (line) => {
            if (line.trim().startsWith("/")) {
              const [command, ...args] = line.trim().split(" ");
              if (command === "/exit") {
                client.end();
                rl.close();
                return;
              } else if (command === "/help") {
                console.log(chalk.yellow("Available commands:"));
                console.log(chalk.yellow("/help - Show this help message"));
                console.log(chalk.yellow("/exit - Exit the chat"));
                console.log(chalk.yellow("/users - List online users"));
                console.log(
                  chalk.yellow(
                    "/upload <filepath> - Upload a file to the server"
                  )
                );
                console.log(
                  chalk.yellow(
                    "/download <filename> - Download a file from the server"
                  )
                );
                console.log(
                  chalk.yellow(
                    "/msg <username> <message> - Send a private message"
                  )
                );
                console.log(chalk.yellow("/join <room> - Join a chat room"));
                console.log(
                  chalk.yellow("/leave - Leave the current chat room")
                );
                console.log(chalk.yellow("/rooms - List available chat rooms"));
                console.log(
                  chalk.yellow("/who - Show users in the current room")
                );
                console.log(
                  chalk.yellow("/approve <username> - Approve a join request")
                );
                console.log(
                  chalk.yellow("/reject <username> - Reject a join request")
                );
                rl.prompt();
                return;
              } else if (command === "/users") {
                const usersMsg = JSON.stringify({
                  type: "COMMAND",
                  command: "users",
                });
                client.write(usersMsg);
                rl.prompt();
                return;
              } else if (command === "/upload") {
                const filepath = args.join(" ");
                if (!filepath) {
                  console.log(chalk.red("Usage: /upload <filepath>"));
                  rl.prompt();
                  return;
                }
                fs.readFile(filepath, (err, fileData) => {
                  if (err) {
                    console.log(
                      chalk.red(`Failed to read file: ${err.message}`)
                    );
                    rl.prompt();
                    return;
                  }
                  const filename = path.basename(filepath);
                  const uploadMsg = JSON.stringify({
                    type: "FILE_UPLOAD",
                    filename,
                    data: fileData.toString("base64"),
                    sender: username,
                  });
                  client.write(uploadMsg);
                });
                rl.prompt();
                return;
              } else if (command === "/download") {
                const filename = args.join(" ");
                if (!filename) {
                  console.log(chalk.red("Usage: /download <filename>"));
                  rl.prompt();
                  return;
                }
                const downloadMsg = JSON.stringify({
                  type: "FILE_DOWNLOAD",
                  filename,
                });
                client.write(downloadMsg);
                rl.prompt();
                return;
              } else if (command === "/msg") {
                const [recipient, ...pmArr] = args;
                const pmText = pmArr.join(" ");
                if (!recipient || !pmText) {
                  console.log(chalk.red("Usage: /msg <username> <message>"));
                  rl.prompt();
                  return;
                }
                const pmMsg = JSON.stringify({
                  type: "PRIVATE_MESSAGE",
                  recipient,
                  text: pmText,
                  sender: username,
                });
                client.write(pmMsg);
                rl.prompt();
                return;
              } else if (command === "/join") {
                const room = args.join(" ");
                if (!room) {
                  console.log(chalk.red("Usage: /join <room>"));
                  rl.prompt();
                  return;
                }
                const joinMsg = JSON.stringify({
                  type: "COMMAND",
                  command: "join",
                  room,
                });
                client.write(joinMsg);
                rl.prompt();
                return;
              } else if (command === "/leave") {
                const leaveMsg = JSON.stringify({
                  type: "COMMAND",
                  command: "leave",
                });
                client.write(leaveMsg);
                rl.prompt();
                return;
              } else if (command === "/rooms") {
                const roomsMsg = JSON.stringify({
                  type: "COMMAND",
                  command: "rooms",
                });
                client.write(roomsMsg);
                rl.prompt();
                return;
              } else if (command === "/who") {
                const whoMsg = JSON.stringify({
                  type: "COMMAND",
                  command: "who",
                });
                client.write(whoMsg);
                rl.prompt();
                return;
              } else if (command === "/approve" || command === "/reject") {
                const [targetUser] = args;
                if (!targetUser) {
                  console.log(chalk.red(`Usage: ${command} <username>`));
                  rl.prompt();
                  return;
                }
                const adminMsg = JSON.stringify({
                  type: "COMMAND",
                  command: command.slice(1),
                  args: [targetUser],
                });
                client.write(adminMsg);
                rl.prompt();
                return;
              } else {
                console.log(
                  chalk.yellow(
                    "Unknown command. Type /help for a list of commands."
                  )
                );
                rl.prompt();
                return;
              }
            }
            const chatMsg = JSON.stringify({
              type: "MESSAGE",
              text: line,
              sender: username,
            });
            client.write(chatMsg);
            rl.prompt();
          });
        }
      });
    });
  });
}
