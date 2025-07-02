const net = require("net");
const readline = require("readline");
const chalk = require("chalk");
const figlet = require("figlet");
const fs = require("fs");
const path = require("path");

let clientSocket = null;
let pendingFiles = {}; // { sender: { filename: base64data } }

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
    if (!["register", "login"].includes(action)) {
      console.log(chalk.red("Invalid action. Use register or login."));
      rl.close();
      return;
    }

    rl.question(chalk.magenta("Enter username: "), (username) => {
      rl.question(chalk.magenta("Enter password: "), (password) => {
        clientSocket = net.createConnection(
          { port: 5000, host: "127.0.0.1" },
          () => {
            clientSocket.write(
              JSON.stringify({ type: "AUTH", action, username, password }) +
                "\n"
            );
          }
        );

        let isExiting = false;
        process.on("SIGINT", () => {
          if (isExiting) return;
          isExiting = true;
          console.log(chalk.yellow("\nDisconnecting..."));
          rl.close();
          clientSocket.end();
        });

        clientSocket.on("end", () => {
          console.log(chalk.yellow("Disconnected from server."));
          process.exit(0);
        });

        clientSocket.on("error", (err) => {
          console.error(chalk.red("Connection error:"), err.message);
          process.exit(1);
        });

        let buffer = "";

        clientSocket.on("data", (data) => {
          buffer += data.toString();
          let index;
          while ((index = buffer.indexOf("\n")) !== -1) {
            const chunk = buffer.slice(0, index);
            buffer = buffer.slice(index + 1);
            if (chunk.trim()) {
              try {
                const msg = JSON.parse(chunk);
                handleServerMessage(msg);
              } catch {
                console.log(chalk.red("Invalid message from server."));
              }
            }
          }
        });

        function handleServerMessage(msg) {
          switch (msg.type) {
            case "AUTH":
              console.log(chalk.yellow(msg.message));
              if (msg.status === "success" && action === "login") chatLoop();
              else {
                rl.close();
                clientSocket.end();
              }
              break;

            case "MESSAGE":
              const who =
                msg.sender === username
                  ? chalk.green("You")
                  : chalk.cyan(msg.sender);
              console.log(`${who}: ${msg.text}`);
              rl.prompt();
              break;

            case "PRIVATE_MESSAGE":
              if (msg.sender === username) {
                console.log(
                  chalk.green(`[PM] To ${msg.recipient}: ${msg.text}`)
                );
              } else {
                console.log(
                  chalk.yellow(`[PM] From ${msg.sender}: ${msg.text}`)
                );
              }
              rl.prompt();
              break;

            case "ROOM":
              console.log(chalk.yellow(msg.message));
              rl.prompt();
              break;

            case "ROOMS":
              console.log(
                chalk.yellow("Available rooms:"),
                msg.rooms.join(", ")
              );
              rl.prompt();
              break;

            case "ROOM_HISTORY":
              console.log(chalk.yellow(`History in '${msg.room}':`));
              msg.history.forEach((m) => {
                const tag =
                  m.sender === username
                    ? chalk.green("You")
                    : chalk.cyan(m.sender);
                console.log(`${tag}: ${m.text}`);
              });
              rl.prompt();
              break;

            case "ROOM_JOIN_REQUEST":
              console.log(
                chalk.yellow(`[Join Request] ${msg.username} → ${msg.room}`)
              );
              console.log(
                chalk.yellow(
                  `Use /approve ${msg.username} or /reject ${msg.username}`
                )
              );
              rl.prompt();
              break;

            case "USERS":
            case "WHO":
              console.log(chalk.yellow("Users in room:"), msg.users.join(", "));
              rl.prompt();
              break;

            case "FILE_SENT_NOTIFY":
              console.log(
                chalk.yellow(`${msg.sender} sent you a file: ${msg.filename}`)
              );
              pendingFiles[msg.sender] ??= {};
              pendingFiles[msg.sender][msg.filename] = msg.data;
              rl.prompt();
              break;

            case "FILE_DOWNLOAD_FAIL":
              console.log(chalk.red("Download failed: " + msg.message));
              rl.prompt();
              break;
            case "FILE_DOWNLOAD":
              const ctx = clientSocket._downloadContext;
              if (!ctx) {
                console.log(chalk.red("Received file, but no context found."));
                return;
              }

              const saveDir = path.resolve(ctx.folder);
              if (!fs.existsSync(saveDir))
                fs.mkdirSync(saveDir, { recursive: true });

              const savePath = path.join(saveDir, ctx.fname);
              fs.writeFileSync(savePath, Buffer.from(msg.data, "base64"));
              console.log(
                chalk.green(`File '${ctx.fname}' saved to ${savePath}`)
              );

              // ✅ Acknowledge back to server for cleanup
              clientSocket.write(
                JSON.stringify({
                  type: "DOWNLOAD_ACK",
                  sender: ctx.sender,
                  filename: ctx.fname,
                }) + "\n"
              );

              delete clientSocket._downloadContext;
              rl.prompt();
              break;

            default:
              console.log(chalk.gray("Unknown server message:"), msg);
              rl.prompt();
              break;
          }
        }

        function chatLoop() {
          rl.setPrompt(chalk.magenta("You: "));
          rl.prompt();

          rl.on("line", (line) => {
            const trimmed = line.trim();
            if (!trimmed) return rl.prompt();

            if (trimmed.startsWith("/")) {
              const [cmd, ...args] = trimmed.split(" ");
              handleCommand(cmd, args);
            } else {
              clientSocket.write(
                JSON.stringify({ type: "MESSAGE", text: line }) + "\n"
              );
            }
          });
        }

        function handleCommand(cmd, args) {
          switch (cmd) {
            case "/help":
              console.log(
                chalk.yellow(`
/help                      - Show help
/users, /who              - List users in current room
/rooms                    - List all rooms
/join <room>              - Join or request to join room
/approve <user>           - Approve a join request (admin)
/reject <user>            - Reject a join request (admin)
/msg <user> <msg>         - Private message
/sendfile <user> <path>   - Send file to user (they can download later)
/download <user> <file> <folder> - Download received file
/exit                     - Exit chat
              `)
              );
              break;

            case "/users":
            case "/who":
            case "/rooms":
              clientSocket.write(
                JSON.stringify({ type: "COMMAND", command: cmd.slice(1) }) +
                  "\n"
              );
              break;

            case "/join":
              if (!args[0])
                return console.log(chalk.red("Usage: /join <room>"));
              clientSocket.write(
                JSON.stringify({
                  type: "COMMAND",
                  command: "join",
                  room: args[0],
                }) + "\n"
              );
              break;

            case "/approve":
            case "/reject":
              if (!args[0])
                return console.log(chalk.red(`Usage: ${cmd} <username>`));
              clientSocket.write(
                JSON.stringify({
                  type: "COMMAND",
                  command: cmd.slice(1),
                  args,
                }) + "\n"
              );
              break;

            case "/msg":
              if (args.length < 2)
                return console.log(chalk.red("Usage: /msg <user> <message>"));
              const [recipient, ...pm] = args;
              clientSocket.write(
                JSON.stringify({
                  type: "PRIVATE_MESSAGE",
                  recipient,
                  text: pm.join(" "),
                }) + "\n"
              );
              break;

            case "/sendfile": {
              const recvUser = args[0];
              let rawPath = args.slice(1).join(" ");

              if (!recvUser || !rawPath) {
                console.log(chalk.red('Usage: /sendfile <user> "<file path>"'));
                break;
              }

              // Remove quotes if present and resolve absolute path
              rawPath = rawPath.replace(/^['"]|['"]$/g, "");
              const resolvedPath = path.resolve(rawPath);

              if (!fs.existsSync(resolvedPath)) {
                console.log(chalk.red("File not found: " + resolvedPath));
                break;
              }

              const fileData = fs.readFileSync(resolvedPath).toString("base64");
              const filename = path.basename(resolvedPath);

              clientSocket.write(
                JSON.stringify({
                  type: "SEND_FILE",
                  recipient: recvUser,
                  filename,
                  data: fileData,
                }) + "\n"
              );

              console.log(
                chalk.green(
                  `Sent file '${filename}' to ${recvUser}. They can now download it.`
                )
              );
              break;
            }

            case "/download":
              const [sender, fname, folder] = args;
              if (!sender || !fname || !folder) {
                console.log(
                  chalk.red("Usage: /download <sender> <filename> <folderpath>")
                );
                return;
              }

              // Store the folder path so we can access it when data is received
              clientSocket._downloadContext = { sender, fname, folder }; // 👈 store for later
              clientSocket.write(
                JSON.stringify({
                  type: "FILE_DOWNLOAD",
                  sender,
                  filename: fname,
                }) + "\n"
              );
              break;

            case "/exit":
              rl.close();
              clientSocket.end();
              break;

            default:
              console.log(chalk.red("Unknown command. Use /help"));
              break;
          }
          rl.prompt();
        }
      });
    });
  });
}
