// src/syncService.js
import { db } from './db';
import { supabase } from './supabaseClient';

let isSyncing = false;

export async function syncWithSupabase() {
  if (!navigator.onLine || isSyncing) return;

  isSyncing = true;

  try {
    // -----------------------------------------------------------
    // 1. SINCRONIZAR INSERCIONES PENDIENTES (LOCAL -> NUBE)
    // -----------------------------------------------------------
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
              is_complete: item.is_complete || false
            }
          ],
          { onConflict: 'uuid' }
        )
        .select();

      if (error) {
        console.error('Error enviando a Supabase:', error.message);
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

    // -----------------------------------------------------------
    // 2. SINCRONIZAR ACTUALIZACIONES PENDIENTES (CHECKBOX: IS_COMPLETE)
    // -----------------------------------------------------------
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

    // -----------------------------------------------------------
    // 3. DESCARGAR REGISTROS REMOTOS (NUBE -> LOCAL)
    // -----------------------------------------------------------
    const { data: remoteData, error: fetchError } = await supabase
      .from('todolist')
      .select('*');

    if (!fetchError && remoteData) {
      for (const remoteItem of remoteData) {
        // Ignorar filas antiguas de Supabase que no tengan columna uuid asignada
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
            sync_status: 'synced'
          });
        } else if (localItem.sync_status === 'synced') {
          // Si ya existe en local y no tiene cambios pendientes localmente, actualizamos su estado
          await db.todos.update(localItem.id, {
            is_complete: remoteItem.is_complete
          });
        }
      }
    }
  } catch (err) {
    console.error('Error general de sincronización:', err);
  } finally {
    isSyncing = false;
  }
}

window.addEventListener('online', () => {
  syncWithSupabase();
});