import { createServer } from 'http';
import { Server } from 'socket.io';

// Простой матчмейкинг 1v1 + быстрые комнаты FFA / Team / Sandbox.
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

let waitingSocket = null;
let matchCounter = 1;
let ffaCounter = 0;
let teamCounter = 0;
const sandboxObjects = [];

function leaveMatch(socket) {
  if (waitingSocket && waitingSocket.id === socket.id) {
    waitingSocket = null;
  }
  const room = socket.data?.room;
  if (room) {
    socket.to(room).emit('leave', { id: socket.id });
    socket.leave(room);
    socket.data.room = null;
  }
}

io.on('connection', (socket) => {
  socket.data = socket.data || {};

  socket.on('join1v1', () => {
    // Если уже где-то числится - выходим
    leaveMatch(socket);

    if (waitingSocket && waitingSocket.connected) {
      const opponent = waitingSocket;
      waitingSocket = null;
      const room = `match-${matchCounter++}`;
      opponent.join(room);
      socket.join(room);
      opponent.data.room = room;
      socket.data.room = room;

      opponent.emit('matchFound', { room, spawnIndex: 0, opponentId: socket.id });
      socket.emit('matchFound', { room, spawnIndex: 1, opponentId: opponent.id });
    } else {
      waitingSocket = socket;
      socket.emit('waiting');
    }
  });

  socket.on('joinFFA', () => {
    leaveMatch(socket);
    const room = 'ffa-arena';
    socket.join(room);
    socket.data.room = room;
    const spawnIndex = ffaCounter++ % 16;
    socket.emit('ffaJoined', { room, spawnIndex });
  });

  socket.on('joinTeam', () => {
    leaveMatch(socket);
    const room = 'team-arena';
    socket.join(room);
    socket.data.room = room;
    const spawnIndex = teamCounter++ % 10;
    const team = spawnIndex < 5 ? 'blue' : 'red';
    socket.emit('teamJoined', { room, spawnIndex, team });
  });

  socket.on('joinSandbox', () => {
    leaveMatch(socket);
    const room = 'sandbox';
    socket.join(room);
    socket.data.room = room;
    socket.emit('sandboxJoined', { room, objects: sandboxObjects });
  });

  socket.on('state', (data) => {
    const room = socket.data?.room;
    if (!room) return;
    socket.to(room).emit('state', { ...data, id: socket.id });
  });

  socket.on('shoot', (data) => {
    const room = socket.data?.room;
    if (!room) return;
    socket.to(room).emit('shoot', { ...data, id: socket.id });
  });

  socket.on('hit', (data) => {
    const room = socket.data?.room;
    if (!room) return;
    socket.to(room).emit('hit', { ...data, shooterId: socket.id });
  });

  socket.on('respawn', (data) => {
    const room = socket.data?.room;
    if (!room) return;
    socket.to(room).emit('respawn', { ...data, id: socket.id });
  });

  socket.on('grenade', (data) => {
    const room = socket.data?.room;
    if (!room) return;
    socket.to(room).emit('grenade', { ...data, id: socket.id });
  });

  socket.on('adminMsg', (data) => {
    // Глобально на все подключения (не ограничиваем комнатой)
    io.emit('adminMsg', data);
  });

  socket.on('sandboxPlace', (data) => {
    const room = socket.data?.room;
    if (room !== 'sandbox') return;
    const obj = { ...data, id: socket.id };
    sandboxObjects.push(obj);
    socket.to(room).emit('sandboxPlace', obj);
  });

  socket.on('sandboxClear', () => {
    const room = socket.data?.room;
    if (room !== 'sandbox') return;
    sandboxObjects.length = 0;
    io.to(room).emit('sandboxClear');
  });

  socket.on('leaveMatch', () => leaveMatch(socket));

  socket.on('disconnect', () => {
    leaveMatch(socket);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`WS server on ${PORT}`));

