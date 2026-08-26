// src/db.js
import Dexie from 'dexie';

// Nombre de la base de datos local en la computadora del usuario
export const db = new Dexie('MiPwaSupabaseDB');

// Definimos las tablas y campos indexados
db.version(1).stores({
  todos: '++id, remote_id, title, sync_status', 
  // sync_status puede ser:
  // 'synced' -> Ya está guardado en Supabase
  // 'pending_insert' -> Creado offline, pendiente de subir
  // 'pending_delete' -> Borrado offline, pendiente de eliminar en Supabase
});