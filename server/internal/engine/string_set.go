package engine

import (
	"encoding/json"
	"sort"
)

// StringSet is the Go stand-in for the TS engine's `masteries: Set<string>`.
// JS Sets don't serialize to JSON on their own (JSON.stringify(new Set()) is
// "{}"), and the TS engine never had to cross a wire before this port existed —
// so this picks the natural wire shape (a sorted string array, matching what a
// client would want to render a mastery list from) rather than inventing
// something JS-specific to mirror.
type StringSet map[string]bool

func NewStringSet() StringSet {
	return StringSet{}
}

func (s StringSet) Add(v string) {
	s[v] = true
}

func (s StringSet) Has(v string) bool {
	return s[v]
}

func (s StringSet) Len() int {
	return len(s)
}

func (s StringSet) Clone() StringSet {
	out := make(StringSet, len(s))
	for k := range s {
		out[k] = true
	}
	return out
}

func (s StringSet) MarshalJSON() ([]byte, error) {
	items := make([]string, 0, len(s))
	for k := range s {
		items = append(items, k)
	}
	sort.Strings(items)
	return json.Marshal(items)
}

func (s *StringSet) UnmarshalJSON(data []byte) error {
	var items []string
	if err := json.Unmarshal(data, &items); err != nil {
		return err
	}
	set := make(StringSet, len(items))
	for _, it := range items {
		set[it] = true
	}
	*s = set
	return nil
}
