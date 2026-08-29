package utils

import (
	"encoding/base64"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Verbatim port of journal's internal/utils/tokens.go: RS256, private/public PEM
// keys base64-encoded in env, `sub` claim = user UUID.
var (
	accessTokenPrivateKey = os.Getenv("ACCESS_TOKEN_PRIVATE_KEY")
	accessTokenPublicKey  = os.Getenv("ACCESS_TOKEN_PUBLIC_KEY")
	accessTokenExpiresIn  = os.Getenv("ACCESS_TOKEN_EXPIRES_IN")
)

func CreateToken(expiresIn time.Duration, additionalClaims map[string]any) (string, error) {
	decodedPrivateKey, err := base64.StdEncoding.DecodeString(accessTokenPrivateKey)
	if err != nil {
		return "", fmt.Errorf("could not decode key: %w", err)
	}
	key, err := jwt.ParseRSAPrivateKeyFromPEM(decodedPrivateKey)
	if err != nil {
		return "", fmt.Errorf("create: parse key: %w", err)
	}

	now := time.Now().UTC()

	claims := make(jwt.MapClaims)
	claims["exp"] = now.Add(expiresIn).Unix()
	claims["iat"] = now.Unix()
	claims["nbf"] = now.Unix()
	for k, v := range additionalClaims {
		claims[k] = v
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(key)
	if err != nil {
		return "", fmt.Errorf("create: sign token: %w", err)
	}

	return token, nil
}

func CreateAccessToken(userId uuid.UUID) (string, error) {
	expiresIn, err := time.ParseDuration(accessTokenExpiresIn)
	if err != nil {
		return "", fmt.Errorf("invalid expiry duration: %w", err)
	}

	claims := make(map[string]any)
	claims["sub"] = userId

	return CreateToken(expiresIn, claims)
}

type TokenData struct {
	UserID uuid.UUID
}

func ValidateToken(token string) (*TokenData, error) {
	decodedPublicKey, err := base64.StdEncoding.DecodeString(accessTokenPublicKey)
	if err != nil {
		return nil, fmt.Errorf("could not decode: %w", err)
	}

	key, err := jwt.ParseRSAPublicKeyFromPEM(decodedPublicKey)
	if err != nil {
		return nil, fmt.Errorf("validate: parse key: %w", err)
	}

	parsedToken, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected method: %s", t.Header["alg"])
		}
		return key, nil
	})
	if err != nil {
		return nil, fmt.Errorf("validate: %w", err)
	}

	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	if !ok || !parsedToken.Valid {
		return nil, fmt.Errorf("validate: invalid token")
	}

	if claims["sub"] == nil {
		return nil, fmt.Errorf("validate: no sub")
	}

	userId, err := uuid.Parse(claims["sub"].(string))
	if err != nil {
		return nil, fmt.Errorf("validate: unable to parse token: %w", err)
	}

	return &TokenData{UserID: userId}, nil
}
