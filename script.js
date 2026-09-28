/* ==============================
   1. Города и данные
   ============================== */
const cityCoordinates = {
  moscow: [55.751244, 37.618423],
  kazan: [55.796127, 49.106405],
  sochi: [43.585525, 39.723062],
  spb: [59.93428, 30.335098]
};

const cityNames = {
  moscow: "Москва",
  kazan: "Казань",
  sochi: "Сочи",
  spb: "Санкт-Петербург"
};

let map;
let pointCollection;
let multiRoute;

/* ==============================
   2. Метки доступности
   ============================== */
function addAccessibilityPoints(center) {
  const [lat, lng] = center;

  const checks = [
    {
      point: [lat + 0.004, lng - 0.006],
      preset: "islands#greenCircleDotIcon",
      title: "Доступный переход",
      text: "Съезд найден с обеих сторон дороги."
    },
    {
      point: [lat + 0.001, lng - 0.001],
      preset: "islands#orangeCircleDotIcon",
      title: "Требует проверки",
      text: "Рекомендуется уточнить состояние покрытия и бордюров."
    },
    {
      point: [lat - 0.002, lng + 0.005],
      preset: "islands#redCircleDotIcon",
      title: "Возможное препятствие",
      text: "Возможен высокий бордюр или неровное покрытие."
    }
  ];

  checks.forEach(function (item) {
    const placemark = new ymaps.Placemark(
      item.point,
      {
        balloonContentHeader: item.title,
        balloonContentBody: item.text
      },
      {
        preset: item.preset
      }
    );

    pointCollection.add(placemark);
  });
}

/* ==============================
   3. Инициализация карты
   ============================== */
function initMap() {
  map = new ymaps.Map("map", {
    center: cityCoordinates.moscow,
    zoom: 13,
    controls: ["zoomControl", "geolocationControl", "typeSelector"]
  });

  pointCollection = new ymaps.GeoObjectCollection();
  map.geoObjects.add(pointCollection);
  addAccessibilityPoints(cityCoordinates.moscow);
}

function clearMapData() {
  pointCollection.removeAll();

  if (multiRoute) {
    map.geoObjects.remove(multiRoute);
    multiRoute = null;
  }
}

/* ==============================
   4. Геокодирование адресов
   ============================== */
function geocodeAddress(address, cityName) {
  const fullAddress = address.toLowerCase().includes(cityName.toLowerCase())
    ? address
    : `${cityName}, ${address}`;

  return ymaps.geocode(fullAddress, {
    results: 1
  }).then(function (result) {
    const geoObject = result.geoObjects.get(0);

    if (!geoObject) {
      throw new Error(`Адрес не найден: ${fullAddress}`);
    }

    return geoObject.geometry.getCoordinates();
  });
}

/* ==============================
   5. Построение маршрута
   ============================== */
function buildRoute(fromAddress, toAddress, city, userType) {
  const message = document.getElementById("routeMessage");
  const resultBlock = document.getElementById("routeResult");
  const description = document.getElementById("resultDescription");
  const cityName = cityNames[city];

  clearMapData();
  resultBlock.hidden = true;
  message.textContent = "Определяю адреса на карте...";

  Promise.all([
    geocodeAddress(fromAddress, cityName),
    geocodeAddress(toAddress, cityName)
  ])
    .then(function (coordinates) {
      const fromCoordinates = coordinates[0];
      const toCoordinates = coordinates[1];

      message.textContent = "Строю пешеходный маршрут...";

      multiRoute = new ymaps.multiRouter.MultiRoute(
        {
          referencePoints: [fromCoordinates, toCoordinates],
          params: {
            routingMode: "pedestrian",
            results: 1
          }
        },
        {
          boundsAutoApply: true,
          wayPointVisible: true,
          viaPointVisible: false,
          routeActiveStrokeColor: "#a86478",
          routeActiveStrokeWidth: 6,
          routeInactiveStrokeColor: "#c8b8bc",
          routeInactiveStrokeWidth: 4
        }
      );

      map.geoObjects.add(multiRoute);
      addAccessibilityPoints(cityCoordinates[city]);

      multiRoute.model.events.add("requestsuccess", function () {
        resultBlock.hidden = false;
        description.textContent =
          `Маршрут построен через Яндекс Карты по пешеходным дорожкам. ` +
          `Метки показывают предварительную оценку доступности для категории: ` +
          `${userTypeLabel(userType)}.`;
        message.textContent =
          "Маршрут построен. Нажмите на цветные метки на карте для просмотра пояснений.";
      });

      multiRoute.model.events.add("requestfail", function (event) {
        console.error("Ошибка маршрутизатора Яндекс:", event);
        message.textContent =
          "Яндекс не смог построить маршрут между выбранными точками. Попробуйте более точный адрес.";
      });
    })
    .catch(function (error) {
      console.error("Ошибка геокодирования:", error);
      message.textContent =
        "Не удалось определить один из адресов. Уточните название места или введите адрес с улицей и номером дома.";
    });
}

function userTypeLabel(type) {
  const labels = {
    default: "по умолчанию",
    child: "ребёнок",
    stroller: "родитель с коляской",
    wheelchair: "человек на коляске",
    blind: "инвалид по зрению",
    senior: "пожилой человек"
  };

  return labels[type] || labels.default;
}

/* ==============================
   6. Форма маршрута
   ============================== */
const citySelect = document.getElementById("citySelect");
const cityStatus = document.getElementById("cityStatus");
const routeForm = document.getElementById("routeForm");
const routeMessage = document.getElementById("routeMessage");

citySelect.addEventListener("change", function () {
  const city = citySelect.value;

  cityStatus.textContent = cityNames[city];
  clearMapData();
  map.setCenter(cityCoordinates[city], 13);
  addAccessibilityPoints(cityCoordinates[city]);
});

routeForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const from = document.getElementById("fromInput").value.trim();
  const to = document.getElementById("toInput").value.trim();
  const city = citySelect.value;
  const userType = document.getElementById("userType").value;

  if (!from || !to) {
    routeMessage.textContent = "Заполните оба поля: «Откуда» и «Куда».";
    return;
  }

  buildRoute(from, to, city, userType);
});

/* ==============================
   7. Регистрация пользователя
   ============================== */
const authModal = document.getElementById("authModal");
const openAuthButton = document.getElementById("openAuthButton");
const closeAuthButton = document.getElementById("closeAuthButton");

openAuthButton.addEventListener("click", function () {
  authModal.hidden = false;
});

closeAuthButton.addEventListener("click", function () {
  authModal.hidden = true;
});

authModal.addEventListener("click", function (event) {
  if (event.target === authModal) {
    authModal.hidden = true;
  }
});

document.getElementById("authForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const name = document.getElementById("nameInput").value.trim();
  const email = document.getElementById("emailInput").value.trim();

  localStorage.setItem(
    "accessibleRouteAccount",
    JSON.stringify({ name, email })
  );

  document.getElementById("authMessage").textContent =
    `Учётная запись для ${name} сохранена в этом браузере.`;

  openAuthButton.textContent = name;
  event.target.reset();
});

try {
  const account = JSON.parse(localStorage.getItem("accessibleRouteAccount"));

  if (account && account.name) {
    openAuthButton.textContent = account.name;
  }
} catch (error) {
  localStorage.removeItem("accessibleRouteAccount");
}

/* ==============================
   8. Запуск Яндекс Карт
   ============================== */
ymaps.ready(initMap);
