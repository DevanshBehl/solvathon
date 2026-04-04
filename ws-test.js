const { WebSocket } = require('ws');
const ws = new WebSocket('ws://localhost:4000');
ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'JOIN_FLOOR', payload: { hostelId: 'global', floorNumber: 0 } }));
});
ws.on('message', (data) => {
  console.log('Message:', data.toString());
});
