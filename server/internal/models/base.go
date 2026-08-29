package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Base is the shared shape for every model: a UUID primary key plus timestamps
// and soft-delete. journal's Base also carries Creator/LastUpdater/Metadata for
// its multi-tenant CRUD audit trail — not applicable to ephemeral game rooms, so
// this is intentionally the trimmed-down version.
type Base struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primary_key" json:"id"`
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
