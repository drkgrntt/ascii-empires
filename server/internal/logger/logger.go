package logger

import (
	"log/slog"
	"os"
)

var logger *slog.Logger

func init() {
	opts := &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}
	logger = slog.New(slog.NewTextHandler(os.Stdout, opts))
}

func Info(msg string, args ...any) {
	logger.Info(msg, args...)
}

func Warn(msg string, args ...any) {
	logger.Warn(msg, args...)
}

func Debug(msg string, args ...any) {
	logger.Debug(msg, args...)
}

func Error(msg string, args ...any) {
	logger.Error(msg, args...)
}
