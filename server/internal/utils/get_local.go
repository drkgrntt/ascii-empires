package utils

import (
	"ascii-empires-server/internal/logger"

	"github.com/gofiber/fiber/v2"
)

// GetLocal retrieves a value of any specified type from the context locals.
// Verbatim port of journal's internal/utils/getLocal.go.
func GetLocal[T any](ctx *fiber.Ctx, key string) *T {
	valueInterface := ctx.Locals(key)
	if valueInterface == nil {
		return nil
	}
	value, ok := valueInterface.(*T)
	if !ok {
		logger.Warn("Unable to cast interface for key", "key", key)
		return nil
	}

	return value
}
