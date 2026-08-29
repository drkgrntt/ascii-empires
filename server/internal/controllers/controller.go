package controllers

import (
	"sync"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Same interface as journal's, minus RegisterViewRoutes: this server is a pure
// JSON/WebSocket API for the existing React SPA, with no server-rendered views.
type Controller interface {
	Init(db *gorm.DB, app *fiber.App)
	RegisterApiRoutes()
}

var (
	controllersMux sync.Mutex
	controllers    []Controller
)

func registerController(controller Controller) {
	controllersMux.Lock()
	defer controllersMux.Unlock()
	controllers = append(controllers, controller)
}

func GetControllers() []Controller {
	return controllers
}
