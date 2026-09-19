import { useQuery } from "@tanstack/react-query"
import { fetchDefaultAgentPrompts } from "@/api/campaign-defaults"

export function useDefaultAgentPrompts() {
  return useQuery({ queryKey: ["campaign-defaults", "agent-prompts"], queryFn: fetchDefaultAgentPrompts })
}
