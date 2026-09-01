// src/App.jsx
import React, { useState, useEffect } from 'react';
import { syncWithSupabase } from './syncService';
import TodoList from './TodoList';
import StockPanel from './StockPanel';
import './App.css';

const getCashierNames = () => {
  try {
    const saved = localStorage.getItem('cashierNames');
    return saved ? JSON.parse(saved) : { 1: '', 2: '' };
  } catch {
    return { 1: '', 2: '' };
  }
};

export default function App() {
  const [viewMode, setViewMode] = useState('split');
  const [activeTab, setActiveTab] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cashierNames, setCashierNames] = useState(getCashierNames);

  useEffect(() => {
    syncWithSupabase();
  }, []);

  const handleCashierNameChange = (panel, name) => {
    const updated = { ...cashierNames, [panel]: name };
    setCashierNames(updated);
    localStorage.setItem('cashierNames', JSON.stringify(updated));
  };

  const isStockView = viewMode === 'stock';

  return (
    <div className="app-layout">
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Menu"
      >
        ☰
      </button>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">✦</span>
          <span className="sidebar-brand">Kiosco</span>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => { setViewMode('split'); setSidebarOpen(false); }}
          >
            <span className="sidebar-icon">⊞</span>
            Pantalla Dividida
          </button>
          <button
            className={`sidebar-btn ${viewMode === 'tabs' ? 'active' : ''}`}
            onClick={() => { setViewMode('tabs'); setSidebarOpen(false); }}
          >
            <span className="sidebar-icon">⊟</span>
            Pestañas
          </button>
          <div className="sidebar-divider" />
          <button
            className={`sidebar-btn ${isStockView ? 'active' : ''}`}
            onClick={() => { setViewMode('stock'); setSidebarOpen(false); }}
          >
            <span className="sidebar-icon">☰</span>
            Stock
          </button>
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        {isStockView ? (
          <StockPanel />
        ) : viewMode === 'split' ? (
          <div className="split-view">
            <TodoList
              panel={1}
              cashierName={cashierNames[1]}
              onCashierNameChange={(name) => handleCashierNameChange(1, name)}
            />
            <TodoList
              panel={2}
              cashierName={cashierNames[2]}
              onCashierNameChange={(name) => handleCashierNameChange(2, name)}
            />
          </div>
        ) : (
          <div className="tabs-view">
            <div className="tabs-header">
              <button
                className={`tab-btn ${activeTab === 1 ? 'active' : ''}`}
                onClick={() => setActiveTab(1)}
              >
                Caja 1 — {cashierNames[1] || 'Sin nombre'}
              </button>
              <button
                className={`tab-btn ${activeTab === 2 ? 'active' : ''}`}
                onClick={() => setActiveTab(2)}
              >
                Caja 2 — {cashierNames[2] || 'Sin nombre'}
              </button>
            </div>
            <TodoList
              panel={activeTab}
              cashierName={cashierNames[activeTab]}
              onCashierNameChange={(name) => handleCashierNameChange(activeTab, name)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
