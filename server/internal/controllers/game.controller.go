package controllers

import (
	"strings"

	"ascii-empires-server/internal/logger"
	"ascii-empires-server/internal/middleware"
	"ascii-empires-server/internal/models"
	"ascii-empires-server/internal/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func init() {
	registerController(&GameController{})
}

// GameController: the lobby. Create a game (get a room code back), join one by
// code, and read its current lobby state. No gameplay yet — Round/Phase/Dice on
// the Game and EmpireState on each GamePlayer stay at their zero values until
// Phase 2 wires up the WebSocket sync loop.
type GameController struct {
	db  *gorm.DB
	api fiber.Router
}

func (c *GameController) Init(db *gorm.DB, app *fiber.App) {
	c.db = db
	c.api = app.Group("api/games", middleware.RequireAuth)
}

func (c *GameController) RegisterApiRoutes() {
	c.api.Post("/", c.create)
	c.api.Post("/:code/join", c.join)
	c.api.Get("/:code", c.show)
}

func (c *GameController) currentUser(ctx *fiber.Ctx) *models.User {
	return utils.GetLocal[models.User](ctx, "currentUser")
}

func (c *GameController) create(ctx *fiber.Ctx) error {
	user := c.currentUser(ctx)

	code, err := c.uniqueCode()
	if err != nil {
		logger.Error("Error generating room code", "error", err.Error())
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "error creating game"})
	}

	game := models.Game{
		Code:        code,
		Status:      models.GameStatusLobby,
		CreatedByID: user.ID,
		Players: []*models.GamePlayer{
			{UserID: user.ID, SeatIndex: 0},
		},
	}
	if err := c.db.Create(&game).Error; err != nil {
		logger.Error("Error creating game", "error", err.Error())
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "error creating game"})
	}

	return ctx.Status(fiber.StatusCreated).JSON(game)
}

func (c *GameController) join(ctx *fiber.Ctx) error {
	user := c.currentUser(ctx)
	code := strings.ToUpper(ctx.Params("code"))

	game, err := c.findGameByCode(code)
	if err != nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "game not found"})
	}
	if game.Status != models.GameStatusLobby {
		return ctx.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "game already started"})
	}

	for _, p := range game.Players {
		if p.UserID == user.ID {
			return ctx.JSON(game) // already seated — idempotent
		}
	}

	player := models.GamePlayer{
		GameID:    game.ID,
		UserID:    user.ID,
		SeatIndex: len(game.Players),
	}
	if err := c.db.Create(&player).Error; err != nil {
		logger.Error("Error joining game", "error", err.Error())
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "error joining game"})
	}

	game, err = c.findGameByCode(code)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "error loading game"})
	}
	return ctx.JSON(game)
}

func (c *GameController) show(ctx *fiber.Ctx) error {
	user := c.currentUser(ctx)
	code := strings.ToUpper(ctx.Params("code"))

	game, err := c.findGameByCode(code)
	if err != nil {
		return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "game not found"})
	}

	seated := false
	for _, p := range game.Players {
		if p.UserID == user.ID {
			seated = true
			break
		}
	}
	if !seated {
		return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "not a player in this game"})
	}

	return ctx.JSON(game)
}

func (c *GameController) findGameByCode(code string) (*models.Game, error) {
	var game models.Game
	err := c.db.
		Preload("Players.User").
		Preload("CreatedBy").
		Where("code = ?", code).
		First(&game).Error
	return &game, err
}

// uniqueCode retries GenerateRoomCode on the rare collision — codes are 6
// characters from a 32-symbol alphabet, so collisions are unlikely but cheap to
// guard against anyway.
func (c *GameController) uniqueCode() (string, error) {
	for range 10 {
		code, err := utils.GenerateRoomCode()
		if err != nil {
			return "", err
		}
		var count int64
		if err := c.db.Model(&models.Game{}).Where("code = ?", code).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return code, nil
		}
	}
	return "", fiber.NewError(fiber.StatusInternalServerError, "could not generate a unique room code")
}
