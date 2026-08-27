// src/App.jsx
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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

    // 1. Guardar localmente INCLUYENDO EL UUID ÚNICO
    await db.todos.add({
      uuid: crypto.randomUUID(), // <-- Clave para evitar duplicados
      title: title.trim(),
      is_complete: false,
      remote_id: null,
      sync_status: 'pending_insert'
    });

    setTitle('');

    // 2. Intentar sincronizar con Supabase
    syncWithSupabase();
  };

  const handleToggleComplete = async (todo) => {
    const nextState = !todo.is_complete;
    
    await db.todos.update(todo.id, {
      is_complete: nextState,
      sync_status: todo.remote_id ? 'pending_update' : todo.sync_status
    });

    syncWithSupabase();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Mi PWA Offline-First</h1>
      
      <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          placeholder="Escribe una tarea..."
          style={{ flex: 1, padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 16px' }}>Guardar</button>
      </form>

      <h3>Lista de Tareas:</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos?.map((todo) => (
          <li key={todo.id} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="checkbox" 
              checked={todo.is_complete || false} 
              onChange={() => handleToggleComplete(todo)}
            />
            <span style={{ textDecoration: todo.is_complete ? 'line-through' : 'none' }}>
              {todo.title}
            </span>
            {' '}
            {todo.sync_status === 'synced' ? (
              <span style={{ color: 'green', fontSize: '12px' }}>✓ (Sincronizado)</span>
            ) : (
              <span style={{ color: 'orange', fontSize: '12px' }}>⏳ (Pendiente offline)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}