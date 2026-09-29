// Package otp extracts verification codes from email subject/body/HTML with
// context-aware heuristics. It mirrors frontend/src/lib/otp-detector.ts,
// itself ported from github.com/One-Day-Developers/otp-detector, so the
// inbox list can carry a "code" field without opening the email.
package otp

import (
	"regexp"
	"strings"
)

var (
	otpRe        = regexp.MustCompile(`\b(\d{4,8}|\d{3,4}[-\s]\d{3,4})\b`)
	dateTimeRe   = regexp.MustCompile(`\b\d{1,2}[:/\-]\d{1,2}([:/\-]\d{2,4})?\b|\b(am|pm|gmt|utc)\b`)
	tagRe        = regexp.MustCompile(`<[^>]+>`)
	codeAdjacent = regexp.MustCompile(`[ck]ode[:\s]*$`)
	codeBefore   = regexp.MustCompile(`(?i)[ck]ode[:\s]*(\d{4,8}|\d{3,4}[-\s]\d{3,4})`)
	fallbackRe   = regexp.MustCompile(`(?i)(\d{4,8}|\d{3,4}[-\s]\d{3,4})[^\S\r\n]{0,8}(is|is your|is the|is a|adalah|merupakan)\s+(([a-z0-9]+\s+){0,3})?(code|otp|pin|kode|confirmation code|verifikasi)`)
)

var strongPositives = []string{
	"otp", "verification code", "security code", "login code",
	"confirmation code", "one-time", "one time", "auth code",
	// Indonesian.
	"kode verifikasi", "kode otp", "kode aktivasi", "kode keamanan",
}

var positiveKeywords = []string{
	"code", "otp", "one-time", "one time", "pin", "verification",
	"verify", "auth", "authentication", "your code", "verification code",
	"is your", "use code", "enter", "sent", "expires", "reset", "login",
	"security", "confirmation code", "facebook code", "instagram code",
	"security code", "login code",
	// Indonesian senders (Tokopedia, Shopee, Gojek, ...).
	"kode", "verifikasi", "aktivasi", "keamanan", "kode verifikasi",
	"kode otp", "kode aktivasi", "kode keamanan", "masukkan kode",
}

var negativeKeywords = []string{
	"order", "invoice", "tracking", "tracking number", "amount", "total",
	"balance", "receipt", "transaction", "date", "booking", "reservation",
	"payment", "order id", "ref", "reference", "txn", "flight", "ticket",
	"road", "street", "avenue", "drive", "lane", "boulevard", "way",
	"court", "suite", "unit", "building", "box", "highway", "st", "ave",
	"rd", "blvd",
	"copyright", "rights reserved", "inc", "corp", "ltd", "group",
	"holdings", "all rights reserved", "unsubscribe", "policy", "terms",
	"declined", "denied", "failed",
}

const neighborhood = 80

// subjectGateRe lets codes through the subject gate when a code keyword is
// present (Indonesian senders included); "Order shipped" never reaches it.
var subjectGateRe = regexp.MustCompile(`(?i)\b(otp|pin|verification|code|one[-\s]*time|verify|kode|verifikasi|aktivasi)\b`)

var subjectQuickRe = regexp.MustCompile(`(?i)[ck]ode[:\s]*(\d{4,8})`)

// Code returns the detected verification code from subject, plain-text body
// and HTML body (in that priority), or "" when none is found.
func Code(subject, text, html string) string {
	// 1. Subject — keyword gate first so "Order shipped" never leaks ids.
	if subject != "" {
		if subjectGateRe.MatchString(subject) {
			if r := extractFromText(subject); r != "" {
				return r
			}
		} else if m := subjectQuickRe.FindStringSubmatch(subject); m != nil {
			return m[1]
		}
	}

	// 2. Plain-text body.
	if r := extractFromText(text); r != "" {
		return r
	}

	// 3. HTML body — strip tags to spaces so digits never merge with text.
	if html != "" {
		if r := extractFromText(tagRe.ReplaceAllString(html, " ")); r != "" {
			return r
		}
	}
	return ""
}

func extractFromText(val string) string {
	if val == "" {
		return ""
	}
	for _, m := range otpRe.FindAllStringSubmatchIndex(val, -1) {
		rawOtp := val[m[2]:m[3]]
		cleanOtp := strings.NewReplacer("-", "", " ", "").Replace(rawOtp)
		if len(cleanOtp) < 4 || len(cleanOtp) > 8 {
			continue
		}

		idx := m[2]
		start := idx - neighborhood
		if start < 0 {
			start = 0
		}
		end := idx + len(rawOtp) + neighborhood
		if end > len(val) {
			end = len(val)
		}
		ctxLower := strings.ToLower(val[start:end])

		if dateTimeRe.MatchString(ctxLower) {
			continue
		}

		strong := false
		for _, k := range strongPositives {
			if strings.Contains(ctxLower, k) {
				strong = true
				break
			}
		}
		if !strong {
			before := ctxLower[:idx-start]
			if len(before) > 12 {
				before = before[len(before)-12:]
			}
			if codeAdjacent.MatchString(before) {
				strong = true
			}
		}
		if !strong {
			if negPattern.MatchString(ctxLower) {
				continue
			}
		}

		before := ctxLower[:idx-start]
		if len(before) > 12 {
			before = before[len(before)-12:]
		}
		if codeAdjacent.MatchString(before) {
			return cleanOtp
		}

		for _, k := range positiveKeywords {
			if strings.Contains(ctxLower, k) {
				return cleanOtp
			}
		}

		if codeBefore.MatchString(ctxLower) || fallbackRe.MatchString(ctxLower) {
			return cleanOtp
		}
	}
	return ""
}

var negPattern = regexp.MustCompile(`(?i)\b(` + strings.Join(negativeKeywords, "|") + `)\b`)
