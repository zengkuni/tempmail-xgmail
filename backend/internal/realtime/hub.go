// Package realtime: Socket.IO hub pushing new-mail events to inbox watchers.
// Rooms are `inbox:<address>`; clients join by connecting with query ?email=.
// Single-instance default adapter; swap in adapters/mongo/v3 when scaling
// the backend to multiple replicas (see github.com/zishang520/socket.io README).
package realtime

import (
	"log"
	"net/http"
	"strings"

	socketio "github.com/zishang520/socket.io/servers/socket/v3"
	"github.com/zishang520/socket.io/v3/pkg/types"
)

type Hub struct {
	io *socketio.Server
}

// New builds the hub. origins lists the allowed CORS origins (empty = same-origin/disabled).
// A literal "*" entry allows any origin (credentials off) — needed when the
// site is reached through a rotating/public hostname (e.g. an IP or a
// temporary tunnel hostname) that can never be enumerated up front.
func New(origins []string) *Hub {
	opts := socketio.DefaultServerOptions()
	if len(origins) > 0 {
		anyOrigins := make([]any, len(origins))
		wildcard := false
		for i, o := range origins {
			anyOrigins[i] = o
			if o == "*" {
				wildcard = true
			}
		}
		cors := &types.Cors{Origin: anyOrigins, Credentials: true}
		if wildcard {
			cors = &types.Cors{Origin: []any{"*"}, Credentials: false}
		}
		opts.SetCors(cors)
	}
	h := &Hub{io: socketio.NewServer(nil, opts)}

	h.io.Of("/", nil).On("connection", func(clients ...any) {
		s := clients[0].(*socketio.Socket)
		email := strings.ToLower(strings.TrimSpace(queryFirst(s.Handshake().Query, "email")))
		if email == "" {
			// Stats pages: watch global traffic without an inbox.
			s.Join(socketio.Room("all"))
			return
		}
		s.Join(socketio.Room("inbox:" + email))
		s.Join(socketio.Room("all"))
		log.Printf("realtime: watcher joined inbox:%s", email)
	})
	return h
}

// Handler serves the Socket.IO endpoint (mount at /socket.io/).
func (h *Hub) Handler() http.Handler {
	return h.io.ServeHandler(nil)
}

// EmailPayload mirrors the REST EmailSummary shape so the client can reuse its mapping.
// To lets clients double-check the recipient before showing the mail.
type EmailPayload struct {
	ID         string `json:"id"`
	From       string `json:"from"`
	To         string `json:"to"`
	Subject    string `json:"subject"`
	Code       string `json:"code"`
	ReceivedAt string `json:"received_at"`
}

// EmitNew pushes the full mail event ONLY to the target inbox room. The global
// "all" room gets a bare "mail:activity" nudge so statistics pages can refetch
// without other users' mail content ever leaving the inbox room.
func (h *Hub) EmitNew(inbox string, p EmailPayload) {
	if inbox != "" {
		p.To = inbox
		h.io.Of("/", nil).To(socketio.Room("inbox:"+inbox)).Emit("email:new", p)
	}
	h.io.Of("/", nil).To(socketio.Room("all")).Emit("mail:activity", nil)
}

// DomainPayload memberi tahu watcher bahwa status MX/aktif sebuah domain berubah.
type DomainPayload struct {
	Name       string `json:"name"`
	MxVerified bool   `json:"mx_verified"`
	Active     bool   `json:"active"`
}

// EmitDomainUpdated mengabari semua watcher (room "all") bahwa domain berubah status.
func (h *Hub) EmitDomainUpdated(p DomainPayload) {
	h.io.Of("/", nil).To(socketio.Room("all")).Emit("domain:updated", p)
}

// EmitDomainRemoved mengabari semua watcher bahwa domain dihapus (grace MX habis).
func (h *Hub) EmitDomainRemoved(name string) {
	h.io.Of("/", nil).To(socketio.Room("all")).Emit("domain:removed", map[string]string{"name": name})
}

// queryFirst reads a scalar or repeated query parameter.
func queryFirst(q types.ParsedUrlQuery, key string) string {
	switch v := q[key].(type) {
	case string:
		return v
	case []string:
		if len(v) > 0 {
			return v[0]
		}
	}
	return ""
}
