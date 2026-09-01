// src/syncService.js
import { db } from './db';
import { supabase } from './supabaseClient';

let isSyncingTodos = false;
let isSyncingProducts = false;

// =============================================
// SYNC DE TODOS (VENTAS)
// =============================================
export async function syncWithSupabase() {
  if (!navigator.onLine || isSyncingTodos) return;

  isSyncingTodos = true;

  try {
    const pendingInserts = await db.todos
      .where('sync_status')
      .equals('pending_insert')
      .toArray();

    for (const item of pendingInserts) {
      await db.todos.update(item.id, { sync_status: 'syncing' });

      const { data, error } = await supabase
        .from('todolist')
        .upsert(
          [
            {
              uuid: item.uuid,
              title: item.title,
              is_complete: item.is_complete || false,
              caja: item.caja || item.panel || 1
            }
          ],
          { onConflict: 'uuid' }
        )
        .select();

      if (error) {
        console.error('Error enviando venta a Supabase:', error.message);
        await db.todos.update(item.id, { sync_status: 'pending_insert' });
        continue;
      }

      if (data && data.length > 0) {
        await db.todos.update(item.id, {
          remote_id: data[0].id,
          sync_status: 'synced'
        });
      }
    }

    const pendingUpdates = await db.todos
      .where('sync_status')
      .equals('pending_update')
      .toArray();

    for (const item of pendingUpdates) {
      if (!item.uuid) continue;

      const { error } = await supabase
        .from('todolist')
        .update({ is_complete: item.is_complete })
        .eq('uuid', item.uuid);

      if (!error) {
        await db.todos.update(item.id, { sync_status: 'synced' });
      }
    }

    const { data: remoteData, error: fetchError } = await supabase
      .from('todolist')
      .select('*');

    if (!fetchError && remoteData) {
      for (const remoteItem of remoteData) {
        if (!remoteItem.uuid) continue;

        const localItem = await db.todos
          .where('uuid')
          .equals(remoteItem.uuid)
          .first();

        if (!localItem) {
          await db.todos.add({
            uuid: remoteItem.uuid,
            remote_id: remoteItem.id,
            title: remoteItem.title,
            is_complete: remoteItem.is_complete || false,
            sync_status: 'synced',
            panel: remoteItem.caja || 1,
            caja: remoteItem.caja || 1,
            cajero: remoteItem.cajero || ''
          });
        } else if (localItem.sync_status === 'synced') {
          await db.todos.update(localItem.id, {
            is_complete: remoteItem.is_complete
          });
        }
      }
    }
  } catch (err) {
    console.error('Error general de sincronización (todos):', err);
  } finally {
    isSyncingTodos = false;
  }
}

// =============================================
// SYNC DE PRODUCTS (STOCK)
// =============================================
export async function syncProducts() {
  if (!navigator.onLine || isSyncingProducts) return;

  isSyncingProducts = true;

  try {
    const pendingInserts = await db.products
      .where('sync_status')
      .equals('pending_insert')
      .toArray();

    for (const item of pendingInserts) {
      await db.products.update(item.id, { sync_status: 'syncing' });

      const { data, error } = await supabase
        .from('products')
        .upsert(
          [
            {
              uuid: item.uuid,
              barcode: item.barcode || '',
              name: item.name,
              category: item.category || '',
              quantity: item.quantity || 0,
              price: item.price || 0
            }
          ],
          { onConflict: 'uuid' }
        )
        .select();

      if (error) {
        console.error('Error enviando producto a Supabase:', error.message);
        await db.products.update(item.id, { sync_status: 'pending_insert' });
        continue;
      }

      if (data && data.length > 0) {
        await db.products.update(item.id, {
          remote_id: data[0].id,
          sync_status: 'synced'
        });
      }
    }

    const pendingUpdates = await db.products
      .where('sync_status')
      .equals('pending_update')
      .toArray();

    for (const item of pendingUpdates) {
      if (!item.uuid) continue;

      const { error } = await supabase
        .from('products')
        .update({
          barcode: item.barcode || '',
          name: item.name,
          category: item.category || '',
          quantity: item.quantity || 0,
          price: item.price || 0
        })
        .eq('uuid', item.uuid);

      if (!error) {
        await db.products.update(item.id, { sync_status: 'synced' });
      }
    }

    const { data: remoteData, error: fetchError } = await supabase
      .from('products')
      .select('*');

    if (!fetchError && remoteData) {
      for (const remoteItem of remoteData) {
        if (!remoteItem.uuid) continue;

        const localItem = await db.products
          .where('uuid')
          .equals(remoteItem.uuid)
          .first();

        if (!localItem) {
          await db.products.add({
            uuid: remoteItem.uuid,
            remote_id: remoteItem.id,
            barcode: remoteItem.barcode || '',
            name: remoteItem.name,
            category: remoteItem.category || '',
            quantity: remoteItem.quantity || 0,
            price: remoteItem.price || 0,
            sync_status: 'synced'
          });
        } else if (localItem.sync_status === 'synced') {
          await db.products.update(localItem.id, {
            barcode: remoteItem.barcode || '',
            name: remoteItem.name,
            category: remoteItem.category || '',
            quantity: remoteItem.quantity || 0,
            price: remoteItem.price || 0
          });
        }
      }
    }
  } catch (err) {
    console.error('Error general de sincronización (products):', err);
  } finally {
    isSyncingProducts = false;
  }
}

window.addEventListener('online', () => {
  syncWithSupabase();
  syncProducts();
});
