BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS `Users` (
	`id`	INTEGER,
	`email`	TEXT,
	`password`	TEXT,
	`first_name`	TEXT,
	`last_name`	TEXT,
	`delivery_address`	TEXT,
	`reset_code`	TEXT,
	`reset_code_expiry`	TEXT,
	PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `Status` (
	`id`	INTEGER,
	`name`	TEXT,
	PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `Sales` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`order_date`	DATE NOT NULL,
	`total_sales`	DECIMAL ( 10 , 2 ) NOT NULL,
	`quantity_sold`	INTEGER NOT NULL,
	`product_id`	INTEGER NOT NULL,
	FOREIGN KEY(`product_id`) REFERENCES `Products`(`id`)
);
CREATE TABLE IF NOT EXISTS `Products` (
	`id`	INTEGER,
	`name`	TEXT,
	`image_resource`	BLOB,
	`price`	TEXT,
	`color_primary`	TEXT,
	`color_light`	TEXT,
	`description`	TEXT,
	`category_id`	INTEGER,
	`quantity`	INTEGER,
	`barcode`	TEXT,
	`reset_code`	TEXT,
	`reset_code_expiry`	TEXT,
	PRIMARY KEY(`id`),
	FOREIGN KEY(`category_id`) REFERENCES `Category`(`id`)
);
CREATE TABLE IF NOT EXISTS `Product_Sales_Report` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`report_date`	DATE NOT NULL,
	`product_id`	INTEGER NOT NULL,
	`quantity_sold`	INTEGER NOT NULL DEFAULT 0,
	`total_sales`	DECIMAL ( 10 , 2 ) NOT NULL DEFAULT 0.00,
	`remaining_quantity`	INTEGER NOT NULL DEFAULT 0,
	`category_id`	INTEGER NOT NULL,
	FOREIGN KEY(`product_id`) REFERENCES `Products`(`id`),
	FOREIGN KEY(`category_id`) REFERENCES `Category`(`id`)
);
CREATE TABLE IF NOT EXISTS `Orders` (
	`id`	INTEGER,
	`user_id`	INTEGER,
	`order_number`	INTEGER,
	`delivery_time`	TEXT,
	`status_id`	INTEGER,
	`user_comment`	TEXT,
	`courier_id`	INTEGER,
	`address`	TEXT,
	FOREIGN KEY(`user_id`) REFERENCES `Users`(`id`),
	PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `Order_Lines` (
	`order_id`	INTEGER,
	`product_id`	INTEGER,
	`quantity`	INTEGER,
	FOREIGN KEY(`product_id`) REFERENCES `Products`(`id`),
	FOREIGN KEY(`order_id`) REFERENCES `Orders`(`id`)
);
CREATE TABLE IF NOT EXISTS `OrderReport` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`report_date`	DATE,
	`total_orders`	INTEGER DEFAULT 0,
	`delivered_orders`	INTEGER DEFAULT 0,
	`cancelled_orders`	INTEGER DEFAULT 0,
	`total_profit`	DECIMAL ( 10 , 2 ) DEFAULT 0.00
);
CREATE TABLE IF NOT EXISTS `Inventory` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`product_id`	INTEGER NOT NULL,
	`quantity`	INTEGER NOT NULL,
	FOREIGN KEY(`product_id`) REFERENCES `Products`(`id`)
);
CREATE TABLE IF NOT EXISTS `Couriers` (
	`courier_id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`first_name`	TEXT,
	`last_name`	TEXT,
	`second_name`	TEXT,
	`contact_number`	TEXT,
	`status_id`	NUMERIC,
	`Id_number`	TEXT,
	`login_courier`	TEXT,
	`pass_courier`	INTEGER,
	`order_number`	TEXT,
	FOREIGN KEY(`status_id`) REFERENCES `Courier_Status`(`status_id`)
);
CREATE TABLE IF NOT EXISTS `Courier_Work_Report` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`courier_id`	INTEGER NOT NULL,
	`order_id`	INTEGER NOT NULL,
	`order_date`	DATE NOT NULL,
	`order_total`	DECIMAL ( 10 , 2 ) NOT NULL,
	FOREIGN KEY(`order_id`) REFERENCES `Orders`(`id`),
	FOREIGN KEY(`courier_id`) REFERENCES `Couriers`(`courier_id`)
);
CREATE TABLE IF NOT EXISTS `Courier_Status` (
	`status_id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`status_name`	TEXT
);
CREATE TABLE IF NOT EXISTS `ConfirmationCodes` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`email`	TEXT NOT NULL,
	`code`	TEXT NOT NULL,
	`sent_at`	TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS `Category` (
	`id`	INTEGER,
	`nameCategory`	TEXT,
	PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `AdminCredentials` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`username`	TEXT NOT NULL UNIQUE,
	`password_hash`	TEXT NOT NULL,
	`salt`	TEXT NOT NULL,
	`created_at`	TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	`last_login`	TIMESTAMP
);
CREATE TRIGGER update_product_sales_report_on_sale
AFTER INSERT ON Sales
BEGIN
    INSERT OR IGNORE INTO Product_Sales_Report (report_date, product_id, quantity_sold, total_sales, remaining_quantity, category_id)
    VALUES (DATE('now'), NEW.product_id, NEW.quantity_sold, NEW.total_sales, (SELECT quantity FROM Products WHERE id = NEW.product_id), (SELECT category_id FROM Products WHERE id = NEW.product_id));
    
    UPDATE Product_Sales_Report
    SET quantity_sold = quantity_sold + NEW.quantity_sold,
        total_sales = total_sales + NEW.total_sales,
        remaining_quantity = (SELECT quantity FROM Products WHERE id = NEW.product_id) - (SELECT SUM(quantity_sold) FROM Sales WHERE product_id = NEW.product_id)
    WHERE report_date = DATE('now') AND product_id = NEW.product_id;
END;
CREATE TRIGGER update_product_quantity_trigger
AFTER INSERT ON Order_Lines
BEGIN
  
  UPDATE Products
  SET quantity = quantity - NEW.quantity
  WHERE id = NEW.product_id;
END;
CREATE TRIGGER update_order_report_on_insert
AFTER INSERT ON Orders
BEGIN
    INSERT OR IGNORE INTO OrderReport (report_date) VALUES (DATE('now'));
    UPDATE OrderReport
    SET total_orders = total_orders + 1
    WHERE report_date = DATE('now');
END;
CREATE TRIGGER update_order_report_on_delivered AFTER UPDATE OF status_id ON Orders WHEN NEW.status_id = (SELECT id FROM Status WHERE name = 'Доставлен') BEGIN UPDATE OrderReport SET delivered_orders = delivered_orders + 1, total_profit = total_profit + (SELECT total_sales FROM Sales WHERE id = NEW.id) WHERE report_date = DATE('now'); END;
CREATE TRIGGER update_order_report_on_cancelled AFTER UPDATE OF status_id ON Orders WHEN NEW.status_id = (SELECT id FROM Status WHERE name = 'Отменен') BEGIN UPDATE OrderReport SET cancelled_orders = cancelled_orders + 1 WHERE report_date = DATE('now'); END;
CREATE TRIGGER update_courier_work_report_on_delivery
AFTER INSERT ON Orders
BEGIN
    INSERT INTO Courier_Work_Report (courier_id, order_id, order_date, order_total)
    VALUES (NEW.courier_id, NEW.id, NEW.delivery_time, 
            CASE WHEN (SELECT id FROM Status WHERE name = 'Доставлен') = NEW.status_id 
            THEN (SELECT total_sales FROM Sales WHERE id = NEW.id)
            ELSE 0 END);
END;
CREATE TRIGGER cancel_order_trigger
AFTER DELETE ON Order_Lines
BEGIN
  
  UPDATE Products
  SET quantity = quantity + (
    SELECT quantity FROM Order_Lines
    WHERE ROWID = OLD.ROWID
  )
  WHERE id = (
    SELECT product_id FROM Order_Lines
    WHERE ROWID = OLD.ROWID
  );
END;
COMMIT;
