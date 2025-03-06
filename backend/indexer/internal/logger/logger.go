package logger

import (
	"fmt"
	"os"
	"time"

	"github.com/rs/zerolog"
)

var log zerolog.Logger

func init() {
	zerolog.TimeFieldFormat = time.RFC3339
	output := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
		FormatLevel: func(i interface{}) string {
			return fmt.Sprintf("| %-6s|", i)
		},
	}
	log = zerolog.New(output).With().Timestamp().Logger()
}

// Debug logs a debug message
func Debug(msg string) {
	log.Debug().Msg(msg)
}

// Debugf logs a debug message with formatting
func Debugf(format string, v ...interface{}) {
	log.Debug().Msgf(format, v...)
}

// Info logs an info message
func Info(msg string) {
	log.Info().Msg(msg)
}

// Infof logs an info message with formatting
func Infof(format string, v ...interface{}) {
	log.Info().Msgf(format, v...)
}

// Warn logs a warning message
func Warn(msg string) {
	log.Warn().Msg(msg)
}

// Warnf logs a warning message with formatting
func Warnf(format string, v ...interface{}) {
	log.Warn().Msgf(format, v...)
}

// Error logs an error message
func Error(msg string, err error) {
	log.Error().Err(err).Msg(msg)
}

// Errorf logs an error message with formatting
func Errorf(format string, err error, v ...interface{}) {
	log.Error().Err(err).Msgf(format, v...)
}

// Fatal logs a fatal message and exits
func Fatal(msg string, err error) {
	log.Fatal().Err(err).Msg(msg)
}

// Fatalf logs a fatal message with formatting and exits
func Fatalf(format string, err error, v ...interface{}) {
	log.Fatal().Err(err).Msgf(format, v...)
}
