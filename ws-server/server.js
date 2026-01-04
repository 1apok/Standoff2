import { createServer } from 'http';
import { Server } from 'socket.io';

// Простой матчмейкинг 1v1: ставим игрока в очередь и собираем дуэльную комнату.
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

let waitingSocket = null;
let matchCounter = 1;

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

  socket.on('leaveMatch', () => leaveMatch(socket));

  socket.on('disconnect', () => {
    leaveMatch(socket);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`WS server on ${PORT}`));

