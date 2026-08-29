package main

import (
	"ascii-empires-server/internal/database"
	"ascii-empires-server/internal/logger"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	database.New()
	database.AutoMigrate()
	logger.Info("AutoMigrated successfully")
}
