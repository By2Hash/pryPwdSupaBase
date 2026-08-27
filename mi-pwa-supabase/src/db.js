// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('TodoDB');

db.version(1).stores({
  todos: '++id, uuid, remote_id, title, is_complete, sync_status',
});