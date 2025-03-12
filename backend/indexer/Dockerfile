FROM golang:1.22-bullseye AS build

WORKDIR /go/src/pdp-explorer/backend/indexer

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /go/bin/pdp-indexer ./cmd/indexer

FROM gcr.io/distroless/cc
COPY --from=build /go/bin/pdp-indexer /usr/bin/

ENTRYPOINT ["/usr/bin/pdp-indexer"]
