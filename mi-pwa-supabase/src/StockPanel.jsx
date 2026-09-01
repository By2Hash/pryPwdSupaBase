// src/StockPanel.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { syncProducts } from './syncService';
import { Html5Qrcode } from 'html5-qrcode';

const EMPTY_FORM = { name: '', category: '', quantity: 1, price: 0, barcode: '' };
const SCANNER_ID = 'barcode-scanner-region';

export default function StockPanel() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scanMsg, setScanMsg] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [usbScanner, setUsbScanner] = useState(false);
  const html5QrCodeRef = useRef(null);
  const scanBufferRef = useRef('');
  const scanTimestampsRef = useRef([]);

  const products = useLiveQuery(() => db.products.toArray());

  const filtered = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  ) || [];

  const showScanFeedback = (msg, type) => {
    setScanMsg({ text: msg, type });
    setTimeout(() => setScanMsg(null), 4000);
  };

  const processBarcode = useCallback(async (code) => {
    const existing = await db.products.where('barcode').equals(code).first();

    if (existing) {
      const newQty = existing.quantity + 1;
      await db.products.update(existing.id, {
        quantity: newQty,
        sync_status: existing.remote_id ? 'pending_update' : existing.sync_status
      });
      await syncProducts();
      showScanFeedback(`+1 "${existing.name}" → Stock: ${newQty}`, 'success');
    } else {
      setEditingProduct(null);
      setForm({ ...EMPTY_FORM, barcode: code });
      setShowModal(true);
    }
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setCameraOpen(true);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(SCANNER_ID);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.5
          },
          async (decodedText) => {
            await processBarcode(decodedText);
            await stopCamera();
          },
          () => {}
        );
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError('No se pudo acceder a la cámara. Verificá los permisos.');
        setCameraOpen(false);
      }
    }, 100);
  };

  const stopCamera = async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping camera:', err);
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          if (state === 2) {
            html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch {}
      }
    };
  }, []);

  // Detectar lector USB por velocidad de typing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showModal) return;

      const now = Date.now();
      const timestamps = scanTimestampsRef.current;

      if (e.key === 'Enter' && scanBufferRef.current.length > 3) {
        const code = scanBufferRef.current;
        scanBufferRef.current = '';
        scanTimestampsRef.current = [];

        if (!usbScanner) {
          setUsbScanner(true);
        }

        processBarcode(code);
        return;
      }

      if (e.key.length === 1) {
        const lastTime = timestamps[timestamps.length - 1] || 0;
        const gap = now - lastTime;

        if (gap < 80) {
          scanBufferRef.current += e.key;
          timestamps.push(now);

          if (timestamps.length > 5 && !usbScanner) {
            setUsbScanner(true);
          }
        } else {
          scanBufferRef.current = e.key;
          scanTimestampsRef.current = [now];
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, usbScanner, processBarcode]);

  const openAdd = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      quantity: product.quantity,
      price: product.price,
      barcode: product.barcode || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editingProduct) {
      await db.products.update(editingProduct.id, {
        name: form.name.trim(),
        category: form.category.trim(),
        quantity: Number(form.quantity),
        price: Number(form.price),
        barcode: form.barcode.trim(),
        sync_status: 'pending_update'
      });
    } else {
      await db.products.add({
        uuid: crypto.randomUUID(),
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        quantity: Number(form.quantity),
        price: Number(form.price),
        remote_id: null,
        sync_status: 'pending_insert'
      });
    }

    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditingProduct(null);
    await syncProducts();
  };

  const handleDelete = async (product) => {
    await db.products.delete(product.id);
    await syncProducts();
  };

  const handleQuantityChange = async (product, delta) => {
    const newQty = Math.max(0, product.quantity + delta);
    await db.products.update(product.id, {
      quantity: newQty,
      sync_status: product.remote_id ? 'pending_update' : product.sync_status
    });
    await syncProducts();
  };

  const handleSetQuantity = async (product, value) => {
    const newQty = Math.max(0, Number(value) || 0);
    await db.products.update(product.id, {
      quantity: newQty,
      sync_status: product.remote_id ? 'pending_update' : product.sync_status
    });
    await syncProducts();
  };

  return (
    <div className="stock-panel">
      <div className="stock-header">
        <div className="stock-header-left">
          <h2 className="stock-title">Stock del Kiosco</h2>
          <span className="stock-count">{filtered.length} productos</span>
        </div>
        <div className="stock-header-actions">
          {!usbScanner && (
            <button className="stock-btn-scan" onClick={cameraOpen ? stopCamera : startCamera}>
              <span className="scan-btn-icon">{cameraOpen ? '✕' : '⊞'}</span>
              {cameraOpen ? 'Cerrar Camara' : 'Escanear Codigo'}
            </button>
          )}
          {usbScanner && (
            <span className="usb-scanner-badge">⌨ Lector USB conectado</span>
          )}
          <button className="stock-btn-add" onClick={openAdd}>+ Nuevo Producto</button>
        </div>
      </div>

      {/* CAMARA ESCANER */}
      {cameraOpen && (
        <div className="camera-zone">
          <div id={SCANNER_ID} className="camera-viewfinder" />
          <p className="camera-hint">Apunta la camara al codigo de barras</p>
        </div>
      )}

      {cameraError && (
        <div className="scanner-msg scanner-msg-error">⚠ {cameraError}</div>
      )}

      {scanMsg && (
        <div className={`scanner-msg scanner-msg-${scanMsg.type}`}>
          {scanMsg.type === 'success' ? '✓' : 'ℹ'} {scanMsg.text}
        </div>
      )}

      <div className="stock-search-bar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, categoria o codigo..."
          className="stock-search"
        />
      </div>

      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Producto</th>
              <th>Categoria</th>
              <th className="th-center">Stock</th>
              <th className="th-right">Precio</th>
              <th className="th-center">Estado</th>
              <th className="th-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" className="stock-empty">
                  {products?.length === 0 ? 'No hay productos — escanea o agrega uno' : 'No se encontraron resultados'}
                </td>
              </tr>
            )}
            {filtered.map((product) => (
              <tr key={product.id} className={product.quantity === 0 ? 'stock-row-low' : ''}>
                <td className="stock-cell-barcode">
                  {product.barcode ? (
                    <span className="barcode-tag">{product.barcode}</span>
                  ) : (
                    <span className="barcode-none">—</span>
                  )}
                </td>
                <td className="stock-cell-name">{product.name}</td>
                <td>
                  <span className="stock-category-badge">{product.category || 'Sin categoria'}</span>
                </td>
                <td className="stock-cell-qty">
                  <div className="qty-controls">
                    <button className="qty-btn" onClick={() => handleQuantityChange(product, -1)}>−</button>
                    <input
                      type="number"
                      value={product.quantity}
                      onChange={(e) => handleSetQuantity(product, e.target.value)}
                      className="qty-input"
                      min="0"
                    />
                    <button className="qty-btn" onClick={() => handleQuantityChange(product, 1)}>+</button>
                  </div>
                </td>
                <td className="stock-cell-price">
                  ${product.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="stock-cell-status">
                  {product.sync_status === 'synced' ? (
                    <span className="status-synced">Sync</span>
                  ) : (
                    <span className="status-pending">Pend</span>
                  )}
                </td>
                <td className="stock-cell-actions">
                  <button className="stock-action-edit" onClick={() => openEdit(product)} title="Editar">✎</button>
                  <button className="stock-action-delete" onClick={() => handleDelete(product)} title="Eliminar">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="stock-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="stock-modal-title">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              {form.barcode && <span className="modal-barcode-hint">Codigo: {form.barcode}</span>}
            </h3>
            <form onSubmit={handleSave} className="stock-modal-form">
              {form.barcode && (
                <label className="stock-label">
                  Codigo de barras
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="stock-modal-input"
                    placeholder="Codigo leido del escaner"
                  />
                </label>
              )}
              <label className="stock-label">
                Nombre del producto *
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="stock-modal-input"
                  placeholder="Ej: Galletas Furiosas"
                  autoFocus
                  required
                />
              </label>
              <label className="stock-label">
                Categoria
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="stock-modal-input"
                  placeholder="Ej: Golosinas, Bebidas, Lacteos..."
                />
              </label>
              <div className="stock-modal-row">
                <label className="stock-label">
                  Cantidad
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="stock-modal-input"
                    min="0"
                  />
                </label>
                <label className="stock-label">
                  Precio ($)
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="stock-modal-input"
                    min="0"
                    step="0.01"
                  />
                </label>
              </div>
              <div className="stock-modal-actions">
                <button type="button" className="stock-modal-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="stock-modal-save">{editingProduct ? 'Guardar Cambios' : 'Agregar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
