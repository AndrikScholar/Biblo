-- Base de datos de Biblo, la biblioteca viva.
-- Se importa desde phpMyAdmin (pestaña Importar) o con:
--   C:\xampp\mysql\bin\mysql.exe -u root < database\biblo.sql
-- Ojo: borra y vuelve a crear la base `biblo` con sus datos de ejemplo.
--
-- Cuenta de administrador de ejemplo (entra en http://localhost:5173/#admin):
--   correo:     admin@biblo.test
--   contraseña: biblo-admin-2026

DROP DATABASE IF EXISTS biblo;
CREATE DATABASE biblo CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE biblo;

-- El catálogo. Lo visual de cada libro (atmósfera, intro, bordes, lomo)
-- vive en el código de la página y se une por `id`.
CREATE TABLE libros (
  id          VARCHAR(40)   NOT NULL PRIMARY KEY,
  estante     CHAR(1)       NOT NULL,
  orden       INT           NOT NULL,
  titulo      VARCHAR(120)  NOT NULL,
  autor       VARCHAR(120)  NULL,
  anio        VARCHAR(20)   NULL,
  genero      ENUM('terror', 'fantasía', 'aventura') NOT NULL,
  procedencia VARCHAR(120)  NULL,
  signatura   VARCHAR(20)   NOT NULL,
  portada     VARCHAR(200)  NULL,
  precio      DECIMAL(7,2)  NOT NULL,
  descripcion TEXT          NOT NULL,
  cita        TEXT          NULL,
  stock       INT UNSIGNED  NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(80)   NOT NULL,
  email           VARCHAR(160)  NOT NULL UNIQUE,
  contrasena_hash VARCHAR(255)  NOT NULL,
  rol             ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente',
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE direcciones (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT UNSIGNED  NOT NULL,
  destinatario   VARCHAR(120)  NOT NULL,
  calle          VARCHAR(120)  NOT NULL,
  num_exterior   VARCHAR(10)   NOT NULL,
  num_interior   VARCHAR(10)   NULL,
  colonia        VARCHAR(80)   NOT NULL,
  codigo_postal  CHAR(5)       NOT NULL,
  ciudad         VARCHAR(80)   NOT NULL,
  estado         VARCHAR(40)   NOT NULL,
  telefono       VARCHAR(15)   NOT NULL,
  referencias    VARCHAR(200)  NULL,
  predeterminada BOOLEAN       NOT NULL DEFAULT FALSE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Un pedido nace 'pendiente' y el pago lo deja 'pagado' o 'rechazado'.
-- El envío solo existe para los pagados: lo mueve el administrador.
CREATE TABLE pedidos (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id       INT UNSIGNED  NOT NULL,
  direccion_id     INT UNSIGNED  NOT NULL,
  total            DECIMAL(9,2)  NOT NULL,
  estado_pago      ENUM('pendiente', 'pagado', 'rechazado') NOT NULL DEFAULT 'pendiente',
  estado_envio     ENUM('en_preparacion', 'enviado', 'entregado') NULL,
  creado_en        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entrega_estimada DATE          NULL,
  FOREIGN KEY (usuario_id)   REFERENCES usuarios(id),
  FOREIGN KEY (direccion_id) REFERENCES direcciones(id)
) ENGINE=InnoDB;

-- El precio se copia al comprar: si luego cambia en el catálogo,
-- el pedido conserva lo que se pagó.
CREATE TABLE detalle_pedido (
  pedido_id       INT UNSIGNED  NOT NULL,
  libro_id        VARCHAR(40)   NOT NULL,
  cantidad        INT UNSIGNED  NOT NULL,
  precio_unitario DECIMAL(7,2)  NOT NULL,
  PRIMARY KEY (pedido_id, libro_id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (libro_id)  REFERENCES libros(id)
) ENGINE=InnoDB;

-- Cada intento de cobro del simulador de pagos. Por seguridad NUNCA se
-- guarda el número de tarjeta ni el CVV: solo la marca y los 4 últimos
-- dígitos, como el comprobante de una terminal.
CREATE TABLE pagos (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedido_id  INT UNSIGNED  NOT NULL,
  resultado  ENUM('aprobado', 'rechazado') NOT NULL,
  marca      VARCHAR(20)   NOT NULL,
  ultimos4   CHAR(4)       NOT NULL,
  motivo     VARCHAR(160)  NULL,
  creado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Los 8 libros. Los id raros (ragnarok, abisal...) vienen de los libros
-- que había antes en cada hueco: así no se pierde el progreso guardado.
INSERT INTO libros (id, estante, orden, genero, titulo, autor, anio, procedencia, signatura, portada, precio, descripcion, cita, stock) VALUES
('the-book-of-bill', 'a', 1, 'terror', 'Libro de Bill', NULL, NULL, 'procedencia incierta', 'X-666 · CIP', '/covers/libro-de-bill.jpg', 6.66,
 'Se vende como autoayuda. La faja dice bestseller, el sello de cera dice otra cosa. Cada lector jura haberlo comprado por accidente, y cada uno lo recomienda a alguien más antes de terminar el primer capítulo.',
 'Paso uno: pide un deseo pequeño. Paso dos: agradece en voz alta. Paso tres: no leas el paso cuatro.', 1),

-- C-207 y 12,07: la copia de Per Abbat (1207), el único manuscrito que se conserva
('ragnarok', 'a', 2, 'aventura', 'El Cantar del mío Cid', 'Anónimo', 'c. 1200', NULL, 'C-207 · ABB', '/covers/mio-cid.webp', 12.07,
 'Acusado ante el rey Alfonso VI por la envidia de algunos nobles, Rodrigo Díaz de Vivar, el Cid Campeador, es desterrado de Castilla. Con solo nueve días para abandonar el reino, deja a su mujer, doña Jimena, y a sus dos hijas en el monasterio de San Pedro de Cardeña, y parte con un puñado de fieles a ganarse el pan y la honra con su espada, sin dejar de buscar el perdón de su señor. Es el poema épico más antiguo que se conserva de la literatura española: un cantar de gesta anónimo, compuesto hacia 1200, que nos ha llegado en una única copia firmada por Per Abbat en 1207 y que no se imprimió hasta 1779.',
 '¡Dios, qué buen vassallo, si oviesse buen señore!', 4),

-- G-030: los «treinta, o pocos más, desaforados gigantes»; 16,05: el año de la primera parte
('dunas-de-hierro', 'a', 3, 'aventura', 'Don Quijote de la Mancha', 'Miguel de Cervantes', '1605', NULL, 'G-030 · CER', '/covers/don-quijote.jpg', 16.05,
 'Un hidalgo manchego lee tantos libros de caballerías que acaba creyéndose uno de sus héroes. Se pone una armadura vieja, llama Rocinante a su caballo flaco, convierte a una labradora del Toboso en la dama de sus pensamientos y sale a los caminos a deshacer agravios. Lo acompaña Sancho Panza, un labrador de su aldea al que ha prometido el gobierno de una ínsula. Donde don Quijote ve gigantes, castillos y ejércitos, Sancho ve molinos, ventas y rebaños de ovejas. Publicada en dos partes, en 1605 y 1615, está considerada la primera novela moderna.',
 'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.', 30),

('abisal', 'a', 4, 'terror', 'La Llamada de Cthulhu', 'H. P. Lovecraft', '1928', NULL, 'N-733 · LOV', '/covers/la-llamada-de-cthulhu.jpg', 21.00,
 'La obra fundamental de los Mitos de Cthulhu es un relato apasionante que introduce a los lectores a Cthulhu, una entidad extraterrestre de terror grotesco. La búsqueda del narrador para reconstruir las pistas dejadas por su difunto tío sobre la existencia de dicha criatura atrapará y helará la sangre de los lectores hasta el final.',
 'Ph’nglui mglw’nafh Cthulhu R’lyeh wgah’nagl fhtagn. En su morada de R’lyeh, el difunto Cthulhu espera soñando.', 7),

('ceniza-y-corona', 'a', 5, 'terror', 'IT', 'Stephen King', '1986', NULL, 'D-027 · KIN', '/covers/it.webp', 24.50,
 'En 1958, en el pueblo de Derry, Maine, siete niños marginados que se hacen llamar el Club de los Perdedores descubren que algo vive bajo las calles. Despierta cada veintisiete años, se alimenta de los niños y adopta la forma de lo que más temen, casi siempre la de un payaso llamado Pennywise. Ya adultos y lejos de Derry, una llamada les recuerda una promesa que hicieron de niños y que creían haber olvidado.',
 'Todos flotan aquí abajo. Cuando estés aquí abajo conmigo, tú también flotarás.', 7),

('orbita-muerta', 'b', 6, 'fantasía', 'El Principito', 'Antoine de Saint-Exupéry', '1943', NULL, 'B-612 · SAI', '/covers/el-principito.webp', 19.90,
 'Un aviador cae con su avioneta en mitad del desierto del Sahara y, mientras intenta repararla, conoce a un niño de cabellos dorados que dice venir de un asteroide diminuto. El principito le cuenta su viaje por planetas habitados por adultos muy extraños, lo que aprendió de un zorro y por qué no puede olvidar la rosa que dejó en casa. Una fábula sobre la amistad, la pérdida y la mirada de la infancia.',
 'Solo se ve bien con el corazón. Lo esencial es invisible a los ojos.', 12),

-- M-106 y 10,60: el 10/6 escrito en el sombrero del Sombrerero
('jardin-hongos-lentos', 'b', 7, 'fantasía', 'Alicia en el país de las Maravillas', 'Lewis Carroll', '1865', NULL, 'M-106 · CAR', '/covers/alicia.jpg', 10.60,
 'Una tarde de verano, aburrida a la orilla del río, Alicia ve pasar corriendo a un Conejo Blanco con chaleco que saca un reloj del bolsillo y se lamenta de que llega tarde. Lo sigue hasta una madriguera, cae durante lo que parece una eternidad y llega a un país donde un pastelito puede volverte gigante, un gato desaparece dejando solo su sonrisa y la hora del té no termina nunca. Allí, entre la Oruga, el Sombrerero y la temible Reina de Corazones, nada es lo que parece, empezando por ella misma.',
 '—Aquí todos estamos locos. Yo estoy loco, tú estás loca. —¿Cómo sabes que yo estoy loca? —preguntó Alicia. —Tienes que estarlo —dijo el Gato—, o no habrías venido.', 6),

-- P-004: el número 4 de Privet Drive; 9,75: el andén nueve y tres cuartos
('lluvia-nombre-falso', 'b', 8, 'fantasía', 'Harry Potter y la piedra filosofal', 'J. K. Rowling', '1997', NULL, 'P-004 · ROW', '/covers/harry-potter.jpg', 9.75,
 'Harry Potter lleva diez años viviendo con sus tíos, los Dursley, que lo tratan como un estorbo y lo hacen dormir en la alacena de debajo de la escalera. Poco antes de cumplir once años empiezan a llegarle cartas que sus tíos se empeñan en que no lea, hasta que un hombre enorme llamado Hagrid aparece para contarle la verdad: Harry es un mago y tiene una plaza esperándolo en Hogwarts, el Colegio de Magia y Hechicería. Allí descubre el quidditch, hace amigos de verdad por primera vez y empieza a entender por qué todo el mundo mágico conoce su nombre, y que en algún lugar del castillo se guarda un secreto. Fue la primera novela de J. K. Rowling, publicada en Londres en 1997, y abrió una saga de siete libros.',
 'El señor y la señora Dursley, que vivían en el número 4 de Privet Drive, estaban orgullosos de decir que eran muy normales, afortunadamente.', 9);

-- La cuenta de administración (contraseña arriba, en la cabecera)
INSERT INTO usuarios (nombre, email, contrasena_hash, rol) VALUES
('Administración de Biblo', 'admin@biblo.test', '$2y$10$hmfsvotVmfMfUZelK8IYRetpyvA.hBjAThR79EbAyOQZsuYL8N9h6', 'admin');
