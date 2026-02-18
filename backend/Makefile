.PHONY: build up down logs restart clean db-shell

# Сборка и запуск
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

# Логи
logs:
	docker-compose logs -f

logs-app:
	docker-compose logs -f app

logs-db:
	docker-compose logs -f postgres

# Перезапуск
restart:
	docker-compose restart

restart-app:
	docker-compose restart app

# Очистка (удаляет volumes)
clean:
	docker-compose down -v

# Подключение к БД
db-shell:
	docker-compose exec postgres psql -U postgres -d history_db

# Пересборка и запуск
rebuild:
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d
