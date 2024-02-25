const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const app = express();
const cors = require('cors')
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
app.post('/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Выбираем пользователя из базы данных по электронной почте
        db.get('SELECT * FROM Users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Проверяем, совпадают ли пароли
            if (!row || row.password !== password) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Если пароль совпадает, отправляем сообщение об успешной авторизации и информацию о пользователе
            res.json({ message: 'Login successful', user: row });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Получение данных из таблицы Users без пароля
app.get('/users', (req, res) => {
    db.all('SELECT id, email, delivery_address, first_name, last_name FROM Users', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ users: rows });
    });
});

//--------------------------------------------

// Метод для отправки кода подтверждения на email
app.post('/sendCodeVetifyRegisterEmail', (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000); // Генерация случайного кода

    // Отправка email с кодом подтверждения
    const mailOptions = {
        from: 'noreply.internet.cld.fiin@gmail.com',
        to: email,
        subject: 'Подтверждение регистрации',
        text: `Ваш код подтверждения: ${code}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.status(500).send('Ошибка при отправке кода подтверждения.');
        } else {
            // Сохранение кода в базе данных
            db.run('INSERT INTO ConfirmationCodes (email, code) VALUES (?, ?)', [email, code], (err) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Ошибка при сохранении кода подтверждения.');
                } else {
                    console.log('Email с кодом подтверждения отправлен.');
                    res.status(200).send('Email с кодом подтверждения отправлен.');
                }
            });
        }
    });
});

// Метод для регистрации пользователя с проверкой кода подтверждения
app.post('/register', (req, res) => {
    const { email, code, password } = req.body;

    // Проверка кода подтверждения в базе данных
    db.get('SELECT * FROM ConfirmationCodes WHERE email = ? AND code = ?', [email, code], (err, row) => {
        if (err) {
            console.log(err);
            res.status(500).send('Ошибка при выполнении запроса.');
        } else if (!row) {
            res.status(400).send('Неправильный код подтверждения.');
        } else {
            db.run(`INSERT INTO Users (email, password) VALUES (?, ?)`, [email, password], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                // Удаляем email и код из таблицы ConfirmationCodes
                db.run('DELETE FROM ConfirmationCodes WHERE email = ?', [email], function(err) {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Ошибка при удалении кода подтверждения.');
                    } else {
                        res.status(200).send('Пользователь успешно зарегистрирован.'); // Отправляем сообщение о успешной регистрации
                    }
                });
            });
        }
    });
});


// Добавление нового пользователя с хэшированным паролем
app.post('/users', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Хэшируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Вставляем пользователя в базу данных
        db.run(`INSERT INTO Users (email, password) VALUES (?, ?)`, [email, hashedPassword], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, email });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//------------------------------------------------------------------

//Отправка кода на почту для сброса пароля
app.put('/users/:email', (req, res) => {
    const { password } = req.body;
    const userEmail = req.params.email;

    // Поиск пользователя по email и обновление пароля
    getUserIdByEmail(userEmail)
        .then(userId => {
            if (!userId) {
                res.status(404).json({ error: 'Пользователь с указанным email не найден' });
                return;
            }

            // Обновление пароля в базе данных
            const query = 'UPDATE Users SET password = ? WHERE id = ?';
            db.run(query, [password, userId], function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                // Отправляем письмо о сбросе пароля
                const mailOptions = {
                    from: 'noreply.internet.cld.fiin@gmail.com',
                    to: userEmail,
                    subject: 'Успешный сброс пароля',
                    html: `
                        <p>Здравствуйте!</p>
                        <p>Ваш пароль был успешно изменен.</p>
                        <p>Если вы не выполняли эту операцию, свяжитесь с нашей службой поддержки!</p>
                        <p>С уважением,<br>Команда поддержки CPRT</p>
                    `
                };

                // Отправляем письмо
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error(error);
                        res.status(500).json({ error: 'Ошибка отправки электронного письма' });
                    } else {
                        console.log('Email sent: ' + info.response);
                        res.json({ message: 'Пароль пользователя успешно обновлен и отправлено уведомление на почту' });
                    }
                });
            });
        })
        .catch(err => {
            console.error('Ошибка при поиске пользователя по email:', err);
            res.status(500).json({ error: 'Ошибка при поиске пользователя по email' });
        });
});


// Обновление данных в таблице Users
app.put('/users/:id', (req, res) => {
  const { email, first_name, last_name, delivery_address } = req.body;
  const userId = req.params.id;
  const query = `
      UPDATE Users
      SET email = ?, password = ?, first_name = ?, last_name = ?, delivery_address = ?
      WHERE id = ?`;

  db.run(query, [email, first_name, last_name, delivery_address, userId], function (err) {
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


const transporter = nodemailer.createTransport({
    host: 'smtp.elasticemail.com',
    port: 2525,
    secure: false, // true для использования SSL
    auth: {
        user: 'noreply.internet.cld.fiin@gmail.com',
        pass: 'D313A8B84A3D67B83A3CCE9D866943F1C856'
    }
});


// Функция для получения идентификатора пользователя по его email
function getUserIdByEmail(email) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT id FROM Users WHERE email = ?';
        db.get(query, [email], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row ? row.id : null);
        });
    });
}


// Функция для получения email пользователя по его идентификатору
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

// Метод для отправки письма с кодом на сброс пароля на электронную почту пользователя
app.post('/reset-password/:email', (req, res) => {
    const email = req.params.email;

    // Получаем идентификатор пользователя из базы данных по его email
    getUserIdByEmail(email)
        .then(userId => {
            if (!userId) {
                res.status(404).json({ error: 'Пользователь с указанным email не найден' });
                return;
            }

            // Генерируем случайный код для сброса пароля
            const resetCode = Math.random().toString(36).substring(2, 8); // Пример: "abc123"

            // Сохраняем код в базе данных
            saveResetCode(userId, resetCode)
                .then(() => {
                    // Формируем текст письма с кодом сброса пароля
                    const mailOptions = {
                        from: 'noreply.internet.cld.fiin@gmail.com',
                        to: email,
                        subject: 'Сброс пароля',
                        html: `
                               <div style="background-color: #f9f9f9; padding: 20px; font-family: Arial, sans-serif;">
                                   <p style="font-size: 16px;">Здравствуйте!</p>
                                   <p style="font-size: 16px;">Вы запросили сброс пароля для вашей учетной записи.</p>
                                   <p style="font-size: 16px;">Для завершения процесса сброса пароля, пожалуйста, введите следующий код:</p>
                                   <h2 style="color: #007bff; font-size: 24px;">${resetCode}</h2>
                                   <p style="font-size: 16px;">Код действителен в течение 10 минут.</p>
                                   <hr style="border: 0; border-top: 1px solid #ddd;">
                                   <p style="font-size: 16px;">Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.</p>
                                   <p style="font-size: 16px;">С уважением,<br>Команда поддержки CPRT</p>
                               </div>
                           `
                    };

                    // Отправляем письмо
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error(error);
                            res.status(500).json({ error: 'Ошибка отправки электронного письма' });
                        } else {
                            console.log('Email sent: ' + info.response);
                            res.json({ message: 'Код для сброса пароля отправлен на вашу почту' });
                        }
                    });
                })
                .catch(err => {
                    console.error('Ошибка сохранения временного кода:', err);
                    res.status(500).json({ error: 'Ошибка сохранения временного кода' });
                });
        })
        .catch(err => {
            console.error('Ошибка получения id пользователя из базы данных:', err);
            res.status(500).json({ error: 'Ошибка получения id пользователя из базы данных' });
        });
});

// Метод для проверки временного кода при сбросе пароля
app.post('/reset-password/verify/:email', (req, res) => {
    const email = req.params.email;
    const { resetCode } = req.body;

    // Получаем идентификатор пользователя из базы данных по его email
    getUserIdByEmail(email)
        .then(userId => {
            if (!userId) {
                res.status(404).json({ error: 'Пользователь с указанным email не найден' });
                return;
            }

            // Получаем сохраненный код из базы данных
            getResetCode(userId)
                .then(savedResetCode => {
                    if (!savedResetCode) {
                        res.status(404).json({ error: 'Временный код не найден' });
                        return;
                    }

                    // Проверяем, совпадает ли введенный код с сохраненным
                    if (resetCode === savedResetCode) {
                        // Удаляем код из базы данных
                        removeResetCode(userId)
                            .then(() => {
                                // Код верный, разрешаем пользователю сбросить пароль
                                res.json({ message: 'Верный временный код' });
                            })
                            .catch(err => {
                                console.error('Ошибка удаления временного кода из базы данных:', err);
                                res.status(500).json({ error: 'Ошибка удаления временного кода из базы данных' });
                            });
                    } else {
                        res.status(400).json({ error: 'Неверный временный код' });
                    }
                })
                .catch(err => {
                    console.error('Ошибка получения временного кода из базы данных:', err);
                    res.status(500).json({ error: 'Ошибка получения временного кода из базы данных' });
                });
        })
        .catch(err => {
            console.error('Ошибка получения id пользователя из базы данных:', err);
            res.status(500).json({ error: 'Ошибка получения id пользователя из базы данных' });
        });
});


// Метод для удаления временного кода из базы данных
function removeResetCode(userId) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE Users SET reset_code = NULL WHERE id = ?';
        db.run(query, [userId], function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}


// Метод для сохранения временного кода в базе данных
function saveResetCode(userId, resetCode) {
    return new Promise((resolve, reject) => {
        // Выполняем запрос к базе данных для сохранения кода
        const query = `
            UPDATE Users
            SET reset_code = ?
            WHERE id = ?`;
        db.run(query, [resetCode, userId], function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

// Метод для получения временного кода из базы данных
function getResetCode(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT reset_code FROM Users WHERE id = ?';
        db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row ? row.reset_code : null);
        });
    });
}

//---------------------COURIERS----------------------

// Получение всех курьеров с номером заказа
app.get('/couriers', (req, res) => {
  db.all(`SELECT Couriers.*, Courier_Status.status_name
          FROM Couriers
          LEFT JOIN Courier_Status ON Couriers.status_id = Courier_Status.status_id`, (err, rows) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      res.json({ couriers: rows });
  });
});

// Получение информации о курьере по ID с номером заказа
app.get('/couriers/:id', (req, res) => {
  const courierId = req.params.id;
  db.get(`SELECT Couriers.*, Courier_Status.status_name
          FROM Couriers
          LEFT JOIN Courier_Status ON Couriers.status_id = Courier_Status.status_id
          WHERE Couriers.courier_id = ?`, [courierId], (err, row) => {
      if (err) {
          res.status(500).json({ error: err.message });
          return;
      }
      res.json({ courier: row });
  });
});

//-----------------------------------------------------------------

app.post('/confirm_order/:orderId/:courierId', (req, res) => {
  const orderId = req.params.orderId;
  const courierId = req.params.courierId;

  // Проверяем, существует ли заказ с указанным orderId и ему еще не назначен курьер
  const queryCheckOrder = 'SELECT * FROM Orders WHERE id = ? AND courier_id IS NULL';
  db.get(queryCheckOrder, [orderId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(400).json({ error: 'Заказ уже назначен другому курьеру или не существует' });
      return;
    }

    // Обновляем поле courier_id для заказа
    const updateOrderQuery = 'UPDATE Orders SET courier_id = ? WHERE id = ?';
    db.run(updateOrderQuery, [courierId, orderId], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({ message: 'Заказ успешно подтвержден и назначен курьеру' });
    });
  });
});

//-----------------------------------------------------------------------------------------

// Редактирование информации о курьере
app.put('/couriers/:id', (req, res) => {
    const courierId = req.params.id;
    const { first_name, last_name, second_name, contact_number, Id_number, login_courier, pass_courier } = req.body;

    // Проверка наличия всех обязательных полей
    if (!first_name || !last_name || !contact_number || !Id_number || !login_courier || !pass_courier) {
        return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля.' });
    }

    // Обновление информации о курьере в базе данных
    const stmt = db.prepare(`UPDATE Couriers SET first_name = ?, last_name = ?, second_name = ?, contact_number = ?, Id_number = ?, login_courier = ?, pass_courier = ? WHERE courier_id = ?`);
    stmt.run(first_name, last_name, second_name, contact_number, Id_number, login_courier, pass_courier, courierId, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Произошла ошибка при выполнении запроса.' });
        }
        res.status(200).json({ message: 'Информация о курьере успешно обновлена.' });
    });
    stmt.finalize();
});

// Удаление курьера по ID
app.delete('/couriers/:id', (req, res) => {
    const courierId = req.params.id;

    // Удаление курьера из базы данных
    const stmt = db.prepare(`DELETE FROM Couriers WHERE courier_id = ?`);
    stmt.run(courierId, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Произошла ошибка при выполнении запроса.' });
        }
        res.status(200).json({ message: 'Курьер успешно удален.' });
    });
    stmt.finalize();
});


app.post('/courier_register', (req, res) => {
    const { first_name, last_name, second_name, contact_number, Id_number, login_courier, pass_courier } = req.body;

    // Проверка наличия всех обязательных полей
    if (!first_name || !last_name || !contact_number || !Id_number || !login_courier || !pass_courier) {
        return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля.' });
    }

    // Добавление нового курьера в базу данных
    const stmt = db.prepare(`INSERT INTO Couriers (first_name, last_name, second_name, contact_number, Id_number, login_courier, pass_courier) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(first_name, last_name, second_name, contact_number, Id_number, login_courier, pass_courier, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Произошла ошибка при выполнении запроса.' });
        }
        res.status(200).json({ message: 'Курьер успешно зарегистрирован.' });
    });
    stmt.finalize();
});

// Метод для авторизации курьера
app.post('/courier_login', (req, res) => {
    const { login_courier, pass_courier } = req.body;

    // Поиск курьера по логину и паролю в базе данных
    db.get(`SELECT * FROM Couriers WHERE login_courier = ? AND pass_courier = ?`, [login_courier, pass_courier], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Произошла ошибка при выполнении запроса.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Курьер с указанными учетными данными не найден.' });
        }
        // Возвращаем информацию о курьере в случае успешной авторизации
        res.status(200).json(row);
    });
});

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

  
// Удаление данных из таблицы Categories и всех товаров, принадлежащих к данной категории
app.delete('/categories/:id', (req, res) => {
    const categoryId = req.params.id;

    const getProductQuery = 'SELECT id FROM Products WHERE category_id = ?';
    db.all(getProductQuery, [categoryId], (err, products) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const deleteProductsQuery = 'DELETE FROM Products WHERE category_id = ?';
        db.run(deleteProductsQuery, [categoryId], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const deleteCategoryQuery = 'DELETE FROM Category WHERE id = ?';
            db.run(deleteCategoryQuery, [categoryId], function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ deletedCategory: this.changes, deletedProducts: products.length });
            });
        });
    });
});


//------------------------Autentifications----------------

// Регистрация нового администратора
app.post('/admin/register', async (req, res) => {
  const { username, password } = req.body;

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

//----------------------REPORTS----------------------------

// GET-метод для получения информации о продажах в целом
app.get('/order_reports', (req, res) => {
    // Запрос к базе данных для получения данных из таблицы Order_Report
    db.all('SELECT * FROM OrderReport', (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Ошибка при выполнении запроса к базе данных' });
        }
        // Возвращаем результат в формате JSON
        res.json(rows);
    });
});


// GET-метод для получения информации о продажах товаров
app.get('/product_sales_reports', (req, res) => {
    // Запрос к базе данных для получения данных из таблицы Product_Sales_Report
    db.all('SELECT * FROM Product_Sales_Report', (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Ошибка при выполнении запроса к базе данных' });
        }
        // Возвращаем результат в формате JSON
        res.json(rows);
    });
});

//Get-Метод для получения отчета о работе курьеров
app.get('/courier_work_reports', (req, res) => {
    db.all(`SELECT cr.Id_number AS courier_id, o.order_number, cwr.order_date, cwr.order_total
            FROM Courier_Work_Report AS cwr
            JOIN Couriers AS cr ON cwr.courier_id = cr.courier_id
            JOIN Orders AS o ON cwr.order_id = o.id`, 
    (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Ошибка при выполнении запроса к базе данных' });
        }
        res.json(rows);
    });
});




//----------------------ORDERS-----------------------------


// Получение всех заказов с деталями и общей стоимостью заказа
app.get('/orders/details', (req, res) => {
  db.all(`SELECT Orders.id, Users.first_name || ' ' || Users.last_name AS user_name,
                 Orders.order_number,
                 Orders.delivery_time,
                 Orders.address,
                 Orders.user_comment,
                 Couriers.courier_id,
                 Couriers.Id_number AS courier_id,
                 Couriers.first_name AS courier_first_name,
                 Couriers.last_name AS courier_last_name,
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
          LEFT JOIN Couriers ON Orders.courier_id = Couriers.courier_id
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
  db.get(`SELECT Orders.*, Users.first_name || " " || Users.last_name AS user_name,
                  Couriers.Id_number AS courier_id,
                  Couriers.first_name AS courier_first_name,
                  Couriers.last_name AS courier_last_name,
                  Orders.address,
                  Couriers.courier_id,
                  Status.name AS status,
                  SUM(Products.price * Order_Lines.quantity) AS total_cost
          FROM Orders
          JOIN Users ON Orders.user_id = Users.id
          LEFT JOIN Order_Lines ON Orders.id = Order_Lines.order_id
          LEFT JOIN Products ON Order_Lines.product_id = Products.id
          LEFT JOIN Status ON Orders.status_id = Status.id
          LEFT JOIN Couriers ON Orders.courier_id = Couriers.courier_id
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
  const { user_id, product_id, quantity, delivery_time, status_id, address, user_comment } = req.body;

  // Генерация номера заказа
  const generateOrderNumber = () => {
    const queryLastOrderNumber = 'SELECT MAX(CAST(order_number AS INTEGER)) AS last_order_number FROM Orders';
    db.get(queryLastOrderNumber, [], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      let lastOrderNumber = row.last_order_number || 0; // Если таблица пустая, начнем с 0
      const nextOrderNumber = ('00000000' + (lastOrderNumber + 1)).slice(-8); // Форматирование номера заказа
      notifyCouriers(nextOrderNumber); // Вызов метода для уведомления курьеров с сгенерированным номером заказа
    });
  };

  // Метод для уведомления случайных свободных активных курьеров о новом заказе
const notifyFreeCouriers = (orderNumber) => {
  // Получаем список свободных активных курьеров
  const queryFreeCouriers = 'SELECT courier_id FROM Couriers WHERE status_id = 1 AND order_number IS NULL';
  db.all(queryFreeCouriers, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Если нет свободных активных курьеров, возвращаем сообщение об ошибке
    if (rows.length === 0) {
      res.status(400).json({ error: 'Нет свободных активных курьеров для уведомления' });
      return;
    }

    // Случайным образом выбираем курьера из списка
    const randomCourierIndex = Math.floor(Math.random() * rows.length);
    const randomCourierId = rows[randomCourierIndex].courier_id;

    // Добавляем заказ с сгенерированным номером в таблицу Orders
    addOrder(orderNumber, randomCourierId);
  });
};


  // Функция добавления заказа в таблицу Orders
  const addOrder = (orderNumber, courierId) => {
    const queryOrder = 'INSERT INTO Orders (user_id, order_number, delivery_time, status_id, address, courier_id, user_comment) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.run(queryOrder, [user_id, orderNumber, delivery_time, status_id, address, courierId, user_comment], function (err) {
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
  };

  // Генерировать номер заказа и уведомить курьеров
  generateOrderNumber();
});





// Редактирование данных в таблице Orders
app.put('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const { status, courier_id, address } = req.body;

  // Обновление данных в таблице Orders
  const queryOrder = 'UPDATE Orders SET status_id=?, courier_id=?, address=? WHERE id=?';
  db.run(queryOrder, [status, courier_id, address, orderId], function (err) {
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
