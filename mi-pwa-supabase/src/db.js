// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('TodoDB');

db.version(1).stores({
  todos: '++id, uuid, remote_id, title, is_complete, sync_status',
});

db.version(2).stores({
  todos: '++id, uuid, remote_id, title, is_complete, sync_status, panel',
}).upgrade(async (tx) => {
  await tx.table('todos').toCollection().modify((todo) => {
    if (!todo.panel) todo.panel = 1;
  });
});

db.version(3).stores({
  todos: '++id, uuid, remote_id, title, is_complete, sync_status, panel, caja, cajero',
}).upgrade(async (tx) => {
  await tx.table('todos').toCollection().modify((todo) => {
    if (!todo.caja) todo.caja = todo.panel || 1;
    if (!todo.cajero) todo.cajero = '';
  });
});

db.version(4).stores({
  todos: '++id, uuid, remote_id, title, is_complete, sync_status, panel, caja, cajero',
  products: '++id, uuid, name, category, quantity, price, sync_status',
});

db.version(5).stores({
  todos: '++id, uuid, remote_id, title, is_complete, sync_status, panel, caja, cajero',
  products: '++id, uuid, barcode, name, category, quantity, price, sync_status',
});
