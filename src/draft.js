/* Последний черновик: только локальный IndexedDB, исходные Blob без перекодирования. */
(function () {
  let opening;
  function db() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const req = indexedDB.open('route-story-drafts', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('drafts');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Хранилище занято другой вкладкой'));
    });
    return opening;
  }
  async function run(mode, action) {
    const conn = await db();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction('drafts', mode), req = action(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error || req.error || new Error('Не удалось сохранить черновик'));
    });
  }
  window.RSDrafts = {
    save: data => run('readwrite', store => store.put(data, 'last')),
    load: () => run('readonly', store => store.get('last')),
    remove: () => run('readwrite', store => store.delete('last')),
  };
})();
