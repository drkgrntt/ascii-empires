package server

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"ascii-empires-server/internal/database"
)

// Same shape as journal's FiberServer.
type FiberServer struct {
	*fiber.App

	db *database.Service
}

func New() *FiberServer {
	time.Local = time.UTC

	server := &FiberServer{
		App: fiber.New(fiber.Config{
			ServerHeader: "ascii-empires-server",
			AppName:      "ascii-empires-server",
		}),

		db: database.New(),
	}

	return server
}
