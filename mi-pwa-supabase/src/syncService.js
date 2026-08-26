// src/syncService.js
import { db } from './db';
import { supabase } from './supabaseClient';

// Variable global para evitar ejecuciones simultáneas de la sincronización
let isSyncing = false;

export async function syncWithSupabase() {
  // 1. Evitar ejecuciones si no hay red o si ya hay un proceso de sync corriendo
  if (!navigator.onLine || isSyncing) return;

  isSyncing = true;

  try {
    // 2. Obtener solo los registros pendientes
    const pendingInserts = await db.todos
      .where('sync_status')
      .equals('pending_insert')
      .toArray();

    for (const item of pendingInserts) {
      // Marcar temporalmente en proceso para evitar reintentos paralelos
      await db.todos.update(item.id, { sync_status: 'syncing' });

      const { data, error } = await supabase
        .from('todolist')
        .insert([
          { 
            title: item.title,
            is_complete: false
          }
        ])
        .select();

      if (error) {
        console.error('Error de Supabase:', error.message);
        // Si falla, revertimos el estado a pending_insert para reintentar luego
        await db.todos.update(item.id, { sync_status: 'pending_insert' });
        continue;
      }

      if (data && data.length > 0) {
        // Actualización exitosa a sincronizado
        await db.todos.update(item.id, {
          remote_id: data[0].id,
          sync_status: 'synced'
        });
      }
    }

    // 3. Traer datos de Supabase a local
    const { data: remoteData, error: fetchError } = await supabase
      .from('todolist')
      .select('*');

    if (!fetchError && remoteData) {
      for (const remoteItem of remoteData) {
        const localItem = await db.todos.where('remote_id').equals(remoteItem.id).first();
        if (!localItem) {
          await db.todos.add({
            remote_id: remoteItem.id,
            title: remoteItem.title,
            sync_status: 'synced'
          });
        }
      }
    }
  } catch (err) {
    console.error('Error general durante la sincronización:', err);
  } finally {
    // Liberar el bloqueo al finalizar todo el ciclo
    isSyncing = false;
  }
}

// Escuchador de red
window.addEventListener('online', () => {
  syncWithSupabase();
});