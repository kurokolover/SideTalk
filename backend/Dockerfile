FROM golang:1.24-alpine AS builder

WORKDIR /app

# Установка зависимостей для сборки
RUN apk add --no-cache git

# Копируем go.mod и go.sum
COPY go.mod go.sum ./
RUN go mod download

# Копируем исходный код
COPY . .

# Собираем приложение
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/main.go

# Final stage
FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

# Копируем бинарник
COPY --from=builder /app/main .

# Копируем конфиг
COPY configs/config.yaml ./configs/config.yaml

# Копируем миграции (ВАЖНО!)
COPY migrations ./migrations

EXPOSE 8080

CMD ["./main"]