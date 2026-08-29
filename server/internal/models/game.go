package models

import (
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func init() {
	registerModel(&Game{})
}

type GameStatus string

const (
	GameStatusLobby    GameStatus = "lobby"
	GameStatusActive   GameStatus = "active"
	GameStatusFinished GameStatus = "finished"
)

// Game is the shared match state — the pieces every seated player looks at
// together (round, phase, the one set of rolled dice). Per-player state
// (buildings, tracks, map, ...) lives on GamePlayer instead. Round/Phase/Dice sit
// here unused until Phase 2 wires up gameplay, but the columns exist now so that
// phase doesn't need a migration of its own.
type Game struct {
	Base
	Code        string     `gorm:"type:varchar(8);unique;not null" json:"code"`
	Status      GameStatus `gorm:"type:varchar(16);not null;default:lobby" json:"status"`
	CreatedByID uuid.UUID  `gorm:"type:uuid;not null" json:"createdById"`
	CreatedBy   *User      `json:"createdBy,omitempty"`

	Round int    `gorm:"not null;default:0" json:"round"`
	Phase string `gorm:"type:varchar(16);not null;default:''" json:"phase"`
	// Dice holds the shared rolled values for the round (Phase 2) — e.g.
	// [{"color":"white","value":4}, ...]. Empty array until a round starts.
	Dice datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"dice"`

	Players []*GamePlayer `gorm:"foreignKey:GameID" json:"players,omitempty"`
}
