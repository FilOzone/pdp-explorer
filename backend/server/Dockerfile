FROM golang:1.21-bullseye AS build

WORKDIR /go/src/pdp-explorer/backend/server

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /go/bin/pdp-api ./cmd

FROM gcr.io/distroless/cc
COPY --from=build /go/bin/pdp-api /usr/bin/

ENTRYPOINT ["/usr/bin/pdp-api"]
