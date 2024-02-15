# SERVER
Реализация удалённой базы данны[ на базе SQLite3. Использование Node.js (Express.js) для работы API по протаколу HTTP без сокетов.

## Требования
- Любая система, поддерживающая запуск и компиляцию Node.js и библиотек
- Стабильное подкючение к сети ИНтернет

## Установка
1. Склонируйте репозиторий: `git clone https://github.com/filin_cprt/ProductManager_wpf.git`
2. Перейдите в директорию проекта: `cd ProductManager_wpf`
3. Установите Node.js
4. Установите зависимости: `package.json`
5. Запустите сервер: `node server.js`

| Метод | Путь | Описание |
|-------|------|----------|
| GET	| /users |	Получение данных из таблицы Users |
| POST |	/users |	Добавление данных в таблицу Users |
| PUT	| /users/:id |	Обновление данных в таблице Users |
| DELETE |	/users/:id |	Удаление данных из таблицы Users |
| GET |	/products |	Получение всех товаров с названиями категорий |
| GET |	/products/:id |	Получение информации о товаре по id |
| GET	| /products/category/:category_id |	Получение товаров по категории с названиями категорий |
| PUT |	/products/:id |	Редактирование продукта |
| POST |	/products |	Добавление продукта |
| DELETE |	/products/:id |	Удаление продукта |
| GET |	/categories |	Получение данных из таблицы Categories |
| POST |	/categories |	Добавление данных в таблицу Categories |
| PUT |	/categories/:id |	Редактирование данных в таблице Categories |
| DELETE |	/categories/:id |	Удаление данных из таблицы Categories |
| POST |	/admin/register |	Регистрация нового администратора |
| POST |	/admin/login |	Аутентификация администратора |
| GET |	/orders/details |	Получение всех заказов с деталями |
| GET |	/orders/:id |	Получение заказа по ID |
| POST |	/orders |	Добавление данных в таблицу Orders |
| PUT	| /orders/:id |	Редактирование данных в таблице Orders |
| DELETE |	/orders/:order_number |	Удаление данных из таблицы Orders по order_number |
| GET |	/statuses |	Получение всех статусов |
| GET |	/statuses/:id|	Получение конкретного статуса по ID |
| POST | /reset-password:id | Запрос кода на почту для сброса пароля |
| POST | /reset-password/verify/:id | Проверка кода сброса на корректность |
| POST |	/statuses |	Добавление нового статуса |
| PUT |	/statuses/:id	| Обновление статуса по ID |
| DELETE |	/statuses/:id |	Удаление статуса по ID |
| POST |	/products/increment/:barcode |	Добавление 1 единицы к количеству товара по штрих-коду |
| DELETE |	/products/decrement/:barcode |	Удаление 1 единицы из количества товара по штрих-коду |
| POST | /reset-password/:email | Запрос кода на почту для сброса пароля |
| POST | /reset-password/verify/:email | Верификация кода сброса пароля |
