package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"ascii-empires-server/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/joho/godotenv/autoload"
)

// Mirrors journal's internal/database/database.go shape (Service wrapping
// *gorm.DB, connection reuse, Health/Close), with DB_* env var names instead of
// journal's inherited BLUEPRINT_DB_* (unrenamed go-blueprint scaffolding).
type Service struct {
	DB *gorm.DB
}

var (
	database   = os.Getenv("DB_DATABASE")
	password   = os.Getenv("DB_PASSWORD")
	username   = os.Getenv("DB_USERNAME")
	port       = os.Getenv("DB_PORT")
	host       = os.Getenv("DB_HOST")
	schema     = os.Getenv("DB_SCHEMA")
	dbInstance *Service
)

func connectionStr() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", username, password, host, port, database)
}

func New() *Service {
	if dbInstance != nil {
		return dbInstance
	}
	connStr := fmt.Sprintf("%s&TimeZone=UTC&search_path=%s", connectionStr(), schema)

	logMode := logger.Info
	if os.Getenv("APP_ENV") == "production" {
		logMode = logger.Error
	}
	db, err := gorm.Open(postgres.Open(connStr), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logMode),
		DisableForeignKeyConstraintWhenMigrating: true,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		log.Fatal(err)
	}
	dbInstance = &Service{DB: db}
	return dbInstance
}

func AutoMigrate() {
	dbInstance.DB.Exec("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

	if err := dbInstance.DB.AutoMigrate(models.GetModels()...); err != nil {
		log.Fatal(err)
	}
}

// Health checks the health of the database connection by pinging the database.
func (s *Service) Health() map[string]string {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	stats := make(map[string]string)

	sqlDb, err := s.DB.DB()
	if err != nil {
		log.Fatal(err)
	}

	err = sqlDb.PingContext(ctx)
	if err != nil {
		stats["status"] = "down"
		stats["error"] = fmt.Sprintf("db down: %v", err)
		return stats
	}

	stats["status"] = "up"
	stats["message"] = "It's healthy"

	dbStats := sqlDb.Stats()
	stats["open_connections"] = strconv.Itoa(dbStats.OpenConnections)
	stats["in_use"] = strconv.Itoa(dbStats.InUse)
	stats["idle"] = strconv.Itoa(dbStats.Idle)

	return stats
}

func (s *Service) Close() error {
	log.Printf("Disconnected from database: %s", database)
	sqlDb, err := s.DB.DB()
	if err != nil {
		log.Fatal(err)
	}
	return sqlDb.Close()
}
