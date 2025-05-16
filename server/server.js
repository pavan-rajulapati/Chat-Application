const express = require("express");
const colors = require("colors");
const dbConnect = require("./db.js");
require("dotenv").config();
const path = require("path");
const { errorHandler, routeNotFound } = require("./middleware/errorMiddleware");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
dbConnect();
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/notification", notificationRoutes);

// Serve frontend
const __dirname$ = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname$, "/client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname$, "client", "build", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).json({ message: "Hello from NexChat Chat App server" });
  });
}

// Error Handling
app.use(routeNotFound);
app.use(errorHandler);

// Start server
const server = app.listen(process.env.PORT || 8000, () => {
  console.log(colors.brightMagenta(`\nServer is UP on PORT ${process.env.PORT || 8000}`));
});

// ========================= SOCKET.IO =========================

const { Server } = require("socket.io");
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: ["http://localhost:3000", "https://your-frontend.com"],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected");

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    console.log(userData.name, "connected");
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User joined room:", room);
  });

  socket.on("new message", (newMessage) => {
    const chat = newMessage.chatId;
    if (!chat.users) return;

    chat.users.forEach((user) => {
      if (user._id === newMessage.sender._id) return;
      socket.in(user._id).emit("message received", newMessage);
    });
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

