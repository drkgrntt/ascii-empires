package models

// Same self-registration pattern as journal/internal/models: each model calls
// registerModel(&Type{}) from its own init(), so database.AutoMigrate can migrate
// everything via GetModels() without a hand-maintained list growing stale.
var registeredModels []any

func registerModel(model any) {
	registeredModels = append(registeredModels, model)
}

func GetModels() []any {
	return registeredModels
}
