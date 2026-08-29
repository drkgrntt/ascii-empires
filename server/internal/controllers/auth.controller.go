package controllers

import (
	"os"
	"strings"
	"time"

	"ascii-empires-server/internal/logger"
	"ascii-empires-server/internal/models"
	"ascii-empires-server/internal/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func init() {
	registerController(&AuthController{})
}

// Same shape as journal's AuthController, adapted for JSON in/out instead of
// form posts + redirects (this is an API for the React SPA, not server-rendered
// pages) — same cookie config, same bcrypt/JWT flow.
type AuthController struct {
	db  *gorm.DB
	api fiber.Router
}

func (c *AuthController) Init(db *gorm.DB, app *fiber.App) {
	c.db = db
	c.api = app.Group("api/auth")
}

func (c *AuthController) RegisterApiRoutes() {
	c.api.Post("/register", c.register)
	c.api.Post("/login", c.login)
	c.api.Post("/logout", c.logout)
	c.api.Get("/me", c.me)
}

type AuthBody struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

func (c *AuthController) register(ctx *fiber.Ctx) error {
	var body AuthBody
	if err := ctx.BodyParser(&body); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request body"})
	}
	if body.Email == "" || body.Password == "" || body.DisplayName == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "email, password, and displayName are required"})
	}

	var existing models.User
	if err := c.db.Where("lower(email) = ?", strings.ToLower(body.Email)).First(&existing).Error; err == nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "user already exists"})
	}

	user := models.User{
		Email:       body.Email,
		Password:    body.Password,
		DisplayName: body.DisplayName,
	}
	if err := c.db.Create(&user).Error; err != nil {
		logger.Error("Error creating user", "error", err.Error())
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "error creating user"})
	}

	return c.issueToken(ctx, &user)
}

func (c *AuthController) login(ctx *fiber.Ctx) error {
	var body AuthBody
	if err := ctx.BodyParser(&body); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bad request body"})
	}

	var user models.User
	if err := c.db.Where("lower(email) = ?", strings.ToLower(body.Email)).First(&user).Error; err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "email or password incorrect"})
	}

	if err := user.ComparePasswords(body.Password); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "email or password incorrect"})
	}

	return c.issueToken(ctx, &user)
}

func (c *AuthController) logout(ctx *fiber.Ctx) error {
	ctx.Cookie(&fiber.Cookie{
		Name:     "x-token",
		HTTPOnly: true,
		MaxAge:   0,
	})
	return ctx.SendStatus(fiber.StatusNoContent)
}

func (c *AuthController) me(ctx *fiber.Ctx) error {
	user := utils.GetLocal[models.User](ctx, "currentUser")
	if user == nil {
		return ctx.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "not authenticated"})
	}
	return ctx.JSON(user)
}

func (c *AuthController) issueToken(ctx *fiber.Ctx, user *models.User) error {
	token, err := utils.CreateAccessToken(user.ID)
	if err != nil {
		logger.Error("Error creating token", "error", err.Error())
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "error creating token"})
	}

	ctx.Cookie(&fiber.Cookie{
		Name:     "x-token",
		Value:    token,
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   os.Getenv("APP_ENV") == "production",
		Path:     "/",
		Expires:  time.Now().Add(time.Hour * 24 * 30),
		MaxAge:   60 * 60 * 24 * 30,
	})

	return ctx.Status(fiber.StatusCreated).JSON(user)
}
