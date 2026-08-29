package server

import (
	"net/http"
	"os"
	"runtime/debug"

	"ascii-empires-server/internal/controllers"
	"ascii-empires-server/internal/logger"
	"ascii-empires-server/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// Same shape as journal's routes.go (panic recovery, then the shared middleware
// chain, then each controller registers itself). CORS is new here — journal is
// server-rendered same-origin; this API serves the separate Vite dev server /
// static build, so it needs to allow that origin explicitly (with credentials,
// since auth rides in a cookie).
func (s *FiberServer) RegisterFiberRoutes() {
	s.App.Use(cors.New(cors.Config{
		AllowOrigins:     os.Getenv("CLIENT_ORIGIN"),
		AllowCredentials: true,
	}))

	s.App.Use(func(c *fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Recovered panic:", "error", r)
				debug.PrintStack()
				c.Status(http.StatusInternalServerError).SendString("Internal Server Error")
			}
		}()
		return c.Next()
	})

	s.App.Use(middleware.DeserializeToken)

	for _, controller := range controllers.GetControllers() {
		controller.Init(s.db.DB, s.App)
		controller.RegisterApiRoutes()
	}

	api := s.App.Group("/api")
	api.Get("/health", s.healthHandler)
}

func (s *FiberServer) healthHandler(c *fiber.Ctx) error {
	return c.JSON(s.db.Health())
}
