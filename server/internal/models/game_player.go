package models

import (
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func init() {
	registerModel(&GamePlayer{})
}

// GamePlayer is one seated player's row in a Game: their seat, connection state,
// and their entire Empire state as a jsonb blob. That's the same technique
// journal uses for Base.Metadata (see its CastMetadata/EncodeMetadata helpers) —
// the alternative, normalizing the solo engine's ~15 nested track/grid/building
// shapes into their own tables, would be a lot of schema for what's really one
// serialized snapshot the Go-ported reducer (Phase 2) reads and rewrites wholesale.
type GamePlayer struct {
	Base
	// GameID participates in two composite unique indexes: one seat per game,
	// and one row per (game, user) — it needs both index tags, not just one,
	// or GORM only applies whichever tag it's given to that index alone.
	GameID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_game_seat;uniqueIndex:idx_game_user" json:"gameId"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_game_user" json:"userId"`
	User      *User     `json:"user,omitempty"`
	SeatIndex int       `gorm:"not null;uniqueIndex:idx_game_seat" json:"seatIndex"`
	Connected bool      `gorm:"not null;default:false" json:"connected"`

	// EmpireState is the per-player engine state (population, gold, buildings,
	// science branches, culture grid, ...) — empty object until Phase 2 seeds it
	// at game start.
	EmpireState datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"empireState"`
}
