package agent

import (
	"strings"
	"testing"
)

func TestResponseLanguagePreservesStoredPromptAndToolBoundary(t *testing.T) {
	for _, def := range []DeferredInfo{{}, {GlobalNames: []string{"example_tool"}}} {
		system, boundary := deferredSystem("CUSTOM POLICY", def)
		if !strings.HasPrefix(system[0], "CUSTOM POLICY") || !strings.Contains(system[0], responseLanguageInstruction) {
			t.Fatalf("missing policy or Japanese instruction: %v", system)
		}
		if len(def.GlobalNames) > 0 && (len(system) != 2 || boundary != 2 || !strings.Contains(system[1], "example_tool")) {
			t.Fatalf("deferred tools or cache boundary changed: %v, %d", system, boundary)
		}
	}
}
