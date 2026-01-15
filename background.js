// Функция для сортировки вкладок
function sortTabs(tabs, method = 'byFavicon') {
  // Методы сортировки
  const sortMethods = {
    byTitle: (a, b) => a.title.localeCompare(b.title),
    byDomain: (a, b) => {
      try {
        const domainA = new URL(a.url).hostname;
        const domainB = new URL(b.url).hostname;
        return domainA.localeCompare(domainB) || a.title.localeCompare(b.title);
      } catch (e) {
        // Если URL некорректный, сортируем по заголовку
        return a.title.localeCompare(b.title);
      }
    },
    byLastAccessed: (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
    byFavicon: (a, b) => {
      const iconComparison = (a.favIconUrl || "").localeCompare(b.favIconUrl || "");
      return iconComparison !== 0 ? iconComparison : a.title.localeCompare(b.title);
    },
    byProtocol: (a, b) => {
      try {
        const protocolA = new URL(a.url).protocol;
        const protocolB = new URL(b.url).protocol;
        return protocolA.localeCompare(protocolB) || a.title.localeCompare(b.title);
      } catch (e) {
        // Если URL некорректный, сортируем по заголовку
        return a.title.localeCompare(b.title);
      }
    }
  };

  // Проверяем, что метод сортировки существует
  if (!sortMethods[method]) {
    console.warn(`Метод сортировки ${method} не найден, используем byFavicon`);
    method = 'byFavicon';
  }
  
  // Создаем копию массива, чтобы не мутировать оригинальный
  return [...tabs].sort(sortMethods[method]);
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({}, async (tabs) => {
    // Сортируем вкладки по favicon (как в оригинальной реализации)
    const sortedTabs = sortTabs(tabs, 'byFavicon');

    // Перемещаем вкладки в соответствии с новым порядком
    for (let i = 0; i < sortedTabs.length; i++) {
      await chrome.tabs.move(sortedTabs[i].id, { index: i });
    }

    // Показываем уведомление об успешной сортировке
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon128.png",
      title: "Tab Sorter",
      message: `Вкладки успешно отсортированы! (${sortedTabs.length} вкладок)`
    });
  });
});
