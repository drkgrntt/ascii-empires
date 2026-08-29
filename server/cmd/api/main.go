package main

import (
	"fmt"
	"os"

	"ascii-empires-server/internal/logger"
	"ascii-empires-server/internal/server"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	srv := server.New()
	srv.RegisterFiberRoutes()

	port := os.Getenv("PORT")
	if port == "" {
		port = "4816"
	}

	logger.Info(fmt.Sprintf("Listening on :%s", port))
	if err := srv.Listen(":" + port); err != nil {
		logger.Error("Server error", "error", err.Error())
		os.Exit(1)
	}
}
