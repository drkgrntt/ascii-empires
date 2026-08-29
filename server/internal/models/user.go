package models

import (
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func init() {
	registerModel(&User{})
}

// User mirrors journal's User model shape (email/password/display name, bcrypt
// hooks) trimmed to what a game account needs — no billing/journal-specific fields.
type User struct {
	Base
	Email       string `gorm:"unique;not null" json:"email"`
	DisplayName string `gorm:"not null" json:"displayName"`
	Password    string `gorm:"not null" json:"-"`
}

func (u *User) hashPassword(password string) string {
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hashedPassword)
}

func (u *User) ComparePasswords(candidatePassword string) error {
	return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(candidatePassword))
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	u.Password = u.hashPassword(u.Password)
	return nil
}

func (u *User) BeforeUpdate(tx *gorm.DB) error {
	if tx.Statement.Changed("Password") {
		updatedUser := tx.Statement.Dest.(*User)
		hashedPassword := u.hashPassword(updatedUser.Password)
		tx.Statement.SetColumn("Password", hashedPassword)
	}
	return nil
}
