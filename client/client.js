const net = require("net");
const readline = require("readline");
const chalk = require("chalk");
const figlet = require("figlet");
const fs = require("fs");
const path = require("path");

let clientSocket = null;

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
      console.log(chalk.yellow("Invalid action. Choose register or login."));
      rl.close();
      return;
    }

    rl.question(chalk.magenta("Enter username: "), (username) => {
      rl.question(chalk.magenta("Enter password: "), (password) => {
        clientSocket = net.createConnection({ port: 5000, host: "127.0.0.1" }, () => {
          const msg = JSON.stringify({ type: "AUTH", action, username, password });
          clientSocket.write(msg);
        });

        // SIGINT handler – placed correctly after clientSocket and rl are defined
        let isExiting = false;
        process.on("SIGINT", () => {
          if (isExiting) return;
          isExiting = true;
          console.log(chalk.yellow("\nLogging out and disconnecting..."));
          rl.close();
          clientSocket.end();
        });

        clientSocket.on("end", () => {
          console.log(chalk.yellow("Disconnected from server."));
          process.exit(0);
        });

        clientSocket.on("error", (err) => {
          console.log(chalk.red("Client error:"), err.message);
          process.exit(1);
        });

        let buffer = "";

        clientSocket.on("data", (data) => {
          buffer += data.toString();
          let idx;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const jsonStr = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (!jsonStr.trim()) continue;

            try {
              const msg = JSON.parse(jsonStr);
              handleServerMessage(msg);
            } catch (e) {
              console.log(chalk.red("Error parsing server message:"), jsonStr);
            }
          }
        });

        function handleServerMessage(msg) {
          if (msg.type === "AUTH") {
            console.log(chalk.yellow("Server:"), msg.message);
            if (msg.status === "success" && action === "login") {
              chatLoop();
            } else {
              rl.close();
              clientSocket.end();
            }
          } else if (msg.type === "MESSAGE") {
            if (msg.sender === username) {
              console.log(chalk.green(`\nYou: ${msg.text}`));
            } else {
              console.log(chalk.cyan(`\n${msg.sender}: ${msg.text}`));
            }
            rl.prompt();
          } else if (msg.type === "PRIVATE_MESSAGE") {
            if (msg.sender === username) {
              console.log(chalk.green(`[Private] To ${msg.recipient}: ${msg.text}`));
            } else {
              console.log(chalk.yellow(`[Private] From ${msg.sender}: ${msg.text}`));
            }
            rl.prompt();
          } else if (msg.type === "USERS" || msg.type === "WHO") {
            console.log(chalk.yellow("Users in room:"), msg.users.join(", "));
            rl.prompt();
          } else if (msg.type === "ROOM") {
            console.log(chalk.yellow(msg.message));
            rl.prompt();
          } else if (msg.type === "ROOMS") {
            console.log(chalk.yellow("Available rooms:"), msg.rooms.join(", "));
            rl.prompt();
          } else if (msg.type === "ROOM_HISTORY") {
            if (msg.history.length === 0) {
              console.log(chalk.yellow(`No message history in '${msg.room}'.`));
            } else {
              console.log(chalk.yellow(`History in '${msg.room}':`));
              msg.history.forEach((m) => {
                const tag = m.sender === username ? chalk.green("You") : chalk.cyan(m.sender);
                console.log(`${tag}: ${m.text}`);
              });
            }
            rl.prompt();
          } else if (msg.type === "ROOM_JOIN_REQUEST") {
            console.log(chalk.yellow(`[Room Join] ${msg.username} requested to join '${msg.room}'`));
            console.log(chalk.yellow(`Use /approve ${msg.username} or /reject ${msg.username}`));
            rl.prompt();
          } else if (msg.type === "FILE_UPLOAD_ACK") {
            console.log(chalk.green(`File '${msg.filename}' uploaded successfully.`));
            rl.prompt();
          } else if (msg.type === "FILE_DOWNLOAD") {
            const downloadsDir = path.join(__dirname, "downloads");
            if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
            const filePath = path.join(downloadsDir, msg.filename);
            fs.writeFileSync(filePath, Buffer.from(msg.data, "base64"));
            console.log(chalk.green(`Downloaded '${msg.filename}' to 'downloads/'`));
            rl.prompt();
          } else if (msg.type === "FILE_DOWNLOAD_FAIL") {
            console.log(chalk.red(`File download failed: ${msg.message}`));
            rl.prompt();
          }else if (msg.type === "RECEIVE_FILE") {
  const downloadsDir = path.join(__dirname, "downloads");
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
  const filePath = path.join(downloadsDir, msg.filename);
  fs.writeFileSync(filePath, Buffer.from(msg.data, "base64"));
  console.log(chalk.green(`\nReceived file '${msg.filename}' from ${msg.sender} -> saved to downloads/`));
  rl.prompt();
}

           else {
            console.log(chalk.gray("Unhandled message:"), msg);
            rl.prompt();
          }
        }

        function chatLoop() {
          rl.setPrompt(chalk.magenta("You: "));
          rl.prompt();
          rl.on("line", (line) => {
            const trimmed = line.trim();
            if (!trimmed) {
              rl.prompt();
              return;
            }

            if (trimmed.startsWith("/")) {
              const [cmd, ...args] = trimmed.split(" ");
              handleCommand(cmd, args);
            } else {
              clientSocket.write(JSON.stringify({ type: "MESSAGE", text: line, sender: username }));
              rl.prompt();
            }
          });
        }

        function handleCommand(cmd, args) {
          const commands = {
            "/help": () => {
              const help = [
                "/help - Show this help message",
                "/users - List users in your room",
                "/who - Show users in your room",
                "/rooms - List all rooms",
                "/join <room> - Join or request to join room",
                "/leave - Leave current room",
                "/approve <username> - Approve user to join room (admin)",
                "/reject <username> - Reject join request (admin)",
                "/msg <user> <message> - Private message user",
                "/upload <filepath> - Upload a file",
                "/download <filename> - Download a file",
                "/exit - Exit chat"
              ];
              console.log(chalk.yellow("Available commands:\n" + help.join("\n")));
              rl.prompt();
            },
            "/users": () => clientSocket.write(JSON.stringify({ type: "COMMAND", command: "users" })),
            "/who": () => clientSocket.write(JSON.stringify({ type: "COMMAND", command: "who" })),
            "/rooms": () => clientSocket.write(JSON.stringify({ type: "COMMAND", command: "rooms" })),
            "/join": () => {
              const room = args.join(" ");
              if (!room) return console.log(chalk.red("Usage: /join <room>"));
              clientSocket.write(JSON.stringify({ type: "COMMAND", command: "join", room }));
            },
            "/leave": () => clientSocket.write(JSON.stringify({ type: "COMMAND", command: "leave" })),
            "/approve": () => {
              if (!args[0]) return console.log(chalk.red("Usage: /approve <username>"));
              clientSocket.write(JSON.stringify({ type: "COMMAND", command: "approve", args }));
            },
            "/reject": () => {
              if (!args[0]) return console.log(chalk.red("Usage: /reject <username>"));
              clientSocket.write(JSON.stringify({ type: "COMMAND", command: "reject", args }));
            },
            "/msg": () => {
              const [recipient, ...pmText] = args;
              if (!recipient || !pmText.length) {
                return console.log(chalk.red("Usage: /msg <username> <message>"));
              }
              clientSocket.write(JSON.stringify({
                type: "PRIVATE_MESSAGE",
                sender: username,
                recipient,
                text: pmText.join(" "),
              }));
            },
            "/upload": () => {
              const filepath = args.join(" ");
              if (!filepath || !fs.existsSync(filepath)) {
                return console.log(chalk.red("Invalid file path"));
              }
              const fileData = fs.readFileSync(filepath).toString("base64");
              const filename = path.basename(filepath);
              clientSocket.write(JSON.stringify({
                type: "FILE_UPLOAD",
                sender: username,
                filename,
                data: fileData,
              }));
            },
            "/download": () => {
              const filename = args.join(" ");
              if (!filename) return console.log(chalk.red("Usage: /download <filename>"));
              clientSocket.write(JSON.stringify({
                type: "FILE_DOWNLOAD",
                filename,
              }));
            },
            "/sendfile": () => {
  const [recipient, filepath] = args;
  if (!recipient || !filepath) {
    console.log(chalk.red("Usage: /sendfile <username> <filepath>"));
    rl.prompt();
    return;
  }

  if (!fs.existsSync(filepath)) {
    console.log(chalk.red("File does not exist"));
    rl.prompt();
    return;
  }

  const fileData = fs.readFileSync(filepath).toString("base64");
  const filename = path.basename(filepath);

  clientSocket.write(JSON.stringify({
    type: "SEND_FILE",
    sender: username,
    recipient,
    filename,
    data: fileData
  }) + "\n");
},

            "/exit": () => {
              rl.close();
              clientSocket.end();
            },
            default: () => {
              console.log(chalk.red("Unknown command. Use /help"));
              rl.prompt();
            }
          };

          (commands[cmd] || commands.default)();
        }
      });
    });
  });
}
