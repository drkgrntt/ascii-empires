package utils

import (
	"crypto/rand"
	"strings"
)

// Room codes players read aloud/type to join — short, uppercase, and excluding
// visually-ambiguous characters (0/O, 1/I/L).
const roomCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const roomCodeLength = 6

func GenerateRoomCode() (string, error) {
	buf := make([]byte, roomCodeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	var b strings.Builder
	for _, v := range buf {
		b.WriteByte(roomCodeAlphabet[int(v)%len(roomCodeAlphabet)])
	}
	return b.String(), nil
}
