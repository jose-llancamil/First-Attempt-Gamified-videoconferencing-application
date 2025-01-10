-- Insert example problems
INSERT INTO problemas (titulo, descripcion, dificultad, experiencia, monedas, entradas, salidas_esperadas)
VALUES 
('Sumar números', 'Resuelve la suma de dos números', 'Fácil', 100, 10, '[ [2, 3], [4, 5], [6, 7] ]', '[ 5, 9, 13 ]'),
('Verificar si un número es par o impar', 'Determina si un número dado es par o impar', 'Fácil', 100, 50, '[ [2], [7], [10] ]', '[ "Par", "Impar", "Par" ]'),
('Convertir Fahrenheit a Celsius', 'Convierte una temperatura dada en grados Fahrenheit a Celsius', 'Fácil', 100, 50, '[ [32], [212], [100] ]', '[ 0, 100, 37.78 ]'),
('Verificar si una cadena es palíndromo', 'Determina si una cadena se lee igual de izquierda a derecha y de derecha a izquierda', 'Fácil', 150, 60, '[ ["radar"], ["python"], ["level"] ]', '[ true, false, true ]'),
('Sumar los dígitos de un número', 'Dado un número entero positivo, calcula la suma de los dígitos que lo conforman', 'Fácil', 150, 60, '[ [123], [456], [789] ]', '[ 6, 15, 24 ]'),
('Encontrar el número mayor en una lista', 'Encuentra el número mayor en una lista de números', 'Intermedio', 300, 100, '[ [5, 3, 8, 2], [1, 4, 6], [9, 7, 5, 2] ]', '[ 8, 6, 9 ]'),
('Calcular el promedio de una lista', 'Calcula el promedio de una lista de números', 'Intermedio', 300, 100, '[ [5, 3, 8, 2], [1, 4, 6], [9, 7, 5, 2] ]', '[ 4.5, 3.67, 5.75 ]'),
('Ordenar una lista', 'Ordena una lista de números en orden ascendente', 'Intermedio', 300, 100, '[ [5, 3, 8, 2], [1, 4, 6], [9, 7, 5, 2] ]', '[ [2, 3, 5, 8], [1, 4, 6], [2, 5, 7, 9] ]'),
('Optimizar combinación de productos', 'Dado un presupuesto y una lista de precios, encuentra la combinación de productos que maximiza el uso del presupuesto sin excederlo', 'Difícil', 500, 200, '[ [100, [20, 50, 70, 101]], [200, [40, 60, 80, 120]] ]', '[ [20, 70], [80, 120] ]'),
('Calcular el número n-ésimo en la serie de Fibonacci', 'Genera el número n-ésimo en la serie de Fibonacci usando recursión', 'Difícil', 500, 200, '[ [5], [10], [15] ]', '[ 5, 55, 610 ]'),
('Resolver ecuaciones cuadráticas', 'Dada una ecuación cuadrática en la forma ax^2 + bx + c, encuentra sus raíces reales', 'Difícil', 550, 200, '[ [1, -3, 2], [1, 2, 1], [1, -1, -6] ]', '[ [2, 1], [-1, -1], [3, -2] ]');

INSERT INTO logros (nombre, descripcion, criterio, valor_criterio, imagen_url)
VALUES
('Cazador de Bugs', 'Resuelve 2 problemas y gana tu primera medalla.', 'problemas_completados', 2, '/static/images/blue_badge_lvl1.png'),
('Erradicador de Errores', 'Resuelve 10 problemas y domina el arte de resolver.', 'problemas_completados', 4, '/static/images/blue_badge_lvl2.png'),
('Maestro de soluciones', 'Resuelve 20 problemas y demuestra tu maestría.', 'problemas_completados', 10, '/static/images/blue_badge_lvl3.png'),

('Ahorrador', 'Acumula 100 monedas y da tu primer paso hacia la riqueza.', 'monedas', 100, '/static/images/red_badge_lvl1.png'),
('Recaudador', 'Acumula 200 monedas y amplía tus horizontes.', 'monedas', 200, '/static/images/red_badge_lvl2.png'),
('Magnate', 'Acumula 300 monedas y lidera la economía del juego.', 'monedas', 300, '/static/images/red_badge_lvl3.png'),

('Aspirante', 'Alcanza el nivel 2 y desbloquea nuevas posibilidades.', 'nivel', 2, '/static/images/yellow_badge_lvl1.png'),
('Héroe del Código', 'Alcanza el nivel 3 y solidifica tu leyenda.', 'nivel', 3, '/static/images/yellow_badge_lvl2.png'),
('Leyenda del Software', 'Alcanza el nivel 5 y escribe tu nombre en la historia.', 'nivel', 5, '/static/images/yellow_badge_lvl3.png'),

('Cazador de Recompensas', 'Adquiere tu primera recompensa y desbloquea el camino al éxito.', 'recompensas_adquiridas', 1, '/static/images/green_badge_lvl1.png'),
('Maestro del Comercio', 'Adquiere 5 recompensas y demuestra tu habilidad para negociar.', 'recompensas_adquiridas', 3, '/static/images/green_badge_lvl2.png'),
('Coleccionista Legendario', 'Adquiere 10 recompensas y conviértete en el mayor coleccionista.', 'recompensas_adquiridas', 5, '/static/images/green_badge_lvl3.png');



-- Insert example rewards
INSERT INTO recompensas (nombre, descripcion, costo_monedas)
VALUES
('Certificado de Excelencia', 'Recibe un certificado de excelencia por tu desempeño', 10),
('Punto Extra', 'Gana 1 punto extra en la evaluación final', 10),
('Extensión de Entrega', 'Obtén 24 horas extra para entregar un proyecto', 10),
('Pizza Individual', 'Disfruta de una pizza personal a cuenta del profesor', 10),
('Café Premium', 'El profesor te invita un café especial', 10);


-- Insert example titles
INSERT INTO titulos (nivel_min, nivel_max, titulo)
VALUES 
(1, 4, 'Principiante'),
(5, 9, 'Guerrero'),
(10, 15, 'Héroe'),
(16, 20, 'Maestro'),
(21, 25, 'Leyenda'),
(26, 30, 'Sabio');