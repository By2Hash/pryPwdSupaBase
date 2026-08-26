// src/App.jsx
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks'; // Para refrescar la UI automáticamente
import { db } from './db';
import { syncWithSupabase } from './syncService';

export default function App() {
  const [title, setTitle] = useState('');

  // Escuchar cambios en la BD local en tiempo real
  const todos = useLiveQuery(() => db.todos.toArray());

  useEffect(() => {
    // Intentar sincronizar cuando cargue la app
    syncWithSupabase();
  }, []);

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 1. Guardar de inmediato en IndexedDB local
    await db.todos.add({
      title: title,
      remote_id: null,
      sync_status: 'pending_insert'
    });

    setTitle('');

    // 2. Intentar sincronizar con Supabase en segundo plano
    syncWithSupabase();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Mi PWA Offline-First</h1>
      
      <form onSubmit={handleAddTodo}>
        <input 
          type="text" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          placeholder="Escribe una tarea..."
        />
        <button type="submit">Guardar</button>
      </form>

      <h3>Lista de Tareas:</h3>
      <ul>
        {todos?.map((todo) => (
          <li key={todo.id}>
            {todo.title} {' '}
            {todo.sync_status === 'synced' ? (
              <span style={{ color: 'green' }}>✓ (Sincronizado)</span>
            ) : (
              <span style={{ color: 'orange' }}>⏳ (Pendiente offline)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}