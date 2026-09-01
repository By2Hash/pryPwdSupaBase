// src/TodoList.jsx
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { syncWithSupabase } from './syncService';

export default function TodoList({ panel, cashierName, onCashierNameChange }) {
  const [newTodo, setNewTodo] = useState('');
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState(cashierName);

  const todos = useLiveQuery(() => db.todos.where('panel').equals(panel).toArray());

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    await db.todos.add({
      uuid: crypto.randomUUID(),
      title: newTodo.trim(),
      is_complete: false,
      remote_id: null,
      sync_status: 'pending_insert',
      panel,
      caja: panel,
      cajero: cashierName || ''
    });

    setNewTodo('');
    await syncWithSupabase();
  };

  const handleToggleComplete = async (todo) => {
    const nextState = !todo.is_complete;
    await db.todos.update(todo.id, {
      is_complete: nextState,
      sync_status: todo.remote_id ? 'pending_update' : todo.sync_status
    });
    await syncWithSupabase();
  };

  const handleDelete = async (todo) => {
    await db.todos.delete(todo.id);
    await syncWithSupabase();
  };

  const handleSaveName = () => {
    const name = tempName.trim();
    onCashierNameChange(name);
    setEditing(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') {
      setTempName(cashierName);
      setEditing(false);
    }
  };

  return (
    <div className="todo-panel">
      <div className="todo-panel-header">
        <span className="todo-caja-badge">Caja {panel}</span>
        {editing ? (
          <div className="cashier-edit">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleSaveName}
              placeholder="Nombre de cajera..."
              className="cashier-input"
              autoFocus
            />
          </div>
        ) : (
          <h2
            className="todo-panel-title"
            onClick={() => { setTempName(cashierName); setEditing(true); }}
            title="Click para cambiar nombre"
          >
            {cashierName || 'Click para poner tu nombre'}
            <span className="edit-icon">✎</span>
          </h2>
        )}
      </div>

      <form onSubmit={handleAddTodo} className="todo-form">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Escribe una venta..."
          className="todo-input"
        />
        <button type="submit" className="todo-btn-add">+</button>
      </form>

      <ul className="todo-list">
        {todos?.map((todo) => (
          <li key={todo.id} className="todo-item">
            <input
              type="checkbox"
              checked={todo.is_complete || false}
              onChange={() => handleToggleComplete(todo)}
              className="todo-checkbox"
            />
            <span className={`todo-text ${todo.is_complete ? 'todo-done' : ''}`}>
              {todo.title}
            </span>
            <span className={`todo-status ${todo.sync_status === 'synced' ? 'status-synced' : 'status-pending'}`}>
              {todo.sync_status === 'synced' ? '✓' : '⏳'}
            </span>
            <button onClick={() => handleDelete(todo)} className="todo-btn-delete">×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
