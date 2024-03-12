const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors')
const http = require('http').Server(app);
const port = 3000;

const fs = require('fs');
const path = require('path');

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({ limit: '50mb' }));

const db = new sqlite3.Database("./DATABASE_IS_SERVER.db");
 // Путь к вашей базе данных

app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // Если токен отсутствует, возвращаем ошибку 401

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Если токен недействителен, возвращаем ошибку 403
    req.user = user; // Присваиваем запросу объект пользователя
    next(); // Переходим к следующему middleware
  });
}

//----------------------------------------------------------------------------

// Заглушка для проверки пароля
const checkPassword = (password) => {
    return password === 'Hlp3j95ff223';
};

// Эндпоинт для отправки файла базы данных с запросом пароля
app.get('/database', (req, res) => {
    // Проверяем, был ли предоставлен пароль в запросе
    const password = req.query.password;
    if (!password) {
        // Если пароль не был предоставлен, возвращаем ошибку
        return res.status(401).json({ error: 'Unauthorized: Password is required' });
    }

    // Проверяем корректность пароля
    if (!checkPassword(password)) {
        // Если пароль неверен, возвращаем ошибку
        return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
    }

    // Получаем путь к файлу базы данных
    const dbFilePath = path.join(__dirname, 'DATABASE_IS_SERVER.db');

    // Проверяем существует ли файл базы данных
    if (fs.existsSync(dbFilePath)) {
        // Отправляем файл как ответ на запрос
        res.download(dbFilePath, 'DATABASE_IS_SERVER.db', (err) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
    } else {
        // Если файл не существует, возвращаем ошибку
        res.status(404).json({ error: 'Database file not found' });
    }
});


//-----------------------------------------------------------------


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
    const current = orderDetails.products.map(product => product.product_id);
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

// Проверка существования пользователя по email
app.get('/users/check', (req, res) => {
    const email = req.query.email;

    // Проверка наличия пользователя в базе данных
    db.get('SELECT * FROM Users WHERE email = ?', [email], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            // Пользователь с таким email уже существует
            res.json({ exists: true });
        } else {
            // Пользователя с таким email нет
            res.json({ exists: false });
        }
    });
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

// Получение данных о пользователе по его идентификатору без пароля
app.get('/users/:userId', (req, res) => {
    const userId = req.params.userId;
    
    db.get('SELECT id, email, delivery_address, first_name, last_name FROM Users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Проверяем, найден ли пользователь
        if (!row) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ user: row });
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
    html: `
        <div style="background-color: #f9f9f9; padding: 20px; font-family: Arial, sans-serif;">
            <p style="font-size: 16px;">Приветствуем вас!</p>
            <p style="font-size: 16px;">Для завершения регистрации в нашем интернет-магазине, введите следующий код подтверждения:</p>
            <h2 style="color: #007bff; font-size: 24px;">${code}</h2>
            <p style="font-size: 16px;">Спасибо за регистрацию в нашем магазине!</p>
            <hr style="border: 0; border-top: 1px solid #ddd;">
            <p style="font-size: 16px;">Если вы не регистрировались на нашем сайте, проигнорируйте это сообщение.</p>
            <p style="font-size: 16px;">С уважением,<br>Команда поддержки CPRT</p>
        </div>
    `
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
            // Проверка наличия пользователя с таким email в базе данных
            db.get('SELECT * FROM Users WHERE email = ?', [email], (err, userRow) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Ошибка при выполнении запроса.');
                } else if (userRow) {
                    res.status(400).send('Пользователь с таким email уже зарегистрирован.');
                } else {
                    // Добавление пользователя в базу данных
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
      SET email = ?, first_name = ?, last_name = ?, delivery_address = ?
      WHERE id = ?`;

  db.run(query, [email, first_name, last_name, delivery_address, userId], function (err) {
      if (err) {
       console.error(err);
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
    const { first_name, last_name, second_name, contact_number, pass_courier } = req.body;

    // Проверка наличия всех обязательных полей
    if (!first_name || !last_name || !contact_number || !pass_courier) {
        return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля.' });
    }

    // Обновление информации о курьере в базе данных
    const stmt = db.prepare(`UPDATE Couriers SET first_name = ?, last_name = ?, second_name = ?, contact_number = ?, pass_courier = ? WHERE courier_id = ?`);
    stmt.run(first_name, last_name, second_name, contact_number, pass_courier, courierId, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Произошла ошибка при выполнении запроса.' });
        }
        res.status(200).json({ message: 'Информация о курьере успешно обновлена.' });
    });
    stmt.finalize();
});

app.delete('/couriers/:id', (req, res) => {
    const courierId = req.params.id;

    // Проверяем, есть ли у курьера заказы
    const stmt = db.prepare(`SELECT * FROM Couriers WHERE courier_id = ? AND order_number IS NOT NULL`);
    stmt.get(courierId, (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Произошла ошибка при выполнении запроса.' });
        }
        if (row) {
            return res.status(400).json({ error: 'Нельзя удалить курьера, у которого есть заказы.' });
        }

        // Если у курьера нет заказов, выполняем удаление
        const deleteStmt = db.prepare(`DELETE FROM Couriers WHERE courier_id = ?`);
        deleteStmt.run(courierId, (deleteErr) => {
            if (deleteErr) {
                return res.status(500).json({ error: 'Произошла ошибка при удалении курьера.' });
            }
            res.status(200).json({ message: 'Курьер успешно удален.' });
        });
        deleteStmt.finalize();
    });
    stmt.finalize();
});

const generateIdNumber = async () => {
    // Получаем текущий максимальный Id_number из базы данных
    const maxIdNumber = await getMaxIdNumberFromDatabase();

    // Генерируем новый Id_number с шаблоном ID00000 и шагом +1
    const newIdNumber = 'ID_' + (parseInt(maxIdNumber.split('_')[1]) + 1).toString().padStart(6, '0');
    return newIdNumber;
};

const generateLoginCourier = async () => {
    // Получаем текущий максимальный login_courier из базы данных
    const maxLoginCourier = await getMaxLoginCourierFromDatabase();

    // Генерируем новый login_courier с шаблоном crer_00000 и шагом +1
    const newLoginCourier = 'crer_' + (parseInt(maxLoginCourier.split('_')[1]) + 1).toString().padStart(6, '0');
    return newLoginCourier;
};

const getMaxIdNumberFromDatabase = async () => {
    return new Promise((resolve, reject) => {
        // Открываем соединение с базой данных
        db.get('SELECT MAX(Id_number) AS maxId FROM Couriers', (err, row) => {
            if (err) {
                reject(err); // В случае ошибки отклоняем промис с ошибкой
            } else {
                // Если запрос выполнен успешно, возвращаем максимальное значение Id_number
                resolve(row.maxId || 'ID_000000');
            }
        });
    });
};

const getMaxLoginCourierFromDatabase = async () => {
    return new Promise((resolve, reject) => {
        // Открываем соединение с базой данных
        db.get('SELECT MAX(login_courier) AS maxLoginCourier FROM Couriers', (err, row) => {
            if (err) {
                reject(err); // В случае ошибки отклоняем промис с ошибкой
            } else {
                // Если запрос выполнен успешно, возвращаем максимальное значение login_courier
                resolve(row.maxLoginCourier || 'crer_000000');
            }
        });
    });
};

const generatePassword = () => {
    // Генерируем уникальный 8-значный пароль
    const password = Math.random().toString(36).substring(2, 10);
    return password;
};

app.post('/courier_register', async (req, res) => {
    const { first_name, last_name, second_name, contact_number } = req.body;

    // Проверка наличия всех обязательных полей
    if (!first_name || !last_name || !contact_number) {
        return res.status(400).json({ error: 'Пожалуйста, заполните все обязательные поля.' });
    }

    try {
        // Генерируем Id_number, login_courier и pass_courier
        const Id_number = await generateIdNumber();
        const login_courier = await generateLoginCourier();
        const pass_courier = generatePassword();
        const status_id = 2;

        // Добавление нового курьера в базу данных
        const stmt = db.prepare(`INSERT INTO Couriers (first_name, last_name, second_name, status_id, contact_number, Id_number, login_courier, pass_courier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(first_name, last_name, second_name, status_id, contact_number, Id_number, login_courier, pass_courier, (err) => {
            if (err) {
                console.error('Ошибка при выполнении запроса:', err);
                return res.status(500).json({ error: 'Произошла ошибка при выполнении запроса.' });
            }
            stmt.finalize(); // Завершаем операцию по добавлению курьера
            res.status(200).json({ message: 'Курьер успешно зарегистрирован.', login_courier, pass_courier });
        });
    } catch (error) {
        console.error('Ошибка при регистрации курьера:', error);
        return res.status(500).json({ error: 'Произошла ошибка при регистрации курьера.' });
    }
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

app.get('/products', (req, res) => {
    const lastUpdated = req.query.lastUpdated; // Получаем временную метку последнего обновления с клиента
    const query = `
    SELECT P.id, P.name, P.price, P.color_primary, P.color_light, P.description, P.image_resource, P.quantity, P.units_id, P.barcode, P.category_id, C.nameCategory as category_name, U.name as unit_name, PA.is_available as is_available, P.last_updated
    FROM Products P
    LEFT JOIN Category C ON P.category_id = C.id
    LEFT JOIN UnitsOfMeasurement U ON P.units_id = U.id
    JOIN ProductAvailabilityInShowcase PA ON P.id = PA.product_id
    WHERE P.last_updated > ?
  `;

  db.all(query, [lastUpdated], (err, rows) => {
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
    SELECT P.id, P.name, P.price, P.color_primary, P.color_light, P.description, P.quantity, P.units_id, P.barcode, P.image_resource, P.category_id, C.nameCategory as category_name, U.name as unit_name, PA.is_available as is_available
    FROM Products P
    LEFT JOIN Category C ON P.category_id = C.id
    LEFT JOIN UnitsOfMeasurement U ON P.units_id = U.id
    JOIN ProductAvailabilityInShowcase PA ON P.id = PA.product_id
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

// Получение витринных товаров
app.get('/showcase-products', (req, res) => {
  const query = `
    SELECT P.id, P.name, P.price, P.color_primary, P.color_light, P.description, P.image_resource, P.quantity, P.units_id, P.barcode, P.category_id, C.nameCategory as category_name, U.name as unit_name, PA.is_available as is_available
    FROM Products P
    LEFT JOIN Category C ON P.category_id = C.id
    LEFT JOIN UnitsOfMeasurement U ON P.units_id = U.id
    JOIN ProductAvailabilityInShowcase PA ON P.id = PA.product_id
    WHERE PA.is_available = 1
  `;

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
   
    res.json({ products: rows });
  });
});

// Обновление статуса доступности товара
app.put('/products/:productId/availability', (req, res) => {
  const productId = req.params.productId;
  const isAvailable = req.body.is_available; 

  const query = `
    UPDATE ProductAvailabilityInShowcase
    SET is_available = ?
    WHERE product_id = ?
  `;

  db.run(query, [isAvailable, productId], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json({ message: "Статус доступности товара успешно обновлен." });
  });
});


// Получение товаров по категории с названиями категорий
app.get('/products/category/:category_id', (req, res) => {
  const categoryId = req.params.category_id;
  const query = `
    SELECT P.id, P.name, P.price, P.color_primary, P.color_light, P.description, P.image_resource, P.quantity, P.units_id, P.category_id, C.nameCategory as category_name, U.name as unit_name, PA.is_available as is_available
    FROM Products P
    LEFT JOIN Category C ON P.category_id = C.id
    LEFT JOIN UnitsOfMeasurement U ON P.units_id = U.id
    JOIN ProductAvailabilityInShowcase PA ON P.id = PA.product_id
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
  const { name, price, color_primary, color_light, description, category_id, units_id, quantity, barcode, image_resource } = req.body;

  const query = `
    UPDATE Products 
    SET name=?, image_resource=?, price=?, color_primary=?, color_light=?, description=?, category_id=?, units_id=?, quantity=?, barcode=?
    WHERE id=?
  `;
  db.run(query, [name, image_resource, price, color_primary, color_light, description, category_id, units_id, quantity, barcode, productId], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ updated: this.changes });
  });
});

// Добавление продукта
app.post('/products', (req, res) => {
  const { name, price, color_primary, color_light, description, category_id, units_id, quantity, barcode, image_resource } = req.body;
  const query = 'INSERT INTO Products (name, price, color_primary, color_light, description, category_id, units_id, quantity, barcode, image_resource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.run(query, [name, price, color_primary, color_light, description, category_id, units_id, quantity, barcode, image_resource], function (err) {
    if (err) {
        res.status(500).json({ error: err.message });
        return;
    }
    res.json({ id: this.lastID });
});
});

app.delete('/products/:id', async (req, res) => {
    const productId = req.params.id;

    // Проверяем, доступен ли продукт в витрине
    const productAvailability = await db.get('SELECT is_available FROM ProductAvailabilityInShowcase WHERE product_id = ?', [productId]);

    // Если продукт недоступен, возвращаем сообщение об ошибке
    if (!productAvailability) {
        return res.status(400).json({ error: 'Нельзя удалить недоступный продукт.' });
    }

    // Проверяем, находится ли продукт в заказах со статусом "Новый", "В пути" или "В сборке"
    const ordersWithProduct = await db.get('SELECT * FROM Orders JOIN Order_Lines ON Orders.id = Order_Lines.order_id WHERE Order_Lines.product_id = ? AND Orders.status_id IN (1, 2, 5)', [productId]);

    // Если продукт находится в заказе со статусом "Новый", "В пути" или "В сборке", возвращаем сообщение об ошибке
    if (ordersWithProduct) {
        return res.status(400).json({ error: 'Нельзя удалить продукт, находящийся в заказе со статусом "Новый", "В пути" или "В сборке".' });
    }

    // Удаление продукта из базы данных
    const query = 'DELETE FROM Products WHERE id=?';
    db.run(query, [productId], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: this.changes });
    });
});



//-------------------------ProductShipments------------------------------

// GET all product shipments
app.get('/product-shipments', (req, res) => {
    console.log('GET /product-shipments requested');
    db.all(`SELECT ps.id, p.name AS product_name, ps.shipment_number, ps.quantity_received, ps.shipment_date, ps.expiry_date, s.name AS supplier_name
            FROM ProductShipments ps
            INNER JOIN Products p ON ps.product_id = p.id
            INNER JOIN Supplier s ON ps.supplier_id = s.id`, (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            console.log('Sending product shipments data:', rows);
            res.json(rows);
        }
    });
});

app.post('/product-shipments', (req, res) => {
    console.log('POST /product-shipments requested');
    const { shipment_info, products } = req.body;

    // Проверяем наличие необходимых данных в запросе
    if (!shipment_info || !products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Invalid request: Missing shipment_info or products array' });
    }

    // Извлекаем информацию о поставке
    const { shipment_number, shipment_date, supplier_id } = shipment_info;

    // Используем транзакцию для вставки данных о каждом товаре
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        products.forEach((product, index) => {
            const { product_id, quantity_received, expiry_date } = product;
            const query = 'INSERT INTO ProductShipments (product_id, shipment_number, quantity_received, shipment_date, expiry_date, supplier_id) VALUES (?, ?, ?, ?, ?, ?)';
            db.run(query, [product_id, shipment_number, quantity_received, shipment_date, expiry_date, supplier_id], async function (err) {
                if (err) {
                    console.error(err.message);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                } else {
                    console.log(`New product shipment added with ID ${this.lastID}`);
                    // Если это последний товар, фиксируем транзакцию и возвращаем ответ
                    if (index === products.length - 1) {
                        try {
                            // Обновляем количество товара в таблице Products
                            await updateProductQuantities(products);
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error(err.message);
                                    res.status(500).json({ error: 'Internal Server Error' });
                                } else {
                                    res.json({ message: 'Product shipments added successfully' });
                                }
                            });
                        } catch (error) {
                            console.error(error);
                            res.status(500).json({ error: 'Internal Server Error' });
                        }
                    }
                }
            });
        });
    });
});

async function updateProductQuantities(products) {
    for (const product of products) {
        const { product_id, quantity_received } = product;
        const updateQuery = 'UPDATE Products SET quantity = quantity + ? WHERE id = ?';
        await db.run(updateQuery, [quantity_received, product_id]);
        console.log(`Quantity updated for product with ID ${product_id}`);
    }
}

// PUT (update) a product shipment
app.put('/product-shipments/:id', (req, res) => {
    const id = req.params.id;
    const { product_id, shipment_number, quantity_received, shipment_date, expiry_date, supplier_id } = req.body;
    db.run(`UPDATE ProductShipments
            SET product_id = ?, shipment_number = ?, quantity_received = ?, shipment_date = ?, expiry_date = ?, supplier_id = ?
            WHERE id = ?`, [product_id, shipment_number, quantity_received, shipment_date, expiry_date, supplier_id, id], function (err) {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json({ message: `Product shipment ${id} updated successfully` });
        }
    });
});

//----------------------Shipments---------------------------


// Метод для просмотра списка всех поставщиков
app.get('/suppliers', (req, res) => {
    db.all('SELECT * FROM Supplier', (err, rows) => {
        if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ suppliers: rows });
    });
  });

// Метод для добавления нового поставщика
app.post('/suppliers', (req, res) => {
    const { name, contact_person, contact_number, email } = req.body;
    db.run(`INSERT INTO Supplier (name, contact_person, contact_number, email) VALUES (?, ?, ?, ?)`, [name, contact_person, contact_number, email], function (err) {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json({ id: this.lastID });
        }
    });
});

// Метод для редактирования информации о поставщике
app.put('/suppliers/:id', (req, res) => {
    const id = req.params.id;
    const { name, contact_person, contact_number, email } = req.body;
    db.run(`UPDATE Supplier SET name = ?, contact_person = ?, contact_number = ?, email = ? WHERE id = ?`, [name, contact_person, contact_number, email, id], function (err) {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json({ message: 'Supplier updated successfully' });
        }
    });
});

// Метод для удаления поставщика по идентификатору
app.delete('/suppliers/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM Supplier WHERE id = ?`, [id], function (err) {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
        } else {
            res.json({ message: 'Supplier deleted successfully' });
        }
    });
});

//-----------------UnitsOfMeasurement------------------------

// Получение данных из таблицы UnitsOfMeasurement
app.get('/unitsmeasurment', (req, res) => {
    db.all('SELECT * FROM UnitsOfMeasurement', (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ unitMeasurments: rows });
    });
  });

 // Добавление данных в таблицу UnitsOfMeasurement
  app.post('/unitsmeasurment', (req, res) => {
    const { name } = req.body;
    const query = 'INSERT INTO UnitsOfMeasurement (name) VALUES (?)';
    db.run(query, [name], function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    });
  });

// Удаление ед. измерения
app.delete('/unitsmeasurment/:id', (req, res) => {
  const unitId = req.params.id;
  const query = 'DELETE FROM UnitsOfMeasurement WHERE id=?';
  db.run(query, [unitId], function (err) {
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
      // Генерация JWT токена
      const token = jwt.sign({ adminId: row.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '60m' });
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

//----------------------REPORTS----------------------------

app.get('/reports/totalsalesday', (req, res) => {
    const query = 'SELECT * FROM OrderReport';
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/reports/totalsalesdayperiod', (req, res) => {
    const { startDate, endDate } = req.body;
    
    const query = 'SELECT SUM(total_orders) as total_orders, SUM(delivered_orders) as delivered_orders, SUM(cancelled_orders) as cancelled_orders, SUM(total_profit) as total_profit FROM OrderReport WHERE report_date BETWEEN ? AND ?';
    db.get(query, [startDate, endDate], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});


//----------------------ORDERS-----------------------------


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
                   Status.name AS status
            FROM Orders
            JOIN Users ON Users.id = Orders.user_id
            LEFT JOIN Status ON Orders.status_id = Status.id
            LEFT JOIN Couriers ON Orders.courier_id = Couriers.courier_id
            GROUP BY Orders.id`, (err, orders) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Для каждого заказа получаем детали товаров
        const promises = orders.map(order => {
            return new Promise((resolve, reject) => {
                const orderId = order.id;
                db.all(`SELECT Products.name AS product_name,
                               Order_Lines.quantity,
                               Products.price,
                               Order_Lines.product_id as productId
                        FROM Order_Lines
                        JOIN Products ON Order_Lines.product_id = Products.id
                        WHERE Order_Lines.order_id = ?`, [orderId], (err, products) => {
                    if (err) {
                        reject(err.message);
                        return;
                    }
                    order.products = products;
                    resolve();
                });
            });
        });

        // Дожидаемся выполнения всех запросов и отправляем ответ
        Promise.all(promises)
            .then(() => {
                res.json({ orders: orders });
            })
            .catch((error) => {
                res.status(500).json({ error: error });
            });
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
                    Status.name AS status
            FROM Orders
            JOIN Users ON Orders.user_id = Users.id
            LEFT JOIN Status ON Orders.status_id = Status.id
            LEFT JOIN Couriers ON Orders.courier_id = Couriers.courier_id
            WHERE Orders.id = ?`, [id], (err, order) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Получаем детали товаров для данного заказа
        db.all(`SELECT Products.name AS product_name,
                       Order_Lines.quantity,
                       Products.price,
                       Order_Lines.product_id as productId
                FROM Order_Lines
                JOIN Products ON Order_Lines.product_id = Products.id
                WHERE Order_Lines.order_id = ?`, [id], (err, products) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            order.products = products;
            res.json({ order: order });
        });
    });
});


// Добавление данных в таблицу Orders
app.post('/orders', (req, res) => {
    const { user_id, products, delivery_time, address, user_comment } = req.body;

    // Проверяем наличие товаров и достаточное количество на складе для каждого продукта
    const checkProductAvailability = () => {
        const promises = products.map(({ product_id, quantity }) => {
            return new Promise((resolve, reject) => {
                const queryCheckProductAvailability = 'SELECT quantity FROM Products WHERE id = ?';
                db.get(queryCheckProductAvailability, [product_id], (err, row) => {
                    if (err) {
                        reject(err.message);
                        return;
                    }

                    if (!row || row.quantity === 0 || row.quantity < quantity) {
                        reject(`Товар с идентификатором ${product_id} недоступен в достаточном количестве на складе`);
                        return;
                    }

                    resolve();
                });
            });
        });

        return Promise.all(promises);
    };

    // Создаем заказ
    const createOrder = () => {
        generateOrderNumber();
    };

    // Генерация номера заказа и добавление заказа
    const generateOrderNumber = () => {
        const queryLastOrderNumber = 'SELECT MAX(CAST(order_number AS INTEGER)) AS last_order_number FROM Orders';
        db.get(queryLastOrderNumber, [], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            let lastOrderNumber = row.last_order_number || 0; // Если таблица пустая, начнем с 0
            const nextOrderNumber = ('0' + (lastOrderNumber + 1)).slice(-8); // Форматирование номера заказа
            notifyFreeCouriers(nextOrderNumber); // Вызов метода для уведомления курьеров с сгенерированным номером заказа
        });
    };

    // Уведомление свободных курьеров о новом заказе
    const notifyFreeCouriers = (orderNumber) => {
        const queryFreeCouriers = 'SELECT courier_id FROM Couriers WHERE status_id = 1 AND order_number IS NULL';
        db.all(queryFreeCouriers, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (rows.length > 0) {
                const randomCourierIndex = Math.floor(Math.random() * rows.length);
                const randomCourierId = rows[randomCourierIndex].courier_id;
                addOrder(orderNumber, randomCourierId);
            } else {
                addOrder(orderNumber, null);
            }
        });
    };

    // Добавление заказа в таблицу Orders
const addOrder = (orderNumber, courierId) => {
    const status_id = 1; // Присваиваем значение 1 переменной status_id

    const queryOrder = 'INSERT INTO Orders (user_id, order_number, delivery_time, status_id, address, courier_id, user_comment) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.run(queryOrder, [user_id, orderNumber, delivery_time, status_id, address, courierId, user_comment], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const orderId = this.lastID;
        const queryOrderLine = 'INSERT INTO Order_Lines (order_id, product_id, quantity) VALUES (?, ?, ?)';
        const promises = products.map(({ product_id, quantity }) => {
            return new Promise((resolve, reject) => {
                db.run(queryOrderLine, [orderId, product_id, quantity], function (err) {
                    if (err) {
                        reject(err.message);
                        return;
                    }
                    resolve();
                });
            });
        });

        Promise.all(promises)
            .then(() => {
                updateCourier(orderNumber, courierId);
                res.json({ id: orderId });
            })
            .catch((error) => {
                res.status(500).json({ error: error });
            });
    });
};


    // Обновление информации о курьере
    const updateCourier = (orderNumber, courierId) => {
        const queryUpdateCourier = 'UPDATE Couriers SET order_number = ? WHERE courier_id = ?';
        db.run(queryUpdateCourier, [orderNumber, courierId], function (err) {
            if (err) {
                console.error('Ошибка при обновлении информации о курьере:', err);
            }
        });
    };

    // Выполнение последовательности операций
    checkProductAvailability()
        .then(createOrder)
        .catch((error) => {
            res.status(400).json({ error: error });
        });
});


// Редактирование данных в таблице Orders
app.put('/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const { status, courier_id, address, reason_of_refusal } = req.body;

  // Обновление данных в таблице Orders
  const queryOrder = 'UPDATE Orders SET status_id=?, courier_id=?, address=?, reason_of_refusal=? WHERE id=?';

// Проверяем, было ли передано значение reason_of_refusal в запросе
const params = [status, courier_id, address, req.body.reason_of_refusal !== undefined ? req.body.reason_of_refusal : null, orderId];

db.run(queryOrder, params, function (err) {
  if (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
    return;
  }

    if (this.changes > 0) {
  console.log('Изменения в таблице Orders были успешно внесены.');
  // Проверка, было ли изменение статуса заказа на "Доставлен" или "Отменён"
  if (status === 3 || status === 4) {
    console.log('Статус заказа был изменен на Доставлен или Отменён.');
    // Получаем информацию о курьере, назначенном на этот заказ
    const queryGetCourier = 'SELECT courier_id FROM Orders WHERE id=?';
    db.get(queryGetCourier, [orderId], (err, row) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
        return;
      }

      // Если курьер был назначен на этот заказ, освободить его
      const assignedCourierId = row.courier_id;
      console.log('ID назначенного курьера:', assignedCourierId);
      if (assignedCourierId !== null) {
        console.log('Курьер был назначен на этот заказ.');
        // Обновляем информацию о курьере
        updateCourier(null, assignedCourierId, () => {
        console.log('Информация о курьере успешно обновлена.');
        // Назначаем курьера на другой заказ
        assignCourierToAnotherOrder(orderId, assignedCourierId); // Передаем assignedCourierId в качестве второго аргумента
      });
      } else {
        console.log('Курьер не был назначен на этот заказ.');
        res.json({ changes: this.changes });
      }
    });
  } else {
    console.log('Статус заказа не был изменен на Доставлен или Отменён.');
    res.json({ changes: this.changes });
  }
} else {
  console.log('Изменения в таблице Orders не были внесены.');
  res.status(500).json({ error: 'No changes made' });
}
  });
});

// Функция обновления информации о курьере
const updateCourier = (orderNumber, courierId, callback) => {
  console.log('Обновление информации о курьере...');
  const queryUpdateCourier = 'UPDATE Couriers SET order_number = ? WHERE courier_id = ?';
  db.run(queryUpdateCourier, [orderNumber, courierId], function (err) {
    if (err) {
      console.error('Ошибка при обновлении информации о курьере:', err);
      callback(err); // Вызываем обратный вызов с ошибкой
    } else {
      console.log('Информация о курьере успешно обновлена.');
      callback(null); // Вызываем обратный вызов без ошибки
    }
  });
};

const assignCourierToAnotherOrder = (currentOrderId, courierId) => {
    // Получаем информацию о текущем курьере
    const queryCourier = 'SELECT * FROM Couriers WHERE courier_id = ?';
    db.get(queryCourier, [courierId], (err, courier) => {
        if (err) {
            console.error(err);
            return;
        }

        // Если курьер не найден
        if (!courier) {
            console.log(`Курьер с ID ${courierId} не найден.`);
            return;
        }

        // Получаем информацию о предыдущем курьере
        const queryPrevCourier = 'SELECT * FROM Orders WHERE id = ?';
        db.get(queryPrevCourier, [currentOrderId], (err, order) => {
            if (err) {
                console.error(err);
                return;
            }

            // Если предыдущий курьер найден
            if (order && order.courier_id !== null) {
                const prevCourierId = order.courier_id;
                // Удаляем order_number у предыдущего курьера
                updateCourier(null, prevCourierId, (err) => {
                    if (!err) {
                        console.log(`Предыдущему курьеру ${prevCourierId} удален order_number.`);
                    }
                });
            }

            // Поиск ближайшего свободного заказа
            const queryNearestOrder = `
                SELECT id, order_number FROM Orders
                WHERE courier_id IS NULL
                ORDER BY id ASC
                LIMIT 1
            `;
            db.get(queryNearestOrder, [], (err, nearestOrder) => {
                if (err) {
                    console.error(err);
                    return;
                }

                // Если ближайший заказ найден
                if (nearestOrder) {
                    const nearestOrderId = nearestOrder.id;
                    const nearestOrderNumber = nearestOrder.order_number;
                    // Назначаем ближайший заказ текущему курьеру
                    updateOrdersAndCourier(nearestOrderId, courierId, nearestOrderNumber, (err) => {
                        if (!err) {
                            console.log(`Курьеру ${courierId} назначен ближайший заказ ${nearestOrderNumber}`);
                        }
                    });
                } else {
                    console.log('Нет доступных заказов для назначения.');
                }
            });
        });
    });
};

const updateOrdersAndCourier = (orderId, courierId, orderNumber, callback) => {
    // Обновляем информацию о курьере в заказе
    const queryUpdateOrder = 'UPDATE Orders SET courier_id=?, order_number=? WHERE id=?';
    db.run(queryUpdateOrder, [courierId, orderNumber, orderId], function (err) {
        if (err) {
            console.error('Ошибка при обновлении информации о заказе:', err);
            callback(err); // Вызываем обратный вызов с ошибкой
        } else {
            console.log('Информация о заказе успешно обновлена.');
            // Обновляем информацию о курьере
            updateCourier(orderNumber, courierId, (err) => {
                if (!err) {
                    console.log('Информация о курьере успешно обновлена.');
                    callback(null); // Вызываем обратный вызов без ошибки
                }
            });
        }
    });
};

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


// Обновление позиции в заказе
app.put('/orders/:orderId/items/:itemId', (req, res) => {
  const orderId = req.params.orderId;
  const itemId = req.params.itemId;
  const { quantity } = req.body;

  // Проверка статуса заказа
  const queryCheckOrderStatus = 'SELECT status_id FROM Orders WHERE id=?';
  db.get(queryCheckOrderStatus, [orderId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
      return;
    }

    const orderStatusId = row.status_id;
    // Проверяем, что статус заказа позволяет изменять позиции
    if (orderStatusId == '1' || orderStatusId == '5') {
      res.status(400).json({ error: 'Невозможно изменить позицию в заказе. Статус заказа не позволяет это сделать.' });
      return;
    }

    // Обновляем количество товара в позиции заказа
    const queryUpdateOrderItem = 'UPDATE Order_Lines SET quantity=? WHERE order_id=? AND product_id=?';
    db.run(queryUpdateOrderItem, [quantity, orderId, itemId], function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes > 0) {
        console.log('Позиция в заказе была успешно обновлена.');
        res.json({ success: true });
      } else {
        console.log('Позиция в заказе не была обновлена.');
        res.status(500).json({ error: 'Не удалось обновить позицию в заказе.' });
      }
    });
  });
});

// Удаление позиции из заказа
app.delete('/orders/:orderId/items/:itemId', (req, res) => {
  const orderId = req.params.orderId;
  const itemId = req.params.itemId;

  // Проверка статуса заказа
  const queryCheckOrderStatus = 'SELECT status_id FROM Orders WHERE id=?';
  db.get(queryCheckOrderStatus, [orderId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
      return;
    }

    const orderStatusId = row.status_id;
    // Проверяем, что статус заказа позволяет изменять позиции
    if (orderStatusId == '1' || orderStatusId == '5') {
      res.status(400).json({ error: 'Невозможно удалить позицию из заказа. Статус заказа не позволяет это сделать.' });
      return;
    }

    // Удаляем позицию из заказа
    const queryDeleteOrderItem = 'DELETE FROM Order_Lines WHERE order_id=? AND product_id=?';
    db.run(queryDeleteOrderItem, [orderId, itemId], function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes > 0) {
        console.log('Позиция была успешно удалена из заказа.');
        res.json({ success: true });
      } else {
        console.log('Позиция не была удалена из заказа.');
        res.status(500).json({ error: 'Не удалось удалить позицию из заказа.' });
      }
    });
  });
});


// Замена товара в заказе
app.put('/orders/:orderId/items/:itemId/replace/:replacementId', (req, res) => {
  const orderId = req.params.orderId;
  const itemId = req.params.itemId;
  const replacementId = req.params.replacementId;

  // Проверка статуса заказа
  const queryCheckOrderStatus = 'SELECT status_id FROM Orders WHERE id=?';
  db.get(queryCheckOrderStatus, [orderId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
      return;
    }

    const orderStatusId = row.status_id;
    // Проверяем, что статус заказа позволяет изменять позиции
    if (orderStatusId == '1' || orderStatusId == '5') {
      res.status(400).json({ error: 'Невозможно заменить товар в заказе. Статус заказа не позволяет это сделать.' });
      return;
    }

    // Обновляем товар в позиции заказа
    const queryReplaceOrderItem = 'UPDATE Order_Lines SET product_id=? WHERE order_id=? AND product_id=?';
    db.run(queryReplaceOrderItem, [replacementId, orderId, itemId], function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes > 0) {
        console.log('Товар в заказе был успешно заменен.');
        res.json({ success: true });
      } else {
        console.log('Товар в заказе не был заменен.');
        res.status(500).json({ error: 'Не удалось заменить товар в заказе.' });
      }
    });
  });
});


//----------------------------------Status----------------------------

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


//-----------------------Barcode------------------------------


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
