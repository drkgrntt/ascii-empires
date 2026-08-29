package middleware

import (
	"ascii-empires-server/internal/logger"
	"ascii-empires-server/internal/models"
	"ascii-empires-server/internal/utils"

	"github.com/gofiber/fiber/v2"
)

// Same shape as journal's DeserializeToken: reads the `x-token` cookie, and if
// it validates, attaches the User to ctx.Locals for downstream handlers/RequireAuth.
func DeserializeToken(ctx *fiber.Ctx) error {
	token := ctx.Cookies("x-token")

	if token == "" {
		return ctx.Next()
	}

	data, err := utils.ValidateToken(token)
	if err != nil {
		logger.Error("Error validating token", "error", err.Error())
		return ctx.Next()
	}

	var user models.User
	err = db.Where("id = ?", data.UserID).First(&user).Error
	if err != nil {
		logger.Error("Error getting user", "error", err.Error())
		return ctx.Next()
	}

	ctx.Locals("currentUser", &user)
	return ctx.Next()
}
