import { createServer } from 'http';
import { Server } from 'socket.io';

// Простая комната "default" без матчмейкинга
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.join('default');

  socket.on('state', (data) => {
    // Рассылаем всем, кроме отправителя
    socket.to('default').emit('state', { ...data, id: socket.id });
  });

  socket.on('shoot', (data) => {
    socket.to('default').emit('shoot', { ...data, id: socket.id });
  });

  socket.on('disconnect', () => {
    socket.to('default').emit('leave', { id: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`WS server on ${PORT}`));

