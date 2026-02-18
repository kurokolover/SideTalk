package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jmoiron/sqlx"
	"github.com/kurokolover/SideTalk/configs"
	"github.com/kurokolover/SideTalk/internal/handler"
	"github.com/kurokolover/SideTalk/internal/repo"
	"github.com/kurokolover/SideTalk/internal/usecase"
	_ "github.com/lib/pq"
	"github.com/pressly/goose/v3"
)

func main() {
	// Загрузка конфигурации
	cfg, err := configs.Load("configs/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Config loaded: server port=%d, db host=%s", cfg.Server.Port, cfg.Database.Host)

	// Подключение к БД
	db, err := initDB(cfg.Database) // ИСПРАВЛЕНО: добавил initDB
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Database connected successfully")

	// ЗАПУСК МИГРАЦИЙ - ИСПРАВЛЕНО: добавил вызов
	if err := runMigrations(db.DB); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Migrations applied successfully")

	// Инициализация слоев
	historyRepo := repo.NewHistoryTable(db)

	addCommentUsecase := usecase.NewAddCommentUsecase(historyRepo)
	addCommentHandler := handler.NewAddCommentHandler(addCommentUsecase)

	addHistoryUsecase := usecase.NewAddHistoryUsecase(historyRepo)
	addHistoryHandler := handler.NewAddHistoryHandler(addHistoryUsecase)

	getHistoryUsecase := usecase.NewGetHistoryUsecase(historyRepo)
	getHistoryHandler := handler.NewGetHistoryHandler(getHistoryUsecase)

	addLikeUsecase := usecase.NewAddLikeUsecase(historyRepo)
	addLikeHandler := handler.NewAddLikeHandler(addLikeUsecase)

	// Создание роутера
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(cfg.Server.ConnectionTimeout))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3090", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/add_comment", addCommentHandler.Handle)
		r.Post("/add_history", addHistoryHandler.Handle)
		r.Get("/get_histories", getHistoryHandler.Handle)
		r.Post("/add_like", addLikeHandler.Handle)
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Запуск сервера в горутине
	go func() {
		log.Printf("Server starting on port %d", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Graceful shutdown (это хороший тон, чтобы все работало хорошо)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}

// Инициализация базы данных
func initDB(cfg configs.DatabaseConfig) (*sqlx.DB, error) {
	db, err := sqlx.Connect("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	// Настройка пула соединений
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Проверка соединения
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping: %w", err)
	}

	return db, nil
}

// Выполняет миграции базы данных (создание таблиц, добавление колонок и т.д.)
// Миграция – это первичное выполнение SQL запросов при запуске БД
// Миграция должны выполнятся в порядке их создания, от старых к новым
func runMigrations(db *sql.DB) error {
	// Устанавливаем язык PostgreSQL
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("failed to set dialect: %w", err)
	}

	// Путь к директории с миграциями
	migrationsDir := "migrations"

	// Проверяем существование директории
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		log.Printf("Migrations directory %s does not exist, creating...", migrationsDir)
		if err := os.MkdirAll(migrationsDir, 0755); err != nil {
			return fmt.Errorf("failed to create migrations directory: %w", err)
		}
		// Если директория создана, возможно нужно создать файл миграции
		log.Printf("Please create migration files in %s directory", migrationsDir)
		return nil // Не возвращаем ошибку, просто выходим
	}

	// Применяем миграции
	if err := goose.Up(db, migrationsDir); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}
