const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "users.json");

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function registerUser(username, password) {
  const users = loadUsers();
  if (users[username]) {
    return false; // Username already exists
  }
  users[username] = { password };
  saveUsers(users);
  return true;
}

function userExists(username) {
  const users = loadUsers();
  return !!users[username];
}

function validateUser(username, password) {
  const users = loadUsers();
  return users[username] && users[username].password === password;
}

module.exports = { registerUser, userExists, validateUser };
