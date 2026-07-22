console.log('database.js loading...');

// Модуль для работы с базой данных (IndexedDB) расширения
const DB_NAME = 'TabSorterDB';
const DB_VERSION = 2;
const STORE_NAME = 'savedTabs';
const MEMORY_STORE_NAME = 'memoryTabs';

console.log('Checking IndexedDB support:', typeof indexedDB);

/**
 * Открывает базу данных и возвращает Promise с экземпляром DB.
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('url', 'url', { unique: false });
                store.createIndex('visitDate', 'visitDate', { unique: false });
                store.createIndex('domain', 'domain', { unique: false });
            }
            if (!db.objectStoreNames.contains(MEMORY_STORE_NAME)) {
                const memoryStore = db.createObjectStore(MEMORY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                memoryStore.createIndex('url', 'url', { unique: false });
                memoryStore.createIndex('addedDate', 'addedDate', { unique: false });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Сохраняет вкладку в базу данных.
 * @param {Object} tabData - Данные вкладки { url, title, favIconUrl, lastAccessed, description }
 * @returns {Promise<number>} ID сохранённой записи
 */
async function saveTab(tabData) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Определяем домен с обработкой ошибок
        let domain = '';
        try {
            domain = new URL(tabData.url).hostname;
        } catch (e) {
            // Если URL некорректен (например, chrome://, about:), оставляем пустым
            domain = 'protected';
        }
        
        const record = {
            url: tabData.url,
            title: tabData.title || '',
            favIconUrl: tabData.favIconUrl || '',
            lastAccessed: tabData.lastAccessed || Date.now(),
            visitDate: new Date().toISOString(),
            domain: domain,
            description: tabData.description || ''
        };
        const request = store.add(record);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Сохраняет массив вкладок в базу данных.
 * @param {Array<Object>} tabs - Массив объектов вкладок
 * @returns {Promise<Array<number>>} Массив ID сохранённых записей
 */
async function saveTabs(tabs) {
    const ids = [];
    for (const tab of tabs) {
        try {
            const id = await saveTab(tab);
            ids.push(id);
        } catch (error) {
            // Не выводим ошибку в консоль, только предупреждение
            console.warn('Ошибка сохранения вкладки:', tab.url, error.message);
        }
    }
    return ids;
}

/**
 * Получает все сохранённые вкладки из базы данных.
 * @param {Object} options - Опции фильтрации и сортировки
 * @param {string} options.sortBy - Поле для сортировки ('visitDate', 'url', 'title')
 * @param {boolean} options.descending - По убыванию
 * @param {number} options.limit - Ограничение количества записей
 * @returns {Promise<Array<Object>>} Массив записей
 */
async function getAllTabs(options = {}) {
    const { sortBy = 'visitDate', descending = true, limit } = options;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index(sortBy);
        const request = index.openCursor(null, descending ? 'prev' : 'next');
        const results = [];
        let count = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && (limit === undefined || count < limit)) {
                results.push(cursor.value);
                count++;
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Удаляет запись по ID.
 * @param {number} id
 * @returns {Promise<void>}
 */
async function deleteTab(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Очищает всю базу данных.
 * @returns {Promise<void>}
 */
async function clearDatabase() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Получает количество записей в базе.
 * @returns {Promise<number>}
 */
async function getCount() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function saveToMemory(tabData) {
    console.log('saveToMemory called with:', tabData);
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MEMORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(MEMORY_STORE_NAME);

        let domain = '';
        try {
            domain = new URL(tabData.url).hostname;
        } catch (e) {
            domain = 'protected';
        }

        const record = {
            url: tabData.url,
            title: tabData.title || '',
            favIconUrl: tabData.favIconUrl || '',
            addedDate: new Date().toISOString(),
            domain: domain,
            description: tabData.description || ''
        };
        console.log('Saving to memory store:', record);
        const request = store.add(record);

        request.onsuccess = () => {
            console.log('Memory saved, id:', request.result);
            resolve(request.result);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getMemoryTabs(options = {}) {
    const { sortBy = 'addedDate', descending = true, limit } = options;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MEMORY_STORE_NAME], 'readonly');
        const store = transaction.objectStore(MEMORY_STORE_NAME);
        const index = store.index(sortBy);
        const request = index.openCursor(null, descending ? 'prev' : 'next');
        const results = [];
        let count = 0;

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && (limit === undefined || count < limit)) {
                results.push(cursor.value);
                count++;
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteFromMemory(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MEMORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(MEMORY_STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function clearMemory() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MEMORY_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(MEMORY_STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getMemoryCount() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MEMORY_STORE_NAME], 'readonly');
        const store = transaction.objectStore(MEMORY_STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Экспортируем функции в глобальную область видимости
window.TabSorterDB = {
    saveTab,
    saveTabs,
    getAllTabs,
    deleteTab,
    clearDatabase,
    getCount,
    saveToMemory,
    getMemoryTabs,
    deleteFromMemory,
    clearMemory,
    getMemoryCount
};