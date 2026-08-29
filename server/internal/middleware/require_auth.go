package middleware

import (
	"ascii-empires-server/internal/models"
	"ascii-empires-server/internal/utils"

	"github.com/gofiber/fiber/v2"
)

// Same purpose as journal's RequireAuth, adapted for a JSON API instead of
// SSR views: 401 instead of a redirect to a login page.
func RequireAuth(ctx *fiber.Ctx) error {
	user := utils.GetLocal[models.User](ctx, "currentUser")
	if user == nil {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "not authenticated"})
	}
	return ctx.Next()
}
