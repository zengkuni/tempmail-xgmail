package dnsx

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"tempmail/internal/config"

	"github.com/miekg/dns"
)

// LookupBIMI mengembalikan URL logo brand dari record BIMI domain:
// TXT "default._bimi.<domain>" berisi "v=BIMI1; l=<url>; a=<url>" (l= opsional).
// NXDOMAIN / tidak ada record / tanpa l= → ok=false tanpa error; kegagalan
// resolver → error (caller boleh negative-cache lebih agresif).
func LookupBIMI(ctx context.Context, cfg *config.Config, domain string) (logoURL string, ok bool, err error) {
	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return "", false, nil
	}
	resolvers := pickResolvers(cfg)
	if len(resolvers) == 0 {
		return "", false, errors.New("dnsx: no resolvers configured")
	}

	msg := new(dns.Msg)
	msg.SetQuestion(dns.Fqdn("default._bimi."+domain), dns.TypeTXT)
	msg.RecursionDesired = true

	client := &dns.Client{Timeout: cfg.DNSLookupTimeout}
	var lastErr error
	sawNXDOMAIN := false
	for _, resolver := range resolvers {
		r, _, qerr := client.ExchangeContext(ctx, msg, resolver)
		if qerr != nil {
			lastErr = qerr
			continue
		}
		if r.Rcode == dns.RcodeNameError {
			sawNXDOMAIN = true
			continue
		}
		if r.Rcode != dns.RcodeSuccess {
			lastErr = fmt.Errorf("dnsx: %s returned %s", resolver, dns.RcodeToString[r.Rcode])
			continue
		}
		for _, rr := range r.Answer {
			txt, isTXT := rr.(*dns.TXT)
			if !isTXT {
				continue
			}
			if url, found := parseBIMILogoURL(strings.Join(txt.Txt, "")); found {
				return url, true, nil
			}
		}
		// Response definitive: domain tidak publish logo BIMI.
		return "", false, nil
	}
	if sawNXDOMAIN {
		return "", false, nil
	}
	return "", false, lastErr
}

// parseBIMILogoURL mengekstrak field l= dari tag BIMI ("v=BIMI1; l=...; ...").
func parseBIMILogoURL(record string) (string, bool) {
	v1 := false
	logo := ""
	for _, part := range strings.Split(record, ";") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch strings.ToLower(strings.TrimSpace(kv[0])) {
		case "v":
			v1 = strings.EqualFold(strings.TrimSpace(kv[1]), "BIMI1")
		case "l":
			logo = strings.TrimSpace(kv[1])
		}
	}
	if !v1 || logo == "" {
		return "", false
	}
	// l= wajib https per spec BIMI; hanya itu yang di-fetch.
	if !strings.HasPrefix(logo, "https://") {
		return "", false
	}
	return logo, true
}
