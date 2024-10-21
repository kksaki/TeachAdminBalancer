// Setup basic express serversource env/bin/activate
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const port = process.env.PORT || 3000;


// const cors = require('cors');
// app.use(cors());
const io = require('socket.io')(server, {
  cors: {
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

// 全局用户列表，存储所有已登录的用户
const users = [];


// 启动服务器
server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));


// Chatroom
let numUsers = 0;

io.on('connection', (socket) => {
  let addedUser = false;

  console.log('新用户连接');

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;

    // 将用户添加到全局用户列表中
    users.push({ username });

    // 向当前用户发送登录成功的信息
    socket.emit('login', {
      numUsers: numUsers
    });

    // 向所有用户广播更新后的用户列表
    io.emit('userList', users);  // 这里广播完整的用户列表

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;

      // 在用户断开连接时，从 users 数组中移除该用户
      users.splice(users.findIndex(user => user.username === socket.username), 1);

      // 向所有用户广播更新后的用户列表
      io.emit('userList', users);

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

  // 监听客户端发送的login请求（如果你要区分登录逻辑）
  socket.on('login', (data) => {
    let user = users.find(item => item.username === data.username);
    if (user) {
      // 如果用户已经存在，返回登录失败
      socket.emit('loginError', { msg: '登录失败' });
    } else {
      // 用户不存在，登录成功并添加到用户列表
      users.push(data);
      socket.emit('loginSuccess', data);

      // 广播消息，有人加入到聊天室
      io.emit('addUser', data);

      // 广播完整的用户列表
      io.emit('userList', users);
    }
  });
});
