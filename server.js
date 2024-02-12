const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors')
const nodemailer = require('nodemailer');
const http = require('http').Server(app);
const io = require('socket.io')(http); 
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '50mb' }));

const db = new sqlite3.Database("./DATABASE_IS_SERVER.db");
 // Путь к вашей базе данных

// Редактирование заказа с возможностью обновления и удаления товаров
app.put('/orders/update/:id', (req, res) => {
  const orderId = req.params.id;
  const orderDetails = req.body;

  // Обновление данных в таблице Orders
  const queryOrder = 'UPDATE Orders SET status_id=? WHERE id=?';
  db.run(queryOrder, [orderDetails.status, orderId], function (err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
      return;
    }

    // Удаление товаров, которых нет в обновленном заказе
    const currentProducts = orderDetails.products.map(product => product.product_id);
    const queryDeleteProducts = `DELETE FROM Order_Lines WHERE order_id=? AND product_id NOT IN (${currentProducts.join(',')})`;
    db.run(queryDeleteProducts, [orderId], function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
        return;
      }

      // Обновление или добавление товаров в заказе
      orderDetails.products.forEach(product => {
        const queryUpdateProduct = 'INSERT OR REPLACE INTO Order_Lines (order_id, product_id, quantity) VALUES (?, ?, ?)';
        db.run(queryUpdateProduct, [orderId, product.product_id, product.quantity], function (err) {
          if (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
            return;
          }
        });
      });

      res.json({ changes: this.changes });
    });
  });
});


//---------------------USERS---------------------


// Авторизация пользователя
app.post('/users/login', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM Users WHERE email = ? AND password = ?';
  db.get(query, [email, password], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json({ message: 'Login successful', user: row });
  });
});




const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'noreply.internet.cld.fiin@gmail.com', 
    pass: '6wQ-4MeEff' 
  }
});

// Метод для отправки электронной почты с кодом
app.post('/send-code/:userId', (req, res) => {
  const userId = req.params.userId;

  const email = getEmailById(userId);

  if (!email) {
    res.status(404).json({ error: 'Пользователь с указанным идентификатором не найден' });
    return;
  }

  const code = generateCode();

  const mailOptions = {
    from: 'yourgmail@gmail.com',
    to: email,
    subject: 'Код подтверждения смены пароля',
    text: `Ваш код подтверждения: ${code}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).json({ error: 'Ошибка отправки кода подтверждения' });
    } else {
      console.log('Email sent: ' + info.response);
      res.json({ message: 'Код подтверждения отправлен на вашу почту' });
    }
  });
});

// Функция для генерации случайного кода
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000);
}

// Функция для получения email пользователя по его идентификатору (замените на вашу собственную функцию)
function getEmailById(userId) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT email FROM Users WHERE id = ?';
    db.get(query, [userId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve(null); // Пользователь не найден
        return;
      }
      resolve(row.email);
    });
  });
}





// Получение данных из таблицы Users
app.get('/users', (req, res) => {
    db.all('SELECT * FROM Users', (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ users: rows });
    });
  });
  
  // Добавление данных в таблицу Users
  app.post('/users', (req, res) => {
    const { email, password, first_name, last_name, delivery_address } = req.body;
    const query = 'INSERT INTO Users (email, password, first_name, last_name, delivery_address) VALUES (?, ?, ?, ?, ?)';
    db.run(query, [email, password, first_name, last_name, delivery_address], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    });
  });
  

// Обновление данных в таблице Users
app.put('/users/:id', (req, res) => {
  const { email, password, first_name, last_name, delivery_address } = req.body;
  const userId = req.params.id;
  const query = `
      UPDATE Users
      SET email = ?, password = ?, first_name = ?, last_name = ?, delivery_address = ?
      WHERE id = ?`;

  db.run(query, [email, password, first_name, last_name, delivery_address, userId], function (err) {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      res.json({ message: 'User updated successfully' });
  });
});

  // Удаление данных из таблицы Users
  app.delete('/users/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'DELETE FROM Users WHERE id=?';
    db.run(query, [userId], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ deleted: this.changes });
    });
  });

  // Функция для сохранения изменений
function saveEdit() {
  const updatedEmail = document.getElementById('editEmail').value;
  const updatedPassword = document.getElementById('editPassword').value;
  const updatedFirstName = document.getElementById('editFirstName').value;
  const updatedLastName = document.getElementById('editLastName').value;
  const updatedDeliveryAddress = document.getElementById('editDeliveryAddress').value;

  // Используем глобальную переменную userToEdit
  const userId = userToEdit;

  // Отправляем изменения на сервер
  fetch(`http://localhost:3000/users/${userId}`, {
      method: 'PUT',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          email: updatedEmail,
          password: updatedPassword,
          first_name: updatedFirstName,
          last_name: updatedLastName,
          delivery_address: updatedDeliveryAddress
      })
  })
  .then(() => {
      // После успешного обновления, скрываем форму редактирования
      document.getElementById('editForm').style.display = 'none';

      // Обновляем отображение пользователей
      getUsers();
  });
}



//---------------------PRODUCTS----------------------

// Получение всех товаров с названиями категорий
app.get('/products', (req, res) => {
  const query = `
    SELECT P.id, P.name, P.price, P.color_primary, P.color_light, P.description, P.image_resource, P.quantity, P.barcode, P.category_id, C.nameCategory as category_name
    FROM Products P
    LEFT JOIN Category C ON P.category_id = C.id
  `;

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
   
    res.json({ products: rows });
  });
});


// Получение данных о товаре по его ID без image_data
app.get('/products/:id', (req, res) => {
  const productId = req.params.id;

  const query = `
    SELECT P.id, P.name, P.price, P.color_primary, P.color_light, P.description, P.quantity, P.barcode, P.image_resource, P.category_id, C.nameCategory as category_name
    FROM Products P
    LEFT JOIN Category C ON P.category_id = C.id
    WHERE P.id = ?
  `;

  db.get(query, [productId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ message: 'Товар не найден по указанному ID' });
      return;
    }

    res.json({ product: row });
  });
});


// Получение товаров по категории с названиями категорий
app.get('/products/category/:category_id', (req, res) => {
  const categoryId = req.params.category_id;
  const query = `
    SELECT P.id, P.name, P.price, P.color_primary, P.color_light, P.description, P.image_resource, P.quantity, P.category_id, C.nameCategory as category_name
    FROM Products P
    LEFT JOIN Category C ON P.category_id = C.id
    WHERE P.category_id = ?
  `;

  db.all(query, [categoryId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json({ products: rows });
  });
});


// Редактирование продукта
app.put('/products/:id', (req, res) => {
  const productId = req.params.id;
  const { name, price, color_primary, color_light, description, category_id, quantity, barcode, image_resource } = req.body;

  const query = `
    UPDATE Products 
    SET name=?, image_resource=?, price=?, color_primary=?, color_light=?, description=?, category_id=?, quantity=?, barcode=?
    WHERE id=?
  `;
  db.run(query, [name, image_resource, price, color_primary, color_light, description, category_id, quantity, barcode, productId], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ updated: this.changes });
  });
});



// Добавление продукта
app.post('/products', (req, res) => {
  const { name, price, color_primary, color_light, description, category_id, quantity, barcode } = req.body;

  const query = 'INSERT INTO Products (name, image_resource, price, color_primary, color_light, description, category_id, quantity, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.run(query, [name, price, color_primary, color_light, description, category_id, quantity, barcode], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID });
  });
});


// Удаление продукта
app.delete('/products/:id', (req, res) => {
  const productId = req.params.id;
  const query = 'DELETE FROM Products WHERE id=?';
  db.run(query, [productId], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ deleted: this.changes });
  });
});




//----------------------CATEGORY-----------------------------

// Получение данных из таблицы Categories
app.get('/categories', (req, res) => {
    db.all('SELECT * FROM Category', (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ categories: rows });
    });
  });
  
  // Добавление данных в таблицу Categories
  app.post('/categories', (req, res) => {
    const { nameCategory } = req.body;
    const query = 'INSERT INTO Category (nameCategory) VALUES (?)';
    db.run(query, [nameCategory], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    });
  });
  
  // Редактирование данных в таблице Categories
  app.put('/categories/:id', (req, res) => {
    const categoryId = req.params.id;
    const { nameCategory } = req.body;
    const query = 'UPDATE Category SET nameCategory=? WHERE id=?';
    db.run(query, [nameCategory, categoryId], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ changes: this.changes });
    });
  });
  
  // Удаление данных из таблицы Categories
  app.delete('/categories/:id', (req, res) => {
    const categoryId = req.params.id;
    const query = 'DELETE FROM Category WHERE id=?';
    db.run(query, [categoryId], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ deleted: this.changes });
    });
  });


//------------------------Autentifications----------------

// Регистрация нового администратора
app.post('/admin/register', async (req, res) => {
  const { username, password } = req.body;

  // Генерация соли
  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);

  // Хеширование пароля с использованием соли
  const hashedPassword = await bcrypt.hash(password, salt);

  // Вставка данных в таблицу AdminCredentials
  const query = 'INSERT INTO AdminCredentials (username, password_hash, salt) VALUES (?, ?, ?)';
  db.run(query, [username, hashedPassword, salt], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID });
  });
});

// Аутентификация администратора
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;

  // Получение данных из таблицы AdminCredentials по логину
  const query = 'SELECT id, password_hash, salt FROM AdminCredentials WHERE username = ?';
  db.get(query, [username], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Проверка пароля
    const isValidPassword = await bcrypt.compare(password, row.password_hash);

    if (isValidPassword) {
      res.json({ message: 'Authentication successful' });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});


//----------------------ORDERS-----------------------------


// Получение всех заказов с деталями и общей стоимостью заказа
app.get('/orders/details', (req, res) => {
  db.all(`SELECT Orders.id, Users.first_name || ' ' || Users.last_name AS user_name,
                 Orders.order_number,
                 Orders.delivery_time,
                 Products.name AS product_name,
                 Order_Lines.quantity,
                 Products.price,
                 Status.name AS status,
                 SUM(Products.price * Order_Lines.quantity) AS total_cost
          FROM Users
          JOIN Orders ON Users.id = Orders.user_id
          LEFT JOIN Order_Lines ON Orders.id = Order_Lines.order_id
          LEFT JOIN Products ON Order_Lines.product_id = Products.id
          LEFT JOIN Status ON Orders.status_id = Status.id
          GROUP BY Orders.id`, (err, rows) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      res.json({ orders: rows });
  });
});

// Получение заказа по ID с общей стоимостью заказа
app.get('/orders/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT Orders.*, Users.first_name || " " || Users.last_name AS user_name, Status.name AS status,
                  SUM(Products.price * Order_Lines.quantity) AS total_cost
          FROM Orders
          JOIN Users ON Orders.user_id = Users.id
          LEFT JOIN Order_Lines ON Orders.id = Order_Lines.order_id
          LEFT JOIN Products ON Order_Lines.product_id = Products.id
          LEFT JOIN Status ON Orders.status_id = Status.id
          WHERE Orders.id = ?
          GROUP BY Orders.id`, [id], (err, row) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      res.json({ order: row });
  });
});



// Добавление данных в таблицу Orders
app.post('/orders', (req, res) => {
  const { user_id, product_id, quantity, order_number, delivery_time, status_id } = req.body;

  // Проверить наличие достаточного количества товара на складе
  const checkAvailabilityQuery = 'SELECT quantity FROM Products WHERE id = ?';
  db.get(checkAvailabilityQuery, [product_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row || row.quantity < quantity) {
      res.status(400).json({ error: 'Недостаточное количество товара на складе' });
      return;
    }

    // Если достаточное количество товара доступно, добавить заказ
    const queryOrder = 'INSERT INTO Orders (user_id, order_number, delivery_time, status_id) VALUES (?, ?, ?, ?)';
    db.run(queryOrder, [user_id, order_number, delivery_time, status_id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const orderId = this.lastID;
        const queryOrderLine = 'INSERT INTO Order_Lines (order_id, product_id, quantity) VALUES (?, ?, ?)';
        db.run(queryOrderLine, [orderId, product_id, quantity], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.json({ id: orderId });
        });
    });
  });
});



// Редактирование данных в таблице Orders
app.put('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  // Обновление данных в таблице Orders
  const queryOrder = 'UPDATE Orders SET status_id=? WHERE id=?';
  db.run(queryOrder, [status, orderId], function (err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes > 0) {
      res.json({ changes: this.changes });
    } else {
      res.status(500).json({ error: 'No changes made' });
    }
  });
});


// Удаление данных из таблицы Orders по order_number
app.delete('/orders/:order_number', (req, res) => {
  const orderNumber = req.params.order_number;

  // Получение ID заказа по order_number
  const queryOrderId = 'SELECT id FROM Orders WHERE order_number = ?';
  db.get(queryOrderId, [orderNumber], (err, row) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }

      if (!row) {
          res.status(404).json({ error: 'Order not found' });
          return;
      }

      const orderId = row.id;

      // Удаление данных из таблицы Order_Lines
      const queryOrderLine = 'DELETE FROM Order_Lines WHERE order_id=?';
      db.run(queryOrderLine, [orderId], function (err) {
          if (err) {
              res.status(500).json({ error: err.message });
              return;
          }

          // Удаление данных из таблицы Orders
          const queryOrder = 'DELETE FROM Orders WHERE id=?';
          db.run(queryOrder, [orderId], function (err) {
              if (err) {
                  res.status(500).json({ error: err.message });
                  return;
              }

              res.json({ deleted: this.changes });
          });
      });
  });
});

// Добавление данных в таблицу Orders
app.post('/orders', (req, res) => {
  const { user_id, product_id, quantity, order_number, delivery_time, status_id } = req.body;
  const queryOrder = 'INSERT INTO Orders (user_id, order_number, delivery_time, status_id) VALUES (?, ?, ?, ?)';
  db.run(queryOrder, [user_id, order_number, delivery_time, status_id], function (err) {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }

      const orderId = this.lastID;
      const queryOrderLine = 'INSERT INTO Order_Lines (order_id, product_id, quantity) VALUES (?, ?, ?)';
      db.run(queryOrderLine, [orderId, product_id, quantity], function (err) {
          if (err) {
              res.status(500).json({ error: err.message });
              return;
          }

          res.json({ id: orderId });
      });
  });
});


// Редактирование данных в таблице Orders
app.put('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  // Обновление данных в таблице Orders
  const queryOrder = 'UPDATE Orders SET status_id=? WHERE id=?';
  db.run(queryOrder, [status, orderId], function (err) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes > 0) {
      res.json({ changes: this.changes });
    } else {
      res.status(500).json({ error: 'No changes made' });
    }
  });
});


// Удаление данных из таблицы Orders по order_number
app.delete('/orders/:order_number', (req, res) => {
  const orderNumber = req.params.order_number;

  // Получение ID заказа по order_number
  const queryOrderId = 'SELECT id FROM Orders WHERE order_number = ?';
  db.get(queryOrderId, [orderNumber], (err, row) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }

      if (!row) {
          res.status(404).json({ error: 'Order not found' });
          return;
      }

      const orderId = row.id;

      // Удаление данных из таблицы Order_Lines
      const queryOrderLine = 'DELETE FROM Order_Lines WHERE order_id=?';
      db.run(queryOrderLine, [orderId], function (err) {
          if (err) {
              res.status(500).json({ error: err.message });
              return;
          }

          // Удаление данных из таблицы Orders
          const queryOrder = 'DELETE FROM Orders WHERE id=?';
          db.run(queryOrder, [orderId], function (err) {
              if (err) {
                  res.status(500).json({ error: err.message });
                  return;
              }

              res.json({ deleted: this.changes });
          });
      });
  });
});


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

io.of('productHub').on('connection', (socket) => {
  console.log('Client connected to productHub');

  socket.on('updateProduct', (data) => {
    db.run('UPDATE Products SET name = ?, quantity = ?, price = ? WHERE id = ?', [data.name, data.quantity, data.price, data.id]);

    io.of('/productHub').emit('productUpdated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from productHub');
  });
});



// Метод GET для получения всех статусов
app.get('/statuses', (req, res) => {
  db.all('SELECT * FROM Status', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ statuses: rows });
  });
});

// Метод GET для получения конкретного статуса по ID
app.get('/statuses/:id', (req, res) => {
  const statusId = req.params.id;
  db.get('SELECT * FROM Status WHERE id = ?', [statusId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ message: 'Статус не найден' });
      return;
    }
    res.json({ status: row });
  });
});

// Метод POST для добавления нового статуса
app.post('/statuses', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ message: 'Поле "name" обязательно' });
    return;
  }

  db.run('INSERT INTO Status (name) VALUES (?)', [name], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name });
  });
});

// Метод PUT для обновления статуса по ID
app.put('/statuses/:id', (req, res) => {
  const statusId = req.params.id;
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ message: 'Поле "name" обязательно' });
    return;
  }

  db.run('UPDATE Status SET name = ? WHERE id = ?', [name, statusId], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ message: 'Статус не найден' });
      return;
    }
    res.json({ id: statusId, name });
  });
});

// Метод DELETE для удаления статуса по ID
app.delete('/statuses/:id', (req, res) => {
  const statusId = req.params.id;

  db.run('DELETE FROM Status WHERE id = ?', [statusId], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ message: 'Статус не найден' });
      return;
    }
    res.json({ message: 'Статус успешно удален' });
  });
});


// Добавление 1 единицы к количеству товара по штрих-коду
app.post('/products/increment/:barcode', (req, res) => {
  const barcode = req.params.barcode;

  // Увеличение количества товара на 1
  const queryIncrement = 'UPDATE Products SET quantity = quantity + 1 WHERE barcode = ?';
  db.run(queryIncrement, [barcode], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes > 0) {
      // Получение информации о товаре после увеличения
      const queryGetProduct = 'SELECT name, quantity FROM Products WHERE barcode = ?';
      db.get(queryGetProduct, [barcode], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        res.json({ message: `Количество товара "${row.name}" увеличено на 1. Текущее количество: ${row.quantity}`, product: row });
      });
    } else {
      res.status(404).json({ message: 'Товар не найден по указанному штрих-коду' });
    }
  });
});

// Удаление 1 единицы из количества товара по штрих-коду
app.delete('/products/decrement/:barcode', (req, res) => {
  const barcode = req.params.barcode;

  // Проверка, что количество товара больше 0 перед уменьшением
  const queryCheckQuantity = 'SELECT name, quantity FROM Products WHERE barcode = ?';
  db.get(queryCheckQuantity, [barcode], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ message: 'Товар не найден по указанному штрих-коду' });
      return;
    }

    if (row.quantity > 0) {
      // Уменьшение количества товара на 1
      const queryDecrement = 'UPDATE Products SET quantity = quantity - 1 WHERE barcode = ?';
      db.run(queryDecrement, [barcode], function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        // Получение информации о товаре после уменьшения
        const queryGetProduct = 'SELECT name, quantity FROM Products WHERE barcode = ?';
        db.get(queryGetProduct, [barcode], (err, row) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          res.json({ message: `Количество товара "${row.name}" уменьшено на 1. Текущее количество: ${row.quantity}`, product: row });
        });
      });
    } else {
      res.status(400).json({ message: `Количество товара "${row.name}" уже равно 0` });
    }
  });
});





app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
